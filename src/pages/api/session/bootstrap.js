// src/pages/api/session/bootstrap.js
/**
 * ============================================================================
 * CloseDesk Multi-Tenant Platform — Session Bootstrap API Boundary
 * ============================================================================
 * Phase 1: Multi-Tenant Foundation
 * 
 * Responsibilities:
 * 1. Validates inbound `tenant_id` and `channel` from frontend client.
 * 2. Uses `tenantResolver.js` to ensure tenant exists, is active, and loads config.
 * 3. Uses `sessionService.js` to initialize a stateful session in Firebase RTDB.
 * 4. Mints a cryptographically secure `session_token` (UUIDv4) and maps it to the session.
 * 5. Returns dynamic business welcome message and sanitized, safe client configuration.
 * 6. Strips all tenant secrets (API keys, SMTP passwords, OAuth refresh tokens).
 * 7. Wraps execution with `withApiLogger` for SOC2-compliant distributed audit tracing.
 */

import crypto from "crypto";
import { db } from "../../../lib/firebase.js";
import { ref, update } from "firebase/database";
import {
  resolveTenant,
  TenantNotFoundError,
  TenantDisabledError,
} from "../../../lib/tenantResolver.js";
import {
  initializeSession,
  SESSION_STATES,
} from "../../../lib/sessionService.js";
import { withApiLogger } from "../../../lib/apiMiddleware.js";

/**
 * Constructs a dynamic, personalized welcome message based on tenant settings.
 */
function buildWelcomeMessage(tenant) {
  const config = tenant.client_config || {};
  const persona = config.ai_persona || {};
  const businessName = config.business_name || tenant.name || "our team";

  // Check for explicit custom greeting configured in the tenant profile
  if (persona.greeting_message && typeof persona.greeting_message === "string") {
    return persona.greeting_message.trim();
  }
  if (config.greeting_message && typeof config.greeting_message === "string") {
    return config.greeting_message.trim();
  }

  // Dynamic context-aware greeting
  const isEmergencyActive = Boolean(config.emergency_rules?.supports_24_7_dispatch);
  if (isEmergencyActive) {
    return `Hi! Welcome to ${businessName}. How can we help your home stay comfortable today? We offer 24/7 service if you have an urgent issue.`;
  }

  return `Hello! Welcome to ${businessName}. How can our team assist you today?`;
}

/**
 * Projects strictly public and client-safe fields from the tenant configuration.
 * Guarantees zero leakage of secrets, webhook tokens, or backend credentials.
 */
function projectSafeClientConfig(tenant) {
  const config = tenant.client_config || {};
  const persona = config.ai_persona || {};
  const effectivePricing = tenant.effective_config?.pricing || config.pricing || {};

  return {
    business_name: config.business_name || tenant.name || "CloseDesk Concierge",
    tagline: config.tagline || null,
    phone: config.phone || null,
    operating_hours: config.operating_hours || null,
    services_offered: config.services_offered || tenant.effective_config?.services || [],
    pricing: {
      diagnostic_fee: effectivePricing.diagnostic_fee ?? null,
      waive_diagnostic_with_repair: Boolean(effectivePricing.waive_diagnostic_with_repair),
      currency: effectivePricing.currency || "USD",
    },
    ai_persona: {
      bot_name: persona.name || "AI Front Desk",
      bot_avatar: persona.avatar_url || "/avatars/ai-spark.svg",
      bot_voice: persona.voice || "ash",
      voice_enabled: persona.voice_enabled !== false,
      tone: persona.tone || "Professional and warm",
    },
  };
}

async function handler(req, res, apiLogger) {
  // 1. Enforce POST Method
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
      message: `HTTP ${req.method} is not supported on this endpoint. Use POST.`,
    });
  }

  const { tenant_id, channel = "chat", initial_context = {}, metadata = {} } = req.body || {};

  // 2. Validate Inbound Tenant Identifier
  if (!tenant_id || typeof tenant_id !== "string" || tenant_id.trim() === "") {
    apiLogger.warn("validation", "missing_tenant_id", {
      context: { body_keys: Object.keys(req.body || {}) },
    });
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "A non-empty 'tenant_id' string is required in the request body.",
    });
  }

  const sanitizedTenantId = tenant_id.trim();

  try {
    // 3. Resolve & Validate Tenant via tenantResolver (with in-memory caching)
    const tenant = await resolveTenant(sanitizedTenantId, { includeSecrets: false });

    // 4. Capture Client Request Telemetry for SOC2 / Audit Trails
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex").substring(0, 12);
    const userAgent = req.headers["user-agent"] || "unknown";

    const sessionMetadata = {
      ipHash,
      userAgent,
      referrer: req.headers["referer"] || null,
      origin: req.headers["origin"] || null,
      ...metadata,
    };

    // 5. Initialize Stateful Session in Firebase RTDB conforming to Section 8 spec
    const sessionRecord = await initializeSession({
      tenantId: tenant.tenant_id,
      channel,
      initialContext: initial_context,
      metadata: sessionMetadata,
    });

    // 6. Generate Cryptographically Secure Session Token (UUIDv4)
    const sessionToken = crypto.randomUUID();
    const tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours validity

    // Store token binding in RTDB for fast auth validation on subsequent chat/voice turns
    const tokenUpdates = {};
    tokenUpdates[`sessions/${sessionRecord.session_id}/session_token`] = sessionToken;
    tokenUpdates[`sessions/${sessionRecord.session_id}/token_expires_at`] = tokenExpiresAt;
    tokenUpdates[`session_tokens/${sessionToken}`] = {
      session_id: sessionRecord.session_id,
      tenant_id: tenant.tenant_id,
      created_at: Date.now(),
      expires_at: tokenExpiresAt,
    };

    await update(ref(db), tokenUpdates);

    // 7. Compose Dynamic Welcome Message & Safe Client Configuration
    const welcomeMessage = buildWelcomeMessage(tenant);
    const safeClientConfig = projectSafeClientConfig(tenant);

    apiLogger.info("session_lifecycle", "session_bootstrapped", {
      context: {
        session_id: sessionRecord.session_id,
        tenant_id: tenant.tenant_id,
        channel: sessionRecord.channel,
        industry_pack_id: tenant.industry_pack_id,
      },
    });

    // 8. Return Secure Response (Zero Secrets Exposure)
    return res.status(201).json({
      success: true,
      session_id: sessionRecord.session_id,
      session_token: sessionToken,
      token_expires_at: tokenExpiresAt,
      welcome_message: welcomeMessage,
      current_state: SESSION_STATES.GREETING,
      client_config: safeClientConfig,
      industry_pack_id: tenant.industry_pack_id,
    });
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      apiLogger.warn("tenant_resolution", "tenant_not_found", {
        context: { tenant_id: sanitizedTenantId },
      });
      return res.status(404).json({
        success: false,
        error: "Tenant Not Found",
        message: `No active tenant matches identifier '${sanitizedTenantId}'.`,
        code: error.code,
      });
    }

    if (error instanceof TenantDisabledError) {
      apiLogger.warn("tenant_resolution", "tenant_disabled", {
        context: { tenant_id: sanitizedTenantId, status: error.status },
      });
      return res.status(403).json({
        success: false,
        error: "Tenant Disabled",
        message: `The organization associated with '${sanitizedTenantId}' is currently inactive.`,
        code: error.code,
      });
    }

    apiLogger.error("session_bootstrap", "unhandled_bootstrap_error", {
      context: { tenant_id: sanitizedTenantId },
      error,
    });

    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "An unexpected error occurred while initializing the session. Please try again.",
    });
  }
}

// Export wrapped with SOC2-compliant observability middleware
export default withApiLogger(handler, "SessionBootstrapAPI");
