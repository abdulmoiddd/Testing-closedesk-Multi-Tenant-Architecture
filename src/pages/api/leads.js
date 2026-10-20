// src/pages/api/leads.js
import OpenAI from "openai";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase";
import { ref, update, get } from "firebase/database";
import { traceAiExecution } from "../../lib/aiTracer"; // 🔥 Integrates Ticket 5 Tracer for the abandoned summaries
import { executeDbWithTrace } from "../../lib/dbTracer";

async function handler(req, res, apiLogger) {
  // ==========================================
  // GET REQUEST: FETCH ALL LEADS FOR DASHBOARD
  // ==========================================
  if (req.method === "GET") {
    const tenantId = req.query.tenant_id || req.headers["x-tenant-id"] || "tenant_aicyro";

    try {
      // 1. First attempt to fetch from Tenant Silo
      const tenantLeadsRef = ref(db, `tenants/${tenantId}/leads`);
      const tenantSnapshot = await get(tenantLeadsRef);

      let leads = {};
      if (tenantSnapshot.exists()) {
        leads = tenantSnapshot.val();
      }

      // 2. Dual-read bridge: If tenant silo has no leads, fallback to legacy root /leads
      if (Object.keys(leads).length === 0) {
        const rootSnapshot = await get(ref(db, "leads"));
        if (rootSnapshot.exists()) {
          leads = rootSnapshot.val();
        }
      }

      apiLogger.info("lead_lifecycle", "bulk_fetch_success", { 
        context: { message: `Fetched leads for tenant '${tenantId}'`, tenant_id: tenantId, count: Object.keys(leads).length } 
      });

      return res.status(200).json(leads);
    } catch (error) {
      apiLogger.error("lead_lifecycle", "bulk_fetch_failed", { error, tenant_id: tenantId });
      return res.status(500).json({ error: "Failed to fetch leads." });
    }
  }

  // ==========================================
  // POST REQUEST: SAVE LEAD FROM CHATBOT
  // ==========================================
  if (req.method === "POST") {
    const data = req.body;
    
    // 🚨 TICKET 9: Every lead MUST have a lead_id and reference a session
    const lead_id = data.firebaseId || data.lead_id || `lead_${Date.now()}`;
    const session_id = data.anonId || data.session_id || lead_id;
    const tenant_id = data.tenant_id || req.headers["x-tenant-id"] || "tenant_aicyro";

    // Attach tenant_id to the lead data
    data.tenant_id = tenant_id;
    data.lead_id = lead_id;

    // 🚨 TICKET 9: lead_validation_failed
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      apiLogger.warn("lead_lifecycle", "lead_validation_failed", {
        context: { lead_id, session_id, tenant_id, reason: "Payload is empty or malformed" }
      });
      return res.status(400).json({ error: "Invalid payload format" });
    }

    const hasContactInfo = Boolean(data.name || data.email || data.phone);

    try {
      // 1. Check existing state in the database (Check tenant silo first, then legacy root)
      const tenantLeadRef = ref(db, `tenants/${tenant_id}/leads/${lead_id}`);
      const rootLeadRef = ref(db, `leads/${lead_id}`);

      const snapshot = await executeDbWithTrace(apiLogger, "read", `tenants/${tenant_id}/leads/${lead_id}`, get(tenantLeadRef));
      let exists = snapshot.exists();
      let existingData = exists ? snapshot.val() : {};

      if (!exists) {
        const rootSnap = await get(rootLeadRef);
        if (rootSnap.exists()) {
          exists = true;
          existingData = rootSnap.val();
        }
      }

      // 🚨 TICKET 9: lead_capture_started
      if (!exists && !hasContactInfo) {
        apiLogger.info("lead_lifecycle", "lead_capture_started", {
          context: { lead_id, session_id, tenant_id, message: "Anonymous visitor started interacting" }
        });
      }

      // 🚨 TICKET 9: lead_duplicate_detected
      if (exists && existingData.last_interaction_at === data.last_interaction_at && !data.is_abandoned) {
        apiLogger.warn("lead_lifecycle", "lead_duplicate_detected", {
          context: { lead_id, session_id, tenant_id, message: "Exact duplicate payload skipped" }
        });
        return res.status(200).json({ id: lead_id, success: true, message: "Duplicate ignored" });
      }

      // 🚨 TICKET 9: lead_status_changed
      if (exists && existingData.booking_status && data.booking_status && existingData.booking_status !== data.booking_status) {
        apiLogger.info("lead_lifecycle", "lead_status_changed", {
          context: { 
            lead_id, 
            session_id, 
            tenant_id,
            old_status: existingData.booking_status,
            new_status: data.booking_status
          }
        });
      }

      // 🚨 TICKET 9: lead_created vs lead_updated
      if (!exists && hasContactInfo) {
        apiLogger.info("lead_lifecycle", "lead_created", {
          context: { lead_id, session_id, tenant_id, message: "New lead officially created with contact info" }
        });
      } else if (exists && hasContactInfo) {
        apiLogger.info("lead_lifecycle", "lead_updated", {
          context: { lead_id, session_id, tenant_id, message: "Existing lead profile updated with new context" }
        });
      }

      // 2. Abandoned chat AI summary logic
      if (data.is_abandoned && (!data.conversation_summary || data.conversation_summary === "In progress...")) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const llmPromise = openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are summarizing an abandoned lead-capture chat between a user and an AI. Summarize the conversation in 1-2 concise sentences based strictly on the provided transcript. Focus on the user's intent or any details they shared. If the user provided no meaningful info, output: 'User abandoned the chat early without providing specific details.'",
              },
              {
                role: "user",
                content: data.full_conversation_transcript || "No transcript available.",
              },
            ],
            temperature: 0.3,
            max_tokens: 100,
          });

          const completion = await traceAiExecution(apiLogger, llmPromise, {
            ai_model: "gpt-4o-mini",
            prompt_version: "abandoned_summary_v1",
            conversation_state: "abandoned_chat",
            detected_intent: "summarize",
          });

          data.conversation_summary = completion.choices[0].message.content.trim();
        } catch (aiError) {
          data.conversation_summary = "Chat abandoned early (Failed to generate summary).";
        }
      }

      delete data.is_abandoned;

      // 🚨 TICKET 9: lead_routing_started
      apiLogger.info("lead_lifecycle", "lead_routing_started", {
        context: { lead_id, session_id, tenant_id, destination: "firebase_db_dual_write" }
      });

      // 3. Dual-Write to Firebase (Primary: Tenant Silo, Secondary: Legacy Root)
      const multiPathUpdates = {};
      multiPathUpdates[`tenants/${tenant_id}/leads/${lead_id}`] = data;
      multiPathUpdates[`leads/${lead_id}`] = data;

      await executeDbWithTrace(apiLogger, "update", `multi_tenant_leads/${lead_id}`, update(ref(db), multiPathUpdates));

      // 🚨 TICKET 9: lead_routing_success
      apiLogger.info("lead_lifecycle", "lead_routing_success", {
        context: { lead_id, session_id, tenant_id, destination: "firebase_db_dual_write", status: "saved" }
      });

      return res.status(200).json({ id: lead_id, tenant_id, success: true });

    } catch (error) {
      apiLogger.critical("lead_lifecycle", "lead_routing_failed", {
        error,
        context: { lead_id, session_id, tenant_id, destination: "firebase_db" }
      });
      
      return res.status(500).json({ error: "Failed to route/save lead data" });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}

export default withApiLogger(handler, "Lead-Terminal-API");