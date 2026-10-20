// src/pages/api/analytics.js
import { ref, runTransaction, push, update, set } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase";

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      event_type,
      anonId = "unknown_visitor",
      pagePath = "/",
      details = "",
      deviceName = "Unknown Device",
      username = "Visitor",
      tenant_id = req.headers["x-tenant-id"] || "tenant_aicyro",
    } = req.body || {};

    const sanitizedTenantId = (tenant_id && typeof tenant_id === "string")
      ? tenant_id.trim()
      : "tenant_aicyro";

    // 1. Map incoming events to Global & Tenant Summary field names
    let summaryField = "";
    let visitorCounterField = "";

    if (event_type === "page_view") {
      summaryField = "total_website_visitors";
      visitorCounterField = "visits_count";
    } else if (event_type === "chatbot_opened") {
      summaryField = "total_chatbot_opens";
      visitorCounterField = "chat_opens_count";
    } else if (event_type === "conversation_started") {
      summaryField = "total_conversations_started";
      visitorCounterField = "conversations_count";
    } else {
      return res.status(400).json({ error: "Invalid tracking event type" });
    }

    // Generate explicit time and date fields
    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split("T")[0]; // e.g., "2026-10-19"
    const time = now.toTimeString().split(" ")[0]; // e.g., "13:07:51"

    const eventPayload = {
      event_type,
      pagePath,
      details,
      timestamp,
      date,
      time,
      tenant_id: sanitizedTenantId,
    };

    const profilePayload = {
      anonId,
      username,
      deviceName,
      lastActiveAt: timestamp,
      lastVisitedPage: pagePath,
      tenant_id: sanitizedTenantId,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // A. Increment Global Platform & Tenant Summary Counters (Dual-Write)
    // ──────────────────────────────────────────────────────────────────────────
    const globalSummaryRef = ref(db, `analytics/summary/${summaryField}`);
    const tenantSummaryRef = ref(db, `tenants/${sanitizedTenantId}/analytics/summary/${summaryField}`);

    await Promise.all([
      runTransaction(globalSummaryRef, (currentValue) => (currentValue || 0) + 1),
      runTransaction(tenantSummaryRef, (currentValue) => (currentValue || 0) + 1),
    ]);

    // ──────────────────────────────────────────────────────────────────────────
    // B. Log Individual Chronological Event for this specific visitor (Dual-Write)
    // ──────────────────────────────────────────────────────────────────────────
    const globalVisitorEventsRef = ref(db, `analytics/visitors/${anonId}/events`);
    const tenantVisitorEventsRef = ref(db, `tenants/${sanitizedTenantId}/analytics/visitors/${anonId}/events`);

    const newGlobalEventRef = push(globalVisitorEventsRef);
    const newTenantEventRef = push(tenantVisitorEventsRef);

    await Promise.all([
      set(newGlobalEventRef, { ...eventPayload, event_id: newGlobalEventRef.key }),
      set(newTenantEventRef, { ...eventPayload, event_id: newTenantEventRef.key }),
    ]);

    // ──────────────────────────────────────────────────────────────────────────
    // C. Update Individual Visitor Profile & Summary Counters (Dual-Write)
    // ──────────────────────────────────────────────────────────────────────────
    const globalVisitorSummaryRef = ref(
      db,
      `analytics/visitors/${anonId}/summary/${visitorCounterField}`,
    );
    const tenantVisitorSummaryRef = ref(
      db,
      `tenants/${sanitizedTenantId}/analytics/visitors/${anonId}/summary/${visitorCounterField}`,
    );

    await Promise.all([
      runTransaction(globalVisitorSummaryRef, (currentVal) => (currentVal || 0) + 1),
      runTransaction(tenantVisitorSummaryRef, (currentVal) => (currentVal || 0) + 1),
    ]);

    // Update profile metadata
    const globalVisitorMetaRef = ref(db, `analytics/visitors/${anonId}/profile`);
    const tenantVisitorMetaRef = ref(db, `tenants/${sanitizedTenantId}/analytics/visitors/${anonId}/profile`);

    await Promise.all([
      update(globalVisitorMetaRef, profilePayload),
      update(tenantVisitorMetaRef, profilePayload),
    ]);

    return res.status(200).json({ success: true, tenant_id: sanitizedTenantId });
  } catch (error) {
    apiLogger.error("Firebase Analytics Write Error:", error);
    return res.status(500).json({ error: "Internal tracking server error" });
  }
}

export default withApiLogger(handler, "Analytics-API");
