import OpenAI from "openai";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase";
import { ref, get } from "firebase/database";

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "OpenAI API key is missing from .env" });
  }

  try {
    // 1. Fetch recent conversations from Firebase to analyze
    const leadsRef = ref(db, "leads");
    const snapshot = await get(leadsRef);

    let conversationData = "";

    if (snapshot.exists()) {
      const leads = snapshot.val();
      // Extract the last 50 leads to prevent token overflow
      const entries = Object.values(leads).slice(-50);

      conversationData = entries
        .map(
          (lead) => `
        ---
        Date: ${lead.timestamp || "Unknown"}
        Service Requested: ${lead.service_requested || "Unknown"}
        Urgency: ${lead.urgency_level || "Unknown"}
        Intent: ${lead.visitor_intent || "Unknown"}
        After Hours: ${lead.after_hours_flag ? "Yes" : "No"}
        Booking Status: ${lead.booking_status || "Unknown"}
        Transcript: ${lead.full_conversation_transcript || "None"}
      `,
        )
        .join("\n");
    } else {
      return res
        .status(200)
        .json({ detailed_bullets: ["No conversation data found yet."] });
    }

    const openai = new OpenAI({ apiKey });

    // 2. Instruct ChatGPT 4.0 Mini on exactly what to extract
    const systemPrompt = `
      You are a Business Intelligence analyst. Review the provided chatbot conversation transcripts and extract key KPIs and chart data.
      Return the data STRICTLY as a JSON object matching this exact structure:

      {
        "kpis": {
          "total_conversations": "string (e.g., '50 Total Chats')",
          "conversion_rate": "string (e.g., '24% Booked')",
          "top_service": "string (e.g., 'AC Repair')",
          "after_hours_stat": "string (e.g., '9 leads')",
          "top_dropoff": "string (e.g., 'Phone Number req')",
          "pricing_inquiries_stat": "string (e.g., '18 asked')",
          "urgent_requests_stat": "string (e.g., '12 High Urgency')",
          "top_objection": "string (e.g., 'Too expensive')"
        },
        "charts": {
          "service_demand": [
            {"name": "string (Service Name)", "value": "number (Count)"}
          ],
          "visitor_intent": [
            {"name": "string (e.g., Booking, Support, Pricing)", "value": "number"}
          ],
          "time_distribution": [
            {"time": "string (e.g., Morning, Afternoon, Evening, Night)", "leads": "number"}
          ]
        },
        "detailed_bullets": [
          "An array of 4 to 6 string sentences detailing deeper insights like location patterns, availability questions, and general trends."
        ]
      }

      Analyze the provided data deeply to generate these exact counts and trends. If data is sparse, make logical estimates based on the available text.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here is the conversation data:\n${conversationData}`,
        },
      ],
      temperature: 0.2,
    });

    const aiInsights = JSON.parse(completion.choices[0].message.content);

    // 3. Return the generated insights to the frontend
    return res.status(200).json(aiInsights);
  } catch (error) {
    apiLogger.error("Error generating insights:", error);
    return res.status(500).json({ error: "Failed to process insights." });
  }
}
export default withApiLogger(handler, "Insights-API");
