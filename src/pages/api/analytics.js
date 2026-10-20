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
    } = req.body;

    // 1. Map incoming events to Global Summary field names
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
    const date = now.toISOString().split("T")[0]; // e.g., "2026-09-03"
    const time = now.toTimeString().split(" ")[0]; // e.g., "13:07:51"

    // ──────────────────────────────────────────────────────────────────────────
    // A. Increment Global Platform Summary Counters
    // ──────────────────────────────────────────────────────────────────────────
    const globalSummaryRef = ref(db, `analytics/summary/${summaryField}`);
    await runTransaction(globalSummaryRef, (currentValue) => {
      return (currentValue || 0) + 1;
    });

    // ──────────────────────────────────────────────────────────────────────────
    // B. Log Individual Chronological Event for this specific visitor
    // ──────────────────────────────────────────────────────────────────────────
    const visitorEventsRef = ref(db, `analytics/visitors/${anonId}/events`);

    // Generate the unique ID first before saving
    const newEventRef = push(visitorEventsRef);

    // Save the entity with the explicit ID, Date, and Time
    await set(newEventRef, {
      event_id: newEventRef.key, // Unique ID inside the entity
      event_type,
      pagePath,
      details,
      timestamp,
      date,
      time,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // C. Update Individual Visitor Profile & Summary Counters
    // ──────────────────────────────────────────────────────────────────────────
    const visitorSummaryRef = ref(
      db,
      `analytics/visitors/${anonId}/summary/${visitorCounterField}`,
    );
    await runTransaction(visitorSummaryRef, (currentVal) => {
      return (currentVal || 0) + 1;
    });

    // Update profile metadata (Last active time, device name, username)
    const visitorMetaRef = ref(db, `analytics/visitors/${anonId}/profile`);
    await update(visitorMetaRef, {
      anonId,
      username,
      deviceName,
      lastActiveAt: timestamp,
      lastVisitedPage: pagePath,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    apiLogger.error("Firebase Analytics Write Error:", error);
    return res.status(500).json({ error: "Internal tracking server error" });
  }
}

export default withApiLogger(handler, "Analyics-API");
