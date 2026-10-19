// src/lib/sessionService.js
/**
 * ============================================================================
 * CloseDesk Multi-Tenant Platform — Session Management Service
 * ============================================================================
 * Phase 1: Multi-Tenant Foundation (Section 8 Architecture Conformance)
 * 
 * Responsibilities:
 * 1. Initializes stateful conversational sessions bound to an active tenant.
 * 2. Conforms strictly to the Section 8 unified session schema.
 * 3. Enforces tenant validation via `tenantResolver` before session creation.
 * 4. Manages state machine progression (GREETING -> INTAKE -> QUALIFYING -> SCHEDULING -> etc.).
 * 5. Persists dialogue history, context patches, and execution telemetry in Firebase RTDB.
 * 6. Maintains dual-index indexing: `/sessions/{id}` and `/tenants/{tenant_id}/sessions/{id}`.
 */

import { db } from "./firebase.js";
import { ref, set, get, update, child, query, limitToLast, orderByChild } from "firebase/database";
import { resolveTenant } from "./tenantResolver.js";
import crypto from "crypto";

// --- SESSION STATE ENUMS ---

export const SESSION_STATES = {
  GREETING: "GREETING",
  INTAKE: "INTAKE",
  EMERGENCY_TRIAGE: "EMERGENCY_TRIAGE",
  QUALIFYING: "QUALIFYING",
  SCHEDULING: "SCHEDULING",
  CONFIRMED: "CONFIRMED",
  ESCALATED: "ESCALATED",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
};

export const SESSION_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  ESCALATED: "escalated",
};

export const SUPPORTED_CHANNELS = ["chat", "voice", "sms", "whatsapp", "web"];

// --- CUSTOM ERROR DEFINITIONS ---

export class SessionNotFoundError extends Error {
  constructor(sessionId) {
    super(`Session not found: '${sessionId}' does not exist.`);
    this.name = "SessionNotFoundError";
    this.code = "SESSION_NOT_FOUND";
    this.statusCode = 404;
    this.sessionId = sessionId;
  }
}

export class SessionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionValidationError";
    this.code = "SESSION_VALIDATION_ERROR";
    this.statusCode = 400;
  }
}

// --- HELPER UTILITIES ---

/**
 * Generates a collision-resistant, chronologically sortable session ID.
 * Format: sess_{epoch_ms}_{crypto_hex}
 */
export function generateSessionId() {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  return `sess_${timestamp}_${randomSuffix}`;
}

/**
 * Validates channel parameter.
 */
function normalizeChannel(channel) {
  if (!channel || typeof channel !== "string") return "chat";
  const normalized = channel.trim().toLowerCase();
  if (!SUPPORTED_CHANNELS.includes(normalized)) {
    throw new SessionValidationError(
      `Unsupported channel '${channel}'. Allowed channels: ${SUPPORTED_CHANNELS.join(", ")}`
    );
  }
  return normalized;
}

// --- CORE SESSION SERVICE METHODS ---

/**
 * Initializes a new conversation session conforming strictly to the Section 8 architecture spec.
 *
 * @param {Object} params
 * @param {string} params.tenantId - The tenant to which this session belongs
 * @param {string} [params.channel="chat"] - Communication channel ("chat", "voice", "sms", "whatsapp", "web")
 * @param {Object} [params.initialContext={}] - Pre-populated context data (e.g. caller ID, pre-selected service)
 * @param {Object} [params.metadata={}] - Technical telemetry (userAgent, ipHash, referrer, etc.)
 * @param {string} [params.customSessionId=null] - Optional override session ID
 * @returns {Promise<Object>} The newly created session record
 */
export async function initializeSession(params) {
  const {
    tenantId,
    channel = "chat",
    initialContext = {},
    metadata = {},
    customSessionId = null,
  } = params || {};

  if (!tenantId || typeof tenantId !== "string") {
    throw new SessionValidationError("A valid tenantId is required to initialize a session.");
  }

  // 1. Verify Tenant is Active (throws TenantNotFoundError / TenantDisabledError if invalid)
  const tenantContext = await resolveTenant(tenantId);
  const effectiveConfig = tenantContext.effective_config || {};

  const normalizedChannel = normalizeChannel(channel);
  const sessionId = customSessionId || generateSessionId();
  const now = Date.now();

  // 2. Build Unified Section 8 Conforming Session Record
  const newSessionRecord = {
    session_id: sessionId,
    tenant_id: tenantId,
    channel: normalizedChannel,
    status: SESSION_STATUS.ACTIVE,
    current_state: SESSION_STATES.GREETING,

    // Context Graph (Lead, Problem, Qualification, Scheduling)
    context: {
      customer: {
        name: initialContext.customer?.name || null,
        phone: initialContext.customer?.phone || null,
        email: initialContext.customer?.email || null,
        address: initialContext.customer?.address || null,
        is_homeowner: initialContext.customer?.is_homeowner ?? null,
      },
      service_request: {
        category: initialContext.service_request?.category || null,
        problem_description: initialContext.service_request?.problem_description || null,
        urgency: initialContext.service_request?.urgency || "Low", // Low | Medium | High | Emergency
        equipment_type: initialContext.service_request?.equipment_type || null,
        is_emergency: Boolean(initialContext.service_request?.is_emergency),
        photos: initialContext.service_request?.photos || [],
      },
      scheduling: {
        requested_time: initialContext.scheduling?.requested_time || null,
        confirmed_slot: null,
        booking_id: null,
        status: "pending", // pending | confirmed | unavailable | cancelled
      },
      pricing_quoted: {
        diagnostic_fee: effectiveConfig.pricing?.diagnostic_fee ?? null,
        estimate: null,
        currency: effectiveConfig.pricing?.currency || "USD",
        fee_waived_with_repair: Boolean(effectiveConfig.pricing?.waive_diagnostic_with_repair),
      },
      qualification_answers: initialContext.qualification_answers || {},
    },

    // Conversation Transcripts / Turns
    history: [],

    // Operational & Latency Telemetry
    telemetry: {
      turn_count: 0,
      tools_executed: [],
      voice_latency_ms: [],
      started_at: now,
      last_interaction_at: now,
    },

    // Technical & Audit Metadata
    metadata: {
      user_agent: metadata.userAgent || null,
      ip_hash: metadata.ipHash || null,
      referrer: metadata.referrer || null,
      industry_pack_id: tenantContext.industry_pack_id || null,
      environment: process.env.NODE_ENV || "development",
      ...metadata,
    },

    created_at: now,
    updated_at: now,
  };

  // 3. Atomic Multi-Path Persistence in Firebase RTDB
  const updates = {};
  updates[`sessions/${sessionId}`] = newSessionRecord;
  // Multi-tenant fast lookup index
  updates[`tenants/${tenantId}/sessions/${sessionId}`] = {
    created_at: now,
    channel: normalizedChannel,
    status: SESSION_STATUS.ACTIVE,
  };

  try {
    await update(ref(db), updates);
  } catch (error) {
    console.error(`[sessionService] Failed to write session '${sessionId}':`, error);
    throw new Error(`Failed to initialize session in database: ${error.message}`);
  }

  return newSessionRecord;
}

/**
 * Retrieves a session by its sessionId.
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
export async function getSession(sessionId) {
  if (!sessionId || typeof sessionId !== "string") {
    throw new SessionValidationError("A valid sessionId string is required.");
  }

  const sessionRef = ref(db, `sessions/${sessionId}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    throw new SessionNotFoundError(sessionId);
  }

  return snapshot.val();
}

/**
 * Updates a session's state machine position, context fields, and metadata.
 *
 * @param {string} sessionId - The session identifier
 * @param {Object} patch
 * @param {string} [patch.currentState] - Next state machine state (from SESSION_STATES)
 * @param {string} [patch.status] - Next lifecycle status (from SESSION_STATUS)
 * @param {Object} [patch.contextPatch] - Partial context updates to merge
 * @param {Object} [patch.telemetryPatch] - Telemetry updates (e.g. latency, tools called)
 * @returns {Promise<Object>} Updated fields
 */
export async function updateSessionState(sessionId, patch = {}) {
  const { currentState, status, contextPatch, telemetryPatch } = patch;
  const now = Date.now();

  const updates = {
    [`sessions/${sessionId}/updated_at`]: now,
    [`sessions/${sessionId}/telemetry/last_interaction_at`]: now,
  };

  if (currentState) {
    updates[`sessions/${sessionId}/current_state`] = currentState;
  }

  if (status) {
    updates[`sessions/${sessionId}/status`] = status;
  }

  // Update customer context
  if (contextPatch) {
    if (contextPatch.customer) {
      for (const [key, val] of Object.entries(contextPatch.customer)) {
        if (val !== undefined) {
          updates[`sessions/${sessionId}/context/customer/${key}`] = val;
        }
      }
    }
    if (contextPatch.service_request) {
      for (const [key, val] of Object.entries(contextPatch.service_request)) {
        if (val !== undefined) {
          updates[`sessions/${sessionId}/context/service_request/${key}`] = val;
        }
      }
    }
    if (contextPatch.scheduling) {
      for (const [key, val] of Object.entries(contextPatch.scheduling)) {
        if (val !== undefined) {
          updates[`sessions/${sessionId}/context/scheduling/${key}`] = val;
        }
      }
    }
    if (contextPatch.pricing_quoted) {
      for (const [key, val] of Object.entries(contextPatch.pricing_quoted)) {
        if (val !== undefined) {
          updates[`sessions/${sessionId}/context/pricing_quoted/${key}`] = val;
        }
      }
    }
    if (contextPatch.qualification_answers) {
      for (const [key, val] of Object.entries(contextPatch.qualification_answers)) {
        if (val !== undefined) {
          updates[`sessions/${sessionId}/context/qualification_answers/${key}`] = val;
        }
      }
    }
  }

  if (telemetryPatch) {
    if (Array.isArray(telemetryPatch.tools_executed)) {
      updates[`sessions/${sessionId}/telemetry/tools_executed`] = telemetryPatch.tools_executed;
    }
  }

  await update(ref(db), updates);
  return updates;
}

/**
 * Appends a message turn to the session transcript and increments the turn count.
 *
 * @param {string} sessionId
 * @param {Object} message - { role: "user" | "assistant" | "system", content: string, channelMetadata: {} }
 */
export async function appendSessionMessage(sessionId, message) {
  if (!sessionId) throw new SessionValidationError("sessionId is required.");
  if (!message || !message.role || !message.content) {
    throw new SessionValidationError("Valid message with 'role' and 'content' is required.");
  }

  const session = await getSession(sessionId);
  const currentHistory = Array.isArray(session.history) ? session.history : [];
  const currentTurnCount = session.telemetry?.turn_count || 0;
  const now = Date.now();

  const formattedMessage = {
    role: message.role,
    content: message.content,
    timestamp: now,
    channel_metadata: message.channelMetadata || null,
  };

  const updatedHistory = [...currentHistory, formattedMessage];

  const updates = {
    [`sessions/${sessionId}/history`]: updatedHistory,
    [`sessions/${sessionId}/telemetry/turn_count`]: currentTurnCount + 1,
    [`sessions/${sessionId}/telemetry/last_interaction_at`]: now,
    [`sessions/${sessionId}/updated_at`]: now,
  };

  await update(ref(db), updates);
  return formattedMessage;
}

/**
 * Escalates a session to a human operator or external emergency dispatch.
 *
 * @param {string} sessionId
 * @param {Object} params
 * @param {string} params.reason - Reason for escalation (e.g. "gas_emergency", "unresponsive_bot", "customer_demand")
 * @param {string} [params.urgency="High"] - Urgency rating
 * @param {Object} [params.escalationData={}] - Contact info, notification payload
 */
export async function escalateSession(sessionId, params = {}) {
  const { reason = "user_requested", urgency = "High", escalationData = {} } = params;
  const now = Date.now();

  const updates = {
    [`sessions/${sessionId}/status`]: SESSION_STATUS.ESCALATED,
    [`sessions/${sessionId}/current_state`]: SESSION_STATES.ESCALATED,
    [`sessions/${sessionId}/context/service_request/urgency`]: urgency,
    [`sessions/${sessionId}/context/escalation`]: {
      reason,
      urgency,
      escalated_at: now,
      metadata: escalationData,
    },
    [`sessions/${sessionId}/updated_at`]: now,
  };

  await update(ref(db), updates);
  return updates;
}

/**
 * Gracefully terminates a session.
 *
 * @param {string} sessionId
 * @param {string} [status="completed"] - One of SESSION_STATUS
 * @param {string} [reason="normal_completion"]
 */
export async function terminateSession(sessionId, status = SESSION_STATUS.COMPLETED, reason = "normal_completion") {
  const now = Date.now();

  const updates = {
    [`sessions/${sessionId}/status`]: status,
    [`sessions/${sessionId}/current_state`]: status === SESSION_STATUS.COMPLETED ? SESSION_STATES.COMPLETED : SESSION_STATES.ABANDONED,
    [`sessions/${sessionId}/termination_reason`]: reason,
    [`sessions/${sessionId}/updated_at`]: now,
  };

  await update(ref(db), updates);
  return updates;
}
