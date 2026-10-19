// src/pages/api/chat.js
/**
 * ============================================================================
 * CloseDesk Multi-Tenant Platform — Conversation Orchestrator Chat API
 * ============================================================================
 * Phase 2, 3 & 5: Conversation Orchestration & Action Router
 * 
 * Responsibilities:
 * 1. Supports dual authentication: Modern cryptographically secure `session_token`
 *    OR legacy `session_id` payload (with automatic session synthesis).
 * 2. Retrieves session context and state machine position via `sessionService.js`.
 * 3. Resolves multi-tenant layers (Core Policy + Industry Pack + Client Config) via `tenantResolver.js`.
 * 4. Compiles dynamic system prompt enforcing "Answer before interrogating" and "Context before questions".
 * 5. Executes OpenAI Chat Completions in strict JSON mode with exponential retry tracing.
 * 6. Phase 5 Action Router: Intercepts `requested_tool` / tool calls, validates tenant permissions,
 *    enforces idempotency, routes to `toolRouter.js`, and feeds results back to the LLM for grounded confirmation.
 * 7. Safely patches session context, customer details, and problem classification via `patchContext()`.
 * 8. Records dialogue history turns and operational telemetry in Firebase RTDB.
 * 9. Triggers email alerts via `queueEmailAlert` for emergency conditions and urgent leads.
 * 10. Returns dual-contract response conforming to both modern CloseDesk spec and legacy widgets.
 * 11. Wrapped with `withApiLogger` for SOC2-compliant auditability.
 */

import OpenAI from "openai";
import { withApiLogger } from "../../lib/apiMiddleware.js";
import { resolveTenant, getIndustryPack } from "../../lib/tenantResolver.js";
import {
  getSessionByToken,
  getSessionOrCreate,
  patchContext,
  appendSessionMessage,
  escalateSession,
  SESSION_STATES,
} from "../../lib/sessionService.js";
import { buildOrchestratorPrompt } from "../../lib/promptOrchestrator.js";
import { withRetryTrace } from "../../lib/retryTracer.js";
import { traceAiExecution, safeParseAiResponse } from "../../lib/aiTracer.js";
import { queueEmailAlert } from "../../lib/notificationHelper.js";
import { executeAction, getOpenAiToolDefinitions } from "../../lib/toolRouter.js";

// Rate limiting in-memory map (Window: 60s, Max: 20 requests per session)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;

// Security pattern for prompt injection and jailbreak attempts
const PROMPT_INJECTION_PATTERN =
  /(ignore (all )?previous|system prompt|developer mode|jailbreak|bypass instructions|pretend you are)/i;

/**
 * Validates and sanitizes LLM JSON output against the expected schema.
 */
function sanitizeLlmResponse(rawObj) {
  if (!rawObj || typeof rawObj !== "object") {
    throw new SyntaxError("LLM response did not parse as a valid JSON object.");
  }

  const reply =
    typeof rawObj.reply === "string" && rawObj.reply.trim().length > 0
      ? rawObj.reply.trim()
      : "I understand. How else can I assist you with your business today?";

  const currentState =
    typeof rawObj.current_state === "string" && Object.values(SESSION_STATES).includes(rawObj.current_state)
      ? rawObj.current_state
      : SESSION_STATES.INTAKE;

  const urgency =
    typeof rawObj.urgency === "string" && ["Low", "Medium", "High", "Emergency"].includes(rawObj.urgency)
      ? rawObj.urgency
      : "Low";

  const isEmergency = Boolean(rawObj.is_emergency || urgency === "Emergency");

  const shortcuts = Array.isArray(rawObj.suggested_shortcuts)
    ? rawObj.suggested_shortcuts.slice(0, 3).map((s) => String(s).trim())
    : [];

  const contextPatch =
    rawObj.context_patch && typeof rawObj.context_patch === "object" ? rawObj.context_patch : {};

  const nextAction =
    typeof rawObj.next_allowed_action === "string"
      ? rawObj.next_allowed_action
      : "CONTINUE_CONVERSATION";

  const flags = Array.isArray(rawObj.flags) ? rawObj.flags.map(String) : [];

  // Extract requested tool for Phase 5 Action Router
  const requestedTool =
    rawObj.requested_tool &&
    typeof rawObj.requested_tool === "object" &&
    typeof rawObj.requested_tool.name === "string" &&
    rawObj.requested_tool.name.trim() !== ""
      ? {
          name: rawObj.requested_tool.name.trim(),
          args:
            rawObj.requested_tool.args && typeof rawObj.requested_tool.args === "object"
              ? rawObj.requested_tool.args
              : {},
        }
      : null;

  return {
    reply,
    current_state: currentState,
    urgency,
    is_emergency: isEmergency,
    suggested_shortcuts: shortcuts,
    context_patch: contextPatch,
    next_allowed_action: nextAction,
    flags,
    requested_tool: requestedTool,
  };
}

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  // 1. Extract Session Auth (Session Token OR legacy session_id) & Inbound Message
  const sessionToken =
    req.headers["x-session-token"] || req.body?.session_token || null;
  const legacySessionId = req.body?.session_id || null;

  // Extract message from body (either single 'message' string or last message in 'messages' array)
  let userMessage = req.body?.message;
  if (!userMessage && Array.isArray(req.body?.messages) && req.body.messages.length > 0) {
    userMessage = req.body.messages[req.body.messages.length - 1]?.content;
  }

  if (!sessionToken && !legacySessionId) {
    apiLogger.warn("security", "missing_session_auth");
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Missing 'x-session-token' authentication header or 'session_id' in payload.",
    });
  }

  if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "A non-empty 'message' string is required.",
    });
  }

  const cleanUserMessage = userMessage.trim();

  try {
    // 2. Resolve Active Session
    let session, sessionId, tenantId;
    if (sessionToken && typeof sessionToken === "string" && sessionToken.trim() !== "") {
      const resolved = await getSessionByToken(sessionToken);
      session = resolved.session;
      sessionId = resolved.sessionId;
      tenantId = resolved.tenantId;
    } else {
      // Legacy session_id fallback
      const targetTenantId = req.body?.tenant_id || "tenant_aicyro";
      const resolved = await getSessionOrCreate(legacySessionId, targetTenantId);
      session = resolved.session;
      sessionId = resolved.sessionId;
      tenantId = resolved.tenantId;
    }

    // 3. Rate Limiting Enforcement (Window: 60s, Max: 20 turns)
    const now = Date.now();
    const rateData = rateLimitMap.get(sessionId) || { count: 0, windowStart: now };
    if (now - rateData.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateData.count = 1;
      rateData.windowStart = now;
    } else {
      rateData.count++;
      if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
        apiLogger.warn("security", "rate_limit_exceeded", { context: { sessionId, tenantId } });
        return res.status(429).json({
          success: false,
          error: "Rate Limit Exceeded",
          reply: "You're sending messages a bit too quickly. Please wait a moment.",
        });
      }
    }
    rateLimitMap.set(sessionId, rateData);

    // 4. Prompt Injection Detection
    const hasInjectionAttempt = PROMPT_INJECTION_PATTERN.test(cleanUserMessage);
    if (hasInjectionAttempt) {
      apiLogger.warn("security_audit", "prompt_injection_attempt_intercepted", {
        context: { sessionId, tenantId, cleanUserMessage },
      });
      return res.status(200).json({
        success: true,
        reply: "I am CloseDesk's Front Desk Assistant. How can I help you today?",
        current_state: session.current_state || SESSION_STATES.INTAKE,
        urgency: "Low",
        is_emergency: false,
        suggested_shortcuts: ["Our Services", "Book Consultation"],
        next_allowed_action: "CONTINUE_CONVERSATION",
        context_patch: {},
      });
    }

    // 5. Resolve Multi-Tenant Layers (Core Policy + Industry Pack + Client Config)
    const tenant = await resolveTenant(tenantId, { includeSecrets: false });

    // Handle dynamic industry override if passed by regression suite or caller
    if (req.body?.current_lead_data?.serviceCategory) {
      const requestedCategory = req.body.current_lead_data.serviceCategory.toLowerCase();
      if (requestedCategory !== tenant.industry_pack_id) {
        const customPack = await getIndustryPack(requestedCategory);
        if (customPack) {
          tenant.industry_pack = customPack;
          tenant.industry_pack_id = requestedCategory;
        }
      }
    }

    // 6. Build Dynamic Orchestrator System Prompt
    const systemPrompt = buildOrchestratorPrompt({ tenant, session });

    // 7. Assemble Dialogue Turns
    const recentHistory = (session.history || []).slice(-8).map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.content,
    }));

    // If caller provided messages array, respect existing context
    if (recentHistory.length === 0 && Array.isArray(req.body?.messages)) {
      const callerHistory = req.body.messages
        .slice(-6)
        .filter((m) => m && (m.role === "user" || m.role === "assistant" || m.role === "bot"))
        .map((m) => ({
          role: m.role === "bot" ? "assistant" : m.role,
          content: m.content || m.text || "",
        }));
      if (callerHistory.length > 0) {
        recentHistory.push(...callerHistory.slice(0, callerHistory.length - 1));
      }
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: cleanUserMessage },
    ];

    // 8. Execute OpenAI Chat Completion in Strict JSON Mode with Retry Tracing
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const aiModel = tenant.client_config?.ai_persona?.model || "gpt-4o-mini";
    const temperature = parseFloat(tenant.client_config?.temperature || 0.2);

    const aiContext = {
      ai_model: aiModel,
      prompt_version: "multi_tenant_v2.0",
      conversation_state: session.current_state,
      tenant_id: tenantId,
      session_id: sessionId,
    };

    const sanitizedResponse = await withRetryTrace(
      apiLogger,
      "openai_chat_orchestrator",
      async () => {
        const completionPromise = openai.chat.completions.create({
          model: aiModel,
          messages,
          response_format: { type: "json_object" },
          temperature,
          max_tokens: 600,
        });

        const completion = await traceAiExecution(apiLogger, completionPromise, aiContext);
        const rawContent = completion.choices[0]?.message?.content;
        const parsedJson = safeParseAiResponse(apiLogger, rawContent, aiContext);

        return sanitizeLlmResponse(parsedJson);
      }
    );

    // =========================================================================
    // 9. PHASE 5: ACTION ROUTER & TOOL EXECUTION (APIs ARE TRUTH)
    // =========================================================================
    let toolExecutionResult = null;

    if (sanitizedResponse.requested_tool && sanitizedResponse.requested_tool.name) {
      const { name: requestedToolName, args: requestedToolArgs } = sanitizedResponse.requested_tool;

      apiLogger.info("action_router", "tool_invocation_requested", {
        context: { toolName: requestedToolName, sessionId, tenantId },
        metadata: { args: requestedToolArgs },
      });

      // Route through toolRouter with tenant authorization and idempotency
      toolExecutionResult = await executeAction({
        toolName: requestedToolName,
        toolArgs: requestedToolArgs,
        tenant,
        session,
        apiLogger,
        toolCallId: `call_${Date.now()}`,
      });

      if (toolExecutionResult && toolExecutionResult.success) {
        sanitizedResponse.current_state = SESSION_STATES.CONFIRMED;

        // Feed authoritative backend result back into LLM for grounded confirmation
        try {
          const followUpPrompt = `[AUTHORITATIVE BACKEND CONFIRMATION: Action '${requestedToolName}' succeeded. Confirmation Reference: ${
            toolExecutionResult.service_request_id || toolExecutionResult.booking_id || "confirmed"
          }. Summary: ${toolExecutionResult.summary}. Provide a warm, concise 1-2 sentence confirmation to the user referencing their confirmation ID.]`;

          const confirmationPromise = openai.chat.completions.create({
            model: aiModel,
            messages: [
              ...messages,
              { role: "assistant", content: JSON.stringify(sanitizedResponse) },
              { role: "user", content: followUpPrompt },
            ],
            response_format: { type: "json_object" },
            temperature,
            max_tokens: 300,
          });

          const confirmationCompletion = await traceAiExecution(
            apiLogger,
            confirmationPromise,
            {
              ...aiContext,
              conversation_state: SESSION_STATES.CONFIRMED,
            }
          );

          const confirmedJson = safeParseAiResponse(
            apiLogger,
            confirmationCompletion.choices[0]?.message?.content,
            aiContext
          );

          if (confirmedJson && confirmedJson.reply) {
            sanitizedResponse.reply = confirmedJson.reply;
          }
        } catch (feedbackErr) {
          console.warn("[chat.js] Failed to generate second-turn confirmation, using first turn reply:", feedbackErr.message);
        }
      } else if (toolExecutionResult && toolExecutionResult.error) {
        // Backend validation or permission failed
        sanitizedResponse.reply = `I apologize, but we could not complete that request: ${
          toolExecutionResult.message || "Action not supported."
        } How else can our team assist you today?`;
      }
    }

    // 10. Patch Structured Session Memory in Firebase RTDB (also dual-writes to /leads and /prospects)
    await patchContext(sessionId, sanitizedResponse.context_patch, sanitizedResponse.current_state);

    // 11. Record Conversation Turns in Session History
    await appendSessionMessage(sessionId, {
      role: "user",
      content: cleanUserMessage,
    });

    await appendSessionMessage(sessionId, {
      role: "assistant",
      content: sanitizedResponse.reply,
      channelMetadata: {
        shortcuts: sanitizedResponse.suggested_shortcuts,
        state: sanitizedResponse.current_state,
        tool_execution: toolExecutionResult ? { toolName: sanitizedResponse.requested_tool?.name, success: toolExecutionResult.success } : null,
      },
    });

    // 12. Handle Emergency Escalation Flag & Alert Queue
    if (sanitizedResponse.is_emergency || sanitizedResponse.urgency === "Emergency") {
      apiLogger.warn("emergency_trigger", "emergency_detected_and_escalated", {
        context: { sessionId, tenantId, urgency: sanitizedResponse.urgency },
      });
      await escalateSession(sessionId, {
        reason: sanitizedResponse.context_patch?.service_request?.problem_description || "Emergency issue reported",
        urgency: "Emergency",
      });

      // Queue email alert for instant dispatch to admin
      try {
        await queueEmailAlert(
          "EMERGENCY Triage Alert 🚨",
          `Emergency condition detected: "${sanitizedResponse.context_patch?.service_request?.problem_description || cleanUserMessage}"`,
          {
            name: sanitizedResponse.context_patch?.customer?.name || "Customer",
            phone: sanitizedResponse.context_patch?.customer?.phone || "Unknown",
            email: sanitizedResponse.context_patch?.customer?.email || "Unknown",
            business_problem: sanitizedResponse.context_patch?.service_request?.problem_description || cleanUserMessage,
            urgency_level: "High",
          },
          "end"
        );
      } catch (alertErr) {
        console.warn("[chat.js] Failed to queue emergency alert:", alertErr.message);
      }
    }

    // 13. Return Client Response conforming to BOTH Modern and Legacy API contracts
    const customer = sanitizedResponse.context_patch?.customer || {};
    const serviceReq = sanitizedResponse.context_patch?.service_request || {};
    const isReadyToBook =
      sanitizedResponse.current_state === SESSION_STATES.CONFIRMED ||
      sanitizedResponse.current_state === SESSION_STATES.SCHEDULING;

    return res.status(200).json({
      success: true,
      reply: sanitizedResponse.reply,
      current_state: sanitizedResponse.current_state,
      urgency: sanitizedResponse.urgency,
      urgency_level: sanitizedResponse.urgency, // Legacy alias
      is_emergency: sanitizedResponse.is_emergency,
      suggested_shortcuts: sanitizedResponse.suggested_shortcuts,
      next_allowed_action: sanitizedResponse.next_allowed_action,
      next_action: sanitizedResponse.next_allowed_action, // Legacy alias
      context_patch: sanitizedResponse.context_patch,
      tool_execution: toolExecutionResult,
      extracted_data: {
        name: customer.name || null,
        phone: customer.phone || null,
        email: customer.email || null,
        service_requested: serviceReq.category || null,
        business_problem: serviceReq.problem_description || null,
        ready_to_book: isReadyToBook,
      },
      ready_to_book: isReadyToBook,
      lead_temperature: sanitizedResponse.urgency === "Emergency" || sanitizedResponse.urgency === "High" ? "Hot" : "Warm",
      flags: sanitizedResponse.flags,
    });
  } catch (error) {
    apiLogger.error("orchestrator", "chat_turn_failed", { error });

    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      reply:
        "I'm experiencing a brief connection delay with our server. Could you please send that again, or call our office directly?",
      suggested_shortcuts: ["Call Office", "Retry"],
    });
  }
}

export default withApiLogger(handler, "Conversation-Orchestrator-Chat-API");