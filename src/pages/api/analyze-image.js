// src/pages/api/analyze-image.js
import OpenAI from "openai";
import { db } from "../../lib/firebase";
import { ref, update, get } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { createAiLogger } from "../../lib/loggerPresets";
import { getVisionSystemPrompt, VISION_DEFAULT_MODEL, VISION_POLICY_VERSION } from "../../lib/visionRuleBook";
import { resolveTenantId, sanitizeTenantId } from "../../lib/tenantResolver";

// 🔥 INFRASTRUCTURE SECURITY: Enforce a strict body size limit BEFORE Next.js attempts to parse it into RAM.
// This prevents immediate Out-of-Memory (OOM) crashes if a malicious client sends a massive Base64 payload.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', 
    },
  },
};

const aiLogger = createAiLogger("VisionDiagnosticAPI");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id, image_url, user_prompt } = req.body;

  if (!session_id || !image_url) {
    return res.status(400).json({ error: "session_id and image_url are required" });
  }

  const startTime = Date.now();

  try {
    const prospectSnap = await get(ref(db, `prospects/${session_id}`));
    const prospectData = prospectSnap.exists() ? prospectSnap.val() : {};
    const businessContext = prospectData.context_patch?.business_context || {};

    const systemPrompt = getVisionSystemPrompt(businessContext);

    const visionResponse = await openai.chat.completions.create({
      model: VISION_DEFAULT_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: user_prompt || "Please inspect this issue and let me know what needs to be done." },
            { type: "image_url", image_url: { url: image_url, detail: "low" } }
          ]
        }
      ]
    });

    const parsedResult = JSON.parse(visionResponse.choices[0]?.message?.content || "{}");
    const duration_ms = Date.now() - startTime;

    // 🔥 If the AI determined the image was irrelevant, do NOT save it to the CRM database as a defect.
    if (parsedResult.is_irrelevant) {
      aiLogger.warn("ai_vision", "irrelevant_image_rejected", {
        context: { session_id, model: VISION_DEFAULT_MODEL },
        duration_ms
      });
      
      return res.status(200).json({
        success: true,
        model: VISION_DEFAULT_MODEL,
        data: parsedResult
      });
    }

    // Only save valid business problems to Firebase
    const imagePayload = {
      image_url,
      identified_issue: parsedResult.identified_issue || "Defect inspected",
      urgency_level: parsedResult.urgency_level || "Medium",
      model_used: VISION_DEFAULT_MODEL,
      vision_policy_version: VISION_POLICY_VERSION,
      analyzed_at: new Date().toISOString()
    };

    await update(ref(db, `prospects/${session_id}/last_vision_inspection`), imagePayload);

    const resolvedTenant = sanitizeTenantId(resolveTenantId(req) || prospectData.tenant_id || "default");
    const targetLeadPath = resolvedTenant && resolvedTenant !== "default"
      ? `tenants/${resolvedTenant}/leads/${session_id}`
      : `leads/${session_id}`;

    await update(ref(db, targetLeadPath), {
      last_inspected_image: image_url,
      identified_issue: parsedResult.identified_issue || "",
      urgency_level: parsedResult.urgency_level || "Medium"
    }).catch(() => {});

    aiLogger.info("ai_vision", "image_analysis_success", {
      context: { session_id, model: VISION_DEFAULT_MODEL, issue: parsedResult.identified_issue, urgency: parsedResult.urgency_level },
      duration_ms
    });

    return res.status(200).json({
      success: true,
      model: VISION_DEFAULT_MODEL,
      data: parsedResult
    });

  } catch (error) {
    aiLogger.error("ai_vision", "image_analysis_failed", { error, context: { session_id } });
    return res.status(500).json({ error: "Failed to analyze image", details: error.message });
  }
}

export default withApiLogger(handler, "VisionDiagnosticAPI");