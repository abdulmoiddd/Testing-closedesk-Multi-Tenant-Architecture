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
    try {
      const snapshot = await get(ref(db, "leads"));
      
      apiLogger.info("lead_lifecycle", "bulk_fetch_success", { 
        context: { message: "Fetched all leads for dashboard" } 
      });

      if (snapshot.exists()) {
        return res.status(200).json(snapshot.val()); // Returns all leads
      } else {
        return res.status(200).json({}); // Returns empty object if no leads exist
      }
    } catch (error) {
      apiLogger.error("lead_lifecycle", "bulk_fetch_failed", { error });
      return res.status(500).json({ error: "Failed to fetch leads." });
    }
  }

  // ==========================================
  // POST REQUEST: SAVE LEAD FROM CHATBOT
  // ==========================================
  if (req.method === "POST") {
    const data = req.body;
    
    // 🚨 TICKET 9: Every lead MUST have a lead_id and reference a session
    const lead_id = data.firebaseId || `lead_${Date.now()}`;
    const session_id = data.anonId || data.session_id || lead_id;

    // 🚨 TICKET 9: lead_validation_failed
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      apiLogger.warn("lead_lifecycle", "lead_validation_failed", {
        context: { lead_id, session_id, reason: "Payload is empty or malformed" }
      });
      return res.status(400).json({ error: "Invalid payload format" });
    }

    const hasContactInfo = Boolean(data.name || data.email || data.phone);

    try {
      // 1. Check existing state in the database
      const leadRef = ref(db, `leads/${lead_id}`);
      // 🔥 Wrapped the Read operation
      const snapshot = await executeDbWithTrace(apiLogger, "read", `leads/${lead_id}`, get(leadRef));
      const exists = snapshot.exists();
      const existingData = exists ? snapshot.val() : {};

      // 🚨 TICKET 9: lead_capture_started
      // If the database has never seen this lead AND they haven't provided an email yet
      if (!exists && !hasContactInfo) {
        apiLogger.info("lead_lifecycle", "lead_capture_started", {
          context: { lead_id, session_id, message: "Anonymous visitor started interacting" }
        });
      }

      // 🚨 TICKET 9: lead_duplicate_detected
      // Prevent rapid double-submissions from the frontend from skewing analytics
      if (exists && existingData.last_interaction_at === data.last_interaction_at && !data.is_abandoned) {
        apiLogger.warn("lead_lifecycle", "lead_duplicate_detected", {
          context: { lead_id, session_id, message: "Exact duplicate payload skipped" }
        });
        return res.status(200).json({ id: lead_id, success: true, message: "Duplicate ignored" });
      }

      // 🚨 TICKET 9: lead_status_changed
      // Track when a lead moves from "In Progress" to "Meeting Booked" or "Callback Requested"
      if (exists && existingData.booking_status && data.booking_status && existingData.booking_status !== data.booking_status) {
        apiLogger.info("lead_lifecycle", "lead_status_changed", {
          context: { 
            lead_id, 
            session_id, 
            old_status: existingData.booking_status,
            new_status: data.booking_status
          }
        });
      }

      // 🚨 TICKET 9: lead_created vs lead_updated
      if (!exists && hasContactInfo) {
        apiLogger.info("lead_lifecycle", "lead_created", {
          context: { lead_id, session_id, message: "New lead officially created with contact info" }
        });
      } else if (exists && hasContactInfo) {
        apiLogger.info("lead_lifecycle", "lead_updated", {
          context: { lead_id, session_id, message: "Existing lead profile updated with new context" }
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

          // 🔥 BONUS: Wrap the abandoned summary inside our AI Tracer from Ticket 5!
          const completion = await traceAiExecution(apiLogger, llmPromise, {
            ai_model: "gpt-4o-mini",
            prompt_version: "abandoned_summary_v1",
            conversation_state: "abandoned_chat",
            detected_intent: "summarize",
          });

          data.conversation_summary = completion.choices[0].message.content.trim();
        } catch (aiError) {
          // Because `traceAiExecution` already logs the failure securely, we just handle the fallback here
          data.conversation_summary = "Chat abandoned early (Failed to generate summary).";
        }
      }

      delete data.is_abandoned;

      // 🚨 TICKET 9: lead_routing_started
      apiLogger.info("lead_lifecycle", "lead_routing_started", {
        context: { lead_id, session_id, destination: "firebase_db" }
      });

     // 3. Save to Firebase
      // 🔥 Wrapped the Update operation
      await executeDbWithTrace(apiLogger, "update", `leads/${lead_id}`, update(leadRef, data));

      // 🚨 TICKET 9: lead_routing_success
      apiLogger.info("lead_lifecycle", "lead_routing_success", {
        context: { lead_id, session_id, destination: "firebase_db", status: "saved" }
      });

      return res.status(200).json({ id: lead_id, success: true });

    } catch (error) {
      // 🚨 TICKET 9: lead_routing_failed 
      // A lead will NEVER silently disappear because this catches the exact failure point.
      apiLogger.critical("lead_lifecycle", "lead_routing_failed", {
        error,
        context: { lead_id, session_id, destination: "firebase_db" }
      });
      
      return res.status(500).json({ error: "Failed to route/save lead data" });
    }
  }

  // Reject anything that isn't a GET or POST
  return res.status(405).json({ error: "Method not allowed." });
}

export default withApiLogger(handler, "Lead-Terminal-API");