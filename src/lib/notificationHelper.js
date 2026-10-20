// src/lib/notificationHelper.js
import { db } from "./firebase.js";
import { ref, push, set } from "firebase/database";

// Also log silently to internal UI history
export const logToFirebase = async (title, message, leadData = {}) => {
  try {
    const tenantId = leadData.tenant_id || "tenant_aicyro";
    const notificationPayload = {
      title,
      message,
      timestamp: Date.now(),
      unread: true,
      tenant_id: tenantId,
      lead_data: leadData,
    };

    // Dual-write: global legacy notifications & tenant silo notifications
    const rootNotificationsRef = ref(db, "notifications");
    const tenantNotificationsRef = ref(db, `tenants/${tenantId}/notifications`);

    await Promise.all([
      set(push(rootNotificationsRef), notificationPayload),
      set(push(tenantNotificationsRef), notificationPayload),
    ]);
  } catch (error) {
    console.error("Firebase logging error:", error);
  }
};

export const queueEmailAlert = async (
  title,
  message,
  rawLeadData = {},
  eventType = "end",
  visitorEmailConfig = null,
) => {
  try {
    const tenantId = rawLeadData.tenant_id || "tenant_aicyro";
    logToFirebase(title, message, rawLeadData);

    const formattedLeadData = { ...rawLeadData };
    Object.keys(formattedLeadData).forEach((key) => {
      if (
        formattedLeadData[key] === "" ||
        formattedLeadData[key] === undefined
      ) {
        formattedLeadData[key] = null;
      }
    });

    const emailPayload = {
      title,
      message,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      lead_data: formattedLeadData,
      visitor_email_config: visitorEmailConfig, // Passes visitor info to backend
      status: "pending",
    };

    // Dual-write: global root queue & tenant silo queue
    const rootEmailQueueRef = ref(db, "email_alerts");
    const tenantEmailQueueRef = ref(db, `tenants/${tenantId}/email_alerts`);

    await Promise.all([
      set(push(rootEmailQueueRef), emailPayload),
      set(push(tenantEmailQueueRef), emailPayload),
    ]);
  } catch (error) {
    console.error("Error queueing email alert:", error);
  }
};
