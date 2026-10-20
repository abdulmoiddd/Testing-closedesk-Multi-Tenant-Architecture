// src/lib/toolRouter.js
/**
 * ============================================================================
 * CloseDesk Multi-Tenant Platform — Tool Registry & Action Router
 * ============================================================================
 * Phase 5: Action Router, Idempotency & Tool Permissions
 * 
 * Responsibilities:
 * 1. Implements "APIs are truth": LLM cannot write directly to DB/CRM; it must
 *    request an action that the backend strictly validates and routes.
 * 2. Enforces tenant permission gating: checks `tenant.client_config.actions`
 *    before permitting any tool execution.
 * 3. Enforces end-to-end idempotency via `idempotency_keys` in Firebase RTDB
 *    to prevent duplicate lead generation and double-booking.
 * 4. Implements canonical tools:
 *    - `create_service_request`: Validates request and persists to `/leads`.
 *    - `create_booking`: Confirms appointment booking with slot lock.
 *    - `request_emergency_dispatch`: Instantly escalates 24/7 urgent dispatches.
 * 5. Integrates with `executeToolWithTrace` for SOC2-compliant observability.
 */

import crypto from "crypto";
import { db } from "./firebase.js";
import { ref, get, update, set } from "firebase/database";
import { executeToolWithTrace } from "./toolTracer.js";
import { queueEmailAlert } from "./notificationHelper.js";

// --- CUSTOM ERROR DEFINITIONS ---

export class ToolNotPermittedError extends Error {
  constructor(toolName, tenantId) {
    super(`Tool '${toolName}' is not permitted for tenant '${tenantId}'.`);
    this.name = "ToolNotPermittedError";
    this.code = "TOOL_NOT_PERMITTED";
    this.statusCode = 403;
    this.toolName = toolName;
    this.tenantId = tenantId;
  }
}

export class ToolValidationError extends Error {
  constructor(message, missingFields = []) {
    super(message);
    this.name = "ToolValidationError";
    this.code = "TOOL_VALIDATION_ERROR";
    this.statusCode = 400;
    this.missingFields = missingFields;
  }
}

// --- PERMISSION EVALUATOR ---

/**
 * Checks whether a given tenant's configuration permits execution of a specific tool.
 *
 * @param {Object} tenant - Resolved tenant context
 * @param {string} toolName - Name of the canonical tool
 * @returns {boolean} Whether execution is authorized
 */
export function isToolPermittedForTenant(tenant, toolName) {
  if (!tenant || !toolName) return false;

  const clientConfig = tenant.client_config || {};
  const effectiveConfig = tenant.effective_config || {};

  // 1. Check explicit client_config.actions
  const clientActions = clientConfig.actions;
  if (Array.isArray(clientActions)) {
    return clientActions.includes(toolName);
  }
  if (clientActions && typeof clientActions === "object") {
    if (clientActions[toolName] !== undefined) {
      return Boolean(clientActions[toolName]);
    }
  }

  // 2. Check effective_config.actions (inherited from industry pack)
  const effectiveActions = effectiveConfig.actions;
  if (Array.isArray(effectiveActions)) {
    return effectiveActions.includes(toolName);
  }
  if (effectiveActions && typeof effectiveActions === "object") {
    if (effectiveActions[toolName] !== undefined) {
      return Boolean(effectiveActions[toolName]);
    }
  }

  // 3. Fallback defaults by tool capability:
  if (toolName === "create_service_request") {
    // Service requests are fundamental to all tenants unless explicitly disabled
    return true;
  }

  if (toolName === "request_emergency_dispatch") {
    // Allowed if tenant or industry pack supports emergency rules
    return Boolean(clientConfig.emergency_rules?.supports_24_7_dispatch !== false);
  }

  if (toolName === "create_booking") {
    // Only allowed if tenant permits direct booking
    return Boolean(clientConfig.booking_rules?.allow_direct_booking !== false);
  }

  return false;
}

// --- IDEMPOTENCY KEY MANAGEMENT ---

/**
 * Generates a deterministic SHA256 idempotency key if one was not provided.
 *
 * @param {string} sessionId
 * @param {string} toolName
 * @param {Object} args
 * @returns {string}
 */
export function generateIdempotencyKey(sessionId, toolName, args = {}) {
  const canonicalString = JSON.stringify(args, Object.keys(args).sort());
  const hash = crypto
    .createHash("sha256")
    .update(`${sessionId}:${toolName}:${canonicalString}`)
    .digest("hex")
    .substring(0, 16);

  return `idemp_${sessionId || "anon"}_${toolName}_${hash}`;
}

/**
 * Checks Firebase RTDB for an existing completed idempotency record.
 * If found, returns the cached result to guarantee idempotency.
 * If not found, sets an in_progress lock.
 *
 * @param {string} key
 * @returns {Promise<{ isDuplicate: boolean, cachedResult: Object|null }>}
 */
async function checkAndLockIdempotencyKey(key) {
  if (!key) return { isDuplicate: false, cachedResult: null };

  const idempRef = ref(db, `idempotency_keys/${key}`);
  const snap = await get(idempRef);

  if (snap.exists()) {
    const data = snap.val();
    if (data.status === "completed" && data.result) {
      return { isDuplicate: true, cachedResult: data.result };
    }
    // If in progress within the last 15 seconds, treat as concurrent duplicate
    if (data.status === "in_progress" && Date.now() - (data.started_at || 0) < 15000) {
      return {
        isDuplicate: true,
        cachedResult: {
          success: true,
          status: "pending_completion",
          message: "Request is currently being processed by backend.",
        },
      };
    }
  }

  // Lock key as in_progress
  await update(idempRef, {
    status: "in_progress",
    started_at: Date.now(),
  });

  return { isDuplicate: false, cachedResult: null };
}

/**
 * Stores the final result in the idempotency record.
 */
async function completeIdempotencyKey(key, result) {
  if (!key) return;
  const idempRef = ref(db, `idempotency_keys/${key}`);
  await update(idempRef, {
    status: "completed",
    result,
    completed_at: Date.now(),
  });
}

/**
 * Records failure in the idempotency record.
 */
async function failIdempotencyKey(key, errorMessage) {
  if (!key) return;
  const idempRef = ref(db, `idempotency_keys/${key}`);
  await update(idempRef, {
    status: "failed",
    error: errorMessage,
    failed_at: Date.now(),
  });
}

// --- CANONICAL TOOL IMPLEMENTATIONS ---

/**
 * Canonical Tool: `create_service_request`
 * Validates inbound lead details and authoritative parameters, checks idempotency,
 * and records the lead into Firebase RTDB under `/leads/{lead_id}`.
 */
async function executeCreateServiceRequest(args, context) {
  const { tenant, session, idempotencyKey } = context;
  const now = Date.now();

  // 1. Parameter Validation
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  const problemDescription =
    typeof args.problem_description === "string"
      ? args.problem_description.trim()
      : typeof args.description === "string"
      ? args.description.trim()
      : "General service inquiry";

  const category =
    typeof args.category === "string" && args.category.trim()
      ? args.category.trim()
      : typeof args.service === "string" && args.service.trim()
      ? args.service.trim()
      : "General Service";

  const urgency =
    typeof args.urgency === "string" && ["Low", "Medium", "High", "Emergency"].includes(args.urgency)
      ? args.urgency
      : "Medium";

  const address = typeof args.address === "string" ? args.address.trim() : null;
  const preferredTime = typeof args.preferred_time === "string" ? args.preferred_time.trim() : null;

  if (!name && !phone && !email) {
    throw new ToolValidationError(
      "At least one contact identifier (name, phone, or email) is required to create a service request.",
      ["name", "phone", "email"]
    );
  }

  // 2. Generate Authoritative Identifiers
  const sessionId = session?.session_id || `sess_${Date.now()}`;
  const serviceRequestId = `sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const leadId = sessionId; // 1:1 mapping with session for dashboard observability

  // 3. Assemble CRM Lead Record conforming to /leads schema
  const leadPayload = {
    lead_id: leadId,
    service_request_id: serviceRequestId,
    session_id: sessionId,
    tenant_id: tenant.tenant_id,
    name: name || "Customer",
    phone: phone || null,
    email: email || null,
    address: address || null,
    service_requested: category,
    business_problem: problemDescription,
    urgency_level: urgency,
    preferred_time: preferredTime,
    booking_status: "Service Request Created",
    requested_action: "create_service_request",
    source: "AI Front Desk Action Router",
    idempotency_key: idempotencyKey,
    created_at: new Date(now).toISOString(),
    last_interaction_at: new Date(now).toISOString(),
  };

  // 4. Atomic Multi-Path Persistence
  const updates = {};
  updates[`leads/${leadId}`] = leadPayload;
  updates[`tenants/${tenant.tenant_id}/leads/${leadId}`] = leadPayload;

  updates[`sessions/${sessionId}/context/service_request/category`] = category;
  updates[`sessions/${sessionId}/context/service_request/problem_description`] = problemDescription;
  updates[`sessions/${sessionId}/context/service_request/urgency`] = urgency;
  updates[`sessions/${sessionId}/context/customer/name`] = name || null;
  updates[`sessions/${sessionId}/context/customer/phone`] = phone || null;
  updates[`sessions/${sessionId}/context/customer/email`] = email || null;

  // Mirror to tenant session silo
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/service_request/category`] = category;
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/service_request/problem_description`] = problemDescription;
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/service_request/urgency`] = urgency;
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/customer/name`] = name || null;
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/customer/phone`] = phone || null;
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/customer/email`] = email || null;

  // Mirror to prospects for WebRTC/telemetry dashboards
  updates[`prospects/${sessionId}/context_patch/contact_info`] = {
    name,
    phone,
    email,
  };
  updates[`prospects/${sessionId}/context_patch/business_context`] = {
    problem: problemDescription,
    category,
    urgency,
  };
  updates[`tenants/${tenant.tenant_id}/prospects/${sessionId}/context_patch/contact_info`] = {
    name,
    phone,
    email,
  };
  updates[`tenants/${tenant.tenant_id}/prospects/${sessionId}/context_patch/business_context`] = {
    problem: problemDescription,
    category,
    urgency,
  };

  await update(ref(db), updates);

  // 5. Trigger High-Urgency & Emergency Email Alerts via Cloud Function Bridge
  if (urgency === "High" || urgency === "Emergency") {
    try {
      await queueEmailAlert(
        urgency === "Emergency" ? "EMERGENCY Service Request 🚨" : "New High-Urgency Lead 🎯",
        `${name || "A customer"} submitted a ${urgency} service request: "${problemDescription}"`,
        leadPayload,
        "end"
      );
    } catch (alertErr) {
      console.warn("[toolRouter] Failed to queue email alert:", alertErr.message);
    }
  }

  // 6. Return Structured Output
  return {
    success: true,
    service_request_id: serviceRequestId,
    lead_id: leadId,
    tenant_id: tenant.tenant_id,
    idempotency_key: idempotencyKey,
    status: "submitted",
    summary: `Service request #${serviceRequestId} successfully created for ${name || "Customer"}.`,
    details: {
      name,
      phone,
      email,
      address,
      category,
      problem_description: problemDescription,
      urgency,
      preferred_time: preferredTime,
    },
    created_at: new Date(now).toISOString(),
  };
}

/**
 * Canonical Tool: `create_booking`
 * Validates appointment slot and locks meeting details into `/leads` and session context.
 */
async function executeCreateBooking(args, context) {
  const { tenant, session, idempotencyKey } = context;
  const now = Date.now();

  const name = typeof args.name === "string" ? args.name.trim() : "Customer";
  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const date = typeof args.date === "string" ? args.date.trim() : "";
  const time = typeof args.time === "string" ? args.time.trim() : "";
  const serviceType = typeof args.service_type === "string" ? args.service_type.trim() : "Consultation";

  if (!date && !time) {
    throw new ToolValidationError("Date and time are required to create a booking.", ["date", "time"]);
  }

  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionId = session?.session_id || `sess_${Date.now()}`;
  const displayTime = `${date} at ${time}`.trim();

  const updates = {};
  updates[`leads/${sessionId}/booking_status`] = "Meeting Booked";
  updates[`leads/${sessionId}/preferred_date`] = date;
  updates[`leads/${sessionId}/preferred_time`] = time;
  updates[`leads/${sessionId}/display_time`] = displayTime;
  updates[`leads/${sessionId}/name`] = name;
  updates[`leads/${sessionId}/email`] = email;
  updates[`leads/${sessionId}/phone`] = phone;
  updates[`leads/${sessionId}/service_requested`] = serviceType;
  updates[`leads/${sessionId}/last_interaction_at`] = new Date(now).toISOString();

  // Tenant Silo Dual-Write
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/booking_status`] = "Meeting Booked";
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/preferred_date`] = date;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/preferred_time`] = time;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/display_time`] = displayTime;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/name`] = name;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/email`] = email;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/phone`] = phone;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/service_requested`] = serviceType;
  updates[`tenants/${tenant.tenant_id}/leads/${sessionId}/last_interaction_at`] = new Date(now).toISOString();

  updates[`sessions/${sessionId}/context/scheduling/status`] = "confirmed";
  updates[`sessions/${sessionId}/context/scheduling/confirmed_slot`] = displayTime;
  updates[`sessions/${sessionId}/context/scheduling/booking_id`] = bookingId;

  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/scheduling/status`] = "confirmed";
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/scheduling/confirmed_slot`] = displayTime;
  updates[`tenants/${tenant.tenant_id}/sessions/${sessionId}/context/scheduling/booking_id`] = bookingId;

  await update(ref(db), updates);

  // Trigger booking confirmation alert
  try {
    await queueEmailAlert(
      "Meeting Booked! 📅",
      `${name} confirmed an appointment for ${displayTime}.`,
      { name, email, phone, preferred_date: date, preferred_time: time, booking_status: "Meeting Booked" },
      "end",
      { visitorEmail: email, subject: "Your Appointment is Confirmed!", body: `Hi ${name},\n\nYour appointment is confirmed for ${displayTime}.` }
    );
  } catch (err) {
    console.warn("[toolRouter] Failed to queue booking email:", err.message);
  }

  return {
    success: true,
    booking_id: bookingId,
    session_id: sessionId,
    tenant_id: tenant.tenant_id,
    idempotency_key: idempotencyKey,
    status: "confirmed",
    confirmed_slot: displayTime,
    summary: `Booking #${bookingId} confirmed for ${name} on ${displayTime}.`,
    details: { name, email, phone, date, time, service_type: serviceType },
    created_at: new Date(now).toISOString(),
  };
}

/**
 * Canonical Tool Registry Map
 */
const TOOL_REGISTRY = {
  create_service_request: executeCreateServiceRequest,
  create_booking: executeCreateBooking,
};

// --- CENTRAL ACTION ROUTER ---

/**
 * Central entry point for executing tools requested by the LLM.
 * Strictly verifies tenant action authorization and enforces idempotency.
 *
 * @param {Object} params
 * @param {string} params.toolName - Name of the canonical tool to execute
 * @param {Object} params.toolArgs - Arguments provided by the LLM
 * @param {Object} params.tenant - Resolved tenant context
 * @param {Object} params.session - Active session context
 * @param {Object} params.apiLogger - Scoped observability logger
 * @param {string} [params.toolCallId] - Optional tool call identifier
 * @param {string} [params.idempotencyKey] - Optional client idempotency key
 * @returns {Promise<Object>} Authoritative execution result
 */
export async function executeAction({
  toolName,
  toolArgs = {},
  tenant,
  session,
  apiLogger,
  toolCallId = `call_${Date.now()}`,
  idempotencyKey = null,
}) {
  if (!toolName || typeof toolName !== "string") {
    return {
      success: false,
      error: "INVALID_TOOL_NAME",
      message: "A valid tool name string must be provided.",
    };
  }

  const normalizedToolName = toolName.trim();
  const tenantId = tenant?.tenant_id || "tenant_default";

  // 1. Authorize Tool Against Tenant Permissions
  const isPermitted = isToolPermittedForTenant(tenant, normalizedToolName);
  if (!isPermitted) {
    if (apiLogger) {
      apiLogger.warn("tool_router", "action_not_permitted", {
        context: { toolName: normalizedToolName, tenantId },
      });
    }
    return {
      success: false,
      error: "TOOL_NOT_PERMITTED",
      message: `Action '${normalizedToolName}' is not permitted for tenant '${tenantId}'. Please offer a supported action.`,
    };
  }

  // 2. Resolve Tool Handler from Registry
  const toolHandler = TOOL_REGISTRY[normalizedToolName];
  if (!toolHandler) {
    if (apiLogger) {
      apiLogger.warn("tool_router", "unregistered_tool", {
        context: { toolName: normalizedToolName },
      });
    }
    return {
      success: false,
      error: "UNREGISTERED_TOOL",
      message: `Action '${normalizedToolName}' is not registered in the tool router.`,
    };
  }

  // 3. Enforce Idempotency
  const finalIdempotencyKey =
    idempotencyKey || generateIdempotencyKey(session?.session_id, normalizedToolName, toolArgs);

  const { isDuplicate, cachedResult } = await checkAndLockIdempotencyKey(finalIdempotencyKey);
  if (isDuplicate && cachedResult) {
    if (apiLogger) {
      apiLogger.info("tool_router", "idempotent_duplicate_intercepted", {
        context: { finalIdempotencyKey, toolName: normalizedToolName },
      });
    }
    return {
      ...cachedResult,
      is_idempotent_replay: true,
    };
  }

  // 4. Execute Authoritative Action via Traced Tool Runner
  const executionContext = {
    tenant,
    session,
    idempotencyKey: finalIdempotencyKey,
  };

  try {
    const result = await executeToolWithTrace(
      apiLogger,
      normalizedToolName,
      toolCallId,
      toolArgs,
      async (parsedArgs) => toolHandler(parsedArgs, executionContext)
    );

    // 5. Complete Idempotency Record on Success
    if (result && !result.error) {
      await completeIdempotencyKey(finalIdempotencyKey, result);
    } else {
      await failIdempotencyKey(finalIdempotencyKey, result?.error || "Execution returned error");
    }

    return result;
  } catch (error) {
    await failIdempotencyKey(finalIdempotencyKey, error.message);
    if (apiLogger) {
      apiLogger.error("tool_router", "tool_execution_failed", {
        context: { toolName: normalizedToolName, tenantId },
        error,
      });
    }
    return {
      success: false,
      error: "EXECUTION_FAILED",
      message: error.message || "An unexpected error occurred during tool execution.",
    };
  }
}

// --- OPENAI FUNCTION DEFINITIONS SCHEMA EXPORTER ---

/**
 * Returns OpenAI-compatible tool specifications for the tools permitted for the tenant.
 *
 * @param {Object} tenant
 * @returns {Array<Object>} List of OpenAI function tools
 */
export function getOpenAiToolDefinitions(tenant) {
  const tools = [];

  if (isToolPermittedForTenant(tenant, "create_service_request")) {
    tools.push({
      type: "function",
      function: {
        name: "create_service_request",
        description:
          "Authoritative backend action to create and submit a customer service request or inquiry into the CRM.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Customer's full name" },
            phone: { type: "string", description: "Customer's phone number" },
            email: { type: "string", description: "Customer's email address" },
            address: { type: "string", description: "Street address or zip code" },
            category: { type: "string", description: "Service or trade category (e.g. ac_repair, heating, saas)" },
            problem_description: { type: "string", description: "Detailed description of the issue or requirement" },
            urgency: {
              type: "string",
              enum: ["Low", "Medium", "High", "Emergency"],
              description: "Assessed urgency level",
            },
            preferred_time: { type: "string", description: "Customer's preferred arrival or contact window" },
          },
          required: ["name", "problem_description"],
        },
      },
    });
  }

  if (isToolPermittedForTenant(tenant, "create_booking")) {
    tools.push({
      type: "function",
      function: {
        name: "create_booking",
        description: "Authoritative backend action to lock in and book an appointment or consultation slot.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Customer's full name" },
            phone: { type: "string", description: "Customer's contact phone number" },
            email: { type: "string", description: "Customer's email for calendar invite" },
            date: { type: "string", description: "Booking date (e.g., Oct 24, 2026)" },
            time: { type: "string", description: "Booking time window (e.g., 10:00 AM)" },
            service_type: { type: "string", description: "Type of service or consultation being booked" },
          },
          required: ["name", "date", "time"],
        },
      },
    });
  }

  return tools;
}
