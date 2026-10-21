// src/pages/api/analytics.js
import { ref, runTransaction, push, update, set, get } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase";
import { resolveTenantId } from "../../lib/tenantResolver";

async function handler(req, res, apiLogger) {
  // ──────────────────────────────────────────────────────────────────────────
  // GET: Fetch analytics summary (Scoped by tenant or platform)
  // ──────────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const tenantId = resolveTenantId(req);
      const isTenant = tenantId && tenantId !== "default";
      const summaryPath = isTenant
        ? `tenants/${tenantId}/analytics/summary`
        : "analytics/summary";

      let snapshot = await get(ref(db, summaryPath));
      if (!snapshot.exists() && isTenant) {
        snapshot = await get(ref(db, "analytics/summary"));
      }

      return res.status(200).json(snapshot.exists() ? snapshot.val() : {});
    } catch (err) {
      apiLogger.error("Failed to fetch analytics summary:", err);
      return res.status(500).json({ error: "Failed to fetch analytics" });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST: Record Tracking Event (Multi-Tenant Scoped)
  // ──────────────────────────────────────────────────────────────────────────
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
      hostUrl = "",
      referrer = "Direct",
    } = req.body || {};

    // 1. Resolve Tenant Context
    const tenantId = resolveTenantId(req) || req.body?.tenant_id || "default";
    const isTenantScoped = tenantId && tenantId !== "default";

    // 2. Map incoming event types
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

    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0];

    // ──────────────────────────────────────────────────────────────────────────
    // A. Update Tenant-Scoped Partition (If Multi-Tenant)
    // ──────────────────────────────────────────────────────────────────────────
    if (isTenantScoped) {
      // 1. Tenant Summary Counter
      const tenantSummaryRef = ref(
        db,
        `tenants/${tenantId}/analytics/summary/${summaryField}`
      );
      await runTransaction(tenantSummaryRef, (currentVal) => {
        return (currentVal || 0) + 1;
      });

      // 2. Tenant Visitor Chronological Event
      const tenantVisitorEventsRef = ref(
        db,
        `tenants/${tenantId}/analytics/visitors/${anonId}/events`
      );
      const tenantEventRef = push(tenantVisitorEventsRef);
      await set(tenantEventRef, {
        event_id: tenantEventRef.key,
        event_type,
        pagePath,
        hostUrl,
        referrer,
        details,
        timestamp,
        date,
        time,
        tenant_id: tenantId,
      });

      // 3. Tenant Visitor Individual Counter
      const tenantVisitorCounterRef = ref(
        db,
        `tenants/${tenantId}/analytics/visitors/${anonId}/summary/${visitorCounterField}`
      );
      await runTransaction(tenantVisitorCounterRef, (currentVal) => {
        return (currentVal || 0) + 1;
      });

      // 4. Tenant Visitor Profile Metadata
      const tenantVisitorMetaRef = ref(
        db,
        `tenants/${tenantId}/analytics/visitors/${anonId}/profile`
      );
      await update(tenantVisitorMetaRef, {
        anonId,
        username,
        deviceName,
        hostUrl,
        lastActiveAt: timestamp,
        lastVisitedPage: pagePath,
        tenant_id: tenantId,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // B. Update Global Platform Summary (Shared Cross-Tenant Metrics)
    // ──────────────────────────────────────────────────────────────────────────
    const globalSummaryRef = ref(db, `analytics/summary/${summaryField}`);
    await runTransaction(globalSummaryRef, (currentValue) => {
      return (currentValue || 0) + 1;
    });

    const globalVisitorEventsRef = ref(db, `analytics/visitors/${anonId}/events`);
    const newGlobalEventRef = push(globalVisitorEventsRef);
    await set(newGlobalEventRef, {
      event_id: newGlobalEventRef.key,
      event_type,
      pagePath,
      hostUrl,
      referrer,
      details,
      timestamp,
      date,
      time,
      tenant_id: tenantId,
    });

    const globalVisitorSummaryRef = ref(
      db,
      `analytics/visitors/${anonId}/summary/${visitorCounterField}`
    );
    await runTransaction(globalVisitorSummaryRef, (currentVal) => {
      return (currentVal || 0) + 1;
    });

    const globalVisitorMetaRef = ref(db, `analytics/visitors/${anonId}/profile`);
    await update(globalVisitorMetaRef, {
      anonId,
      username,
      deviceName,
      hostUrl,
      lastActiveAt: timestamp,
      lastVisitedPage: pagePath,
      tenant_id: tenantId,
    });

    return res.status(200).json({ success: true, tenant_id: tenantId });
  } catch (error) {
    apiLogger.error("Firebase Analytics Write Error:", error);
    return res.status(500).json({ error: "Internal tracking server error" });
  }
}

export default withApiLogger(handler, "Analytics-API");
