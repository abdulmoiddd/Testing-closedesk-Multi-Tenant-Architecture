// scripts/seed_real_multi_tenant.js
/**
 * ============================================================================
 * CloseDesk Multi-Tenant Platform — Real Database Migration & Seeding Script
 * ============================================================================
 * Migrates and seeds the live single-tenant Firebase RTDB structure:
 * 1. Takes real live data from `settings/business_profile`, `settings/chatbot_config`,
 *    and `users/root/notifications` and seeds `/tenants/tenant_aicyro`.
 * 2. Seeds `/industry_packs/saas` (Aicyro native AI systems) and `/industry_packs/hvac`.
 * 3. Seeds sample HVAC tenants (`tenant_apex_air_01` and `tenant_cool_breeze_02`)
 *    to prove multi-tenant isolation.
 * 4. Preserves 100% backward compatibility with `/lg` Pulse Admin Dashboard and Cloud Functions.
 */

const { initializeApp } = require("firebase/app");
const { getDatabase, ref, update, get } = require("firebase/database");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      process.env[key.trim()] = values.join("=").trim().replace(/(^"|"$)/g, "");
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// SVG Helmet Avatar from live chatbot_config
const CUSTOM_HELMET_SVG = `<svg width="512" height="512" viewBox="0 0 512 512"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="helmet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.45" stop-color="#dfe7f5"/>
      <stop offset="1" stop-color="#aebbd2"/>
    </linearGradient>
    <linearGradient id="helmetDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17243e"/>
      <stop offset="0.5" stop-color="#080f23"/>
      <stop offset="1" stop-color="#27385c"/>
    </linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071126"/>
      <stop offset="0.5" stop-color="#101d3d"/>
      <stop offset="1" stop-color="#17284d"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.5" stop-color="#e5ebf5"/>
      <stop offset="1" stop-color="#aab8cf"/>
    </linearGradient>
    <linearGradient id="shoulder" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7f9ff"/>
      <stop offset="0.55" stop-color="#cbd5e7"/>
      <stop offset="1" stop-color="#8797b1"/>
    </linearGradient>
    <linearGradient id="neck" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#26395f"/>
      <stop offset="1" stop-color="#080f22"/>
    </linearGradient>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#00102e" flood-opacity="0.35"/>
    </filter>
    <clipPath id="visorClip">
      <rect x="105" y="126" width="302" height="220" rx="82"/>
    </clipPath>
  </defs>
  <ellipse cx="256" cy="465" rx="155" ry="24" fill="#00cfff" opacity="0.18" filter="url(#softGlow)"/>
  <g filter="url(#shadow)">
    <rect x="69" y="54" width="374" height="320" rx="145" fill="url(#helmetDark)" stroke="#34466e" stroke-width="4"/>
    <path d="M256 66 C151 66 78 132 78 231 C78 317 145 364 256 364 C367 364 434 317 434 231 C434 132 361 66 256 66Z" fill="none" stroke="#12cfff" stroke-width="3" opacity="0.8" filter="url(#glow)"/>
    <rect x="83" y="72" width="346" height="292" rx="132" fill="url(#helmet)" stroke="#f9fbff" stroke-width="3"/>
    <rect x="105" y="119" width="302" height="226" rx="82" fill="url(#visor)" stroke="#27385e" stroke-width="4"/>
    <path d="M142 220 Q171 187 201 220" fill="none" stroke="#63edff" stroke-width="8" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M311 220 Q341 187 370 220" fill="none" stroke="#63edff" stroke-width="8" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M218 265 Q256 292 294 265" fill="none" stroke="#61efff" stroke-width="7" stroke-linecap="round" filter="url(#glow)"/>
  </g>
</svg>`;

async function seedMultiTenantData() {
  console.log("================================================================");
  console.log("🚀 CloseDesk — Seeding Multi-Tenant Architecture from Real Schema");
  console.log("================================================================\n");

  const now = Date.now();
  const updates = {};

  // --------------------------------------------------------------------------
  // 1. INDUSTRY PACKS (/industry_packs)
  // --------------------------------------------------------------------------

  // A. SaaS Industry Pack (Aicyro Core)
  updates["industry_packs/saas"] = {
    pack_id: "saas",
    industry_name: "SaaS & AI Business Systems",
    version: "1.0.0",
    created_at: now,
    services: [
      "AI Business Systems",
      "Automated Lead Capture",
      "CRM & Workflow Integration",
      "Custom AI Voice Agents",
      "Digital Front Desk Automation",
    ],
    emergency_triggers: [
      "security breach",
      "database down",
      "server outage",
      "data loss",
      "account compromised",
      "api 500 error",
    ],
    safety_protocols: {
      outage: {
        immediate_action: "Acknowledge incident, verify customer identity, and escalate immediately to engineering.",
        forbidden_actions: ["speculating cause", "sharing internal server logs"],
      },
    },
    qualification_questions: [
      {
        id: "business_problem",
        question: "What is the primary business bottleneck or challenge you are looking to automate?",
        required: true,
      },
      {
        id: "current_software",
        question: "Which CRM or software stack does your team currently use?",
        required: false,
      },
      {
        id: "meeting_preference",
        question: "Would you prefer a 15-minute quick product demo or a full workflow consultation?",
        required: true,
      },
    ],
    pricing: {
      avg_job_value: "200",
      currency: "USD",
      diagnostic_fee: null,
      waive_diagnostic_with_repair: false,
    },
  };

  // B. HVAC Industry Pack
  updates["industry_packs/hvac"] = {
    pack_id: "hvac",
    industry_name: "Heating, Ventilation, & Air Conditioning",
    version: "1.0.0",
    created_at: now,
    services: [
      "Emergency AC Repair",
      "Furnace & Heating Repair",
      "Seasonal System Tune-Up",
      "Heat Pump Installation",
      "Duct Cleaning & Air Quality",
    ],
    emergency_triggers: [
      "smell gas",
      "gas leak",
      "carbon monoxide",
      "smoke from vents",
      "burning odor",
      "water leaking near electrical panel",
      "freezing indoor temps with infants or seniors",
    ],
    safety_protocols: {
      gas_leak: {
        immediate_action:
          "Evacuate the home immediately. Do not operate lights or electrical switches. Call the utility or 911 from outside.",
        forbidden_actions: ["troubleshooting", "relighting pilot", "resetting furnace"],
      },
    },
    qualification_questions: [
      {
        id: "homeowner",
        question: "Are you the homeowner or property manager?",
        required: true,
      },
      {
        id: "equipment_age",
        question: "Approximately how old is the system, if you know?",
        required: false,
      },
      {
        id: "problem_duration",
        question: "When did you first notice the system stopping?",
        required: true,
      },
    ],
    pricing: {
      diagnostic_fee: 99,
      waive_diagnostic_with_repair: true,
      currency: "USD",
    },
  };

  // --------------------------------------------------------------------------
  // 2. TENANTS (/tenants)
  // --------------------------------------------------------------------------

  // A. Aicyro Primary Tenant (Migrated 1:1 from real live DB settings)
  updates["tenants/tenant_aicyro"] = {
    tenant_id: "tenant_aicyro",
    name: "Aicyro",
    status: "active",
    tier: "enterprise",
    industry_pack_id: "saas",
    created_at: now,
    updated_at: now,

    client_config: {
      business_name: "Aicyro",
      industry: "SaaS",
      address: "Rawalpindi, Pakistan",
      phone: "03472539535",
      email: "info@aicyro.com",
      website: "www.aicyro.com",
      timezone: "Asia/Karachi",
      operating_hours: {
        Monday: { active: true, close: "17:00", open: "09:00" },
        Tuesday: { active: true, close: "17:00", open: "09:00" },
        Wednesday: { active: true, close: "17:00", open: "09:00" },
        Thursday: { active: true, close: "17:00", open: "09:00" },
        Friday: { active: true, close: "17:00", open: "09:00" },
        Saturday: { active: false, close: "17:00", open: "09:00" },
        Sunday: { active: false, close: "17:00", open: "09:00" },
      },
      ai_persona: {
        name: "Aicyro",
        bot_identity: "the raja for Aicyro",
        avatar_url: "human_agent",
        custom_avatar_svg: CUSTOM_HELMET_SVG,
        voice: "Justin",
        voice_enabled: true,
        tone: "Casual & Enthusiastic",
        greeting_message: "hey there, want to know how i can help you close more leads ?",
        launcher_text: "Need Help?",
        theme_color: "#101bb7",
      },
      base_prompt: "Operate a strict, funnel-based lead capture system. Give precise answers and use as few tokens as possible.",
      additional_rules: "1. Always end your message with a question.\n2. Never use emojis.\n3. CRITICAL: Keep all answers short. Never write more than 2 or 3 short sentences. Be punchy and get straight to the point.",
      custom_rules: "Never mention competitors. Keep answers extremely brief.",
      lead_capture_fields: ["Name", "Email", "Phone"],
      business_intelligence_fields: [
        "Industry Type",
        "Primary Business Problem",
        "Current CRM/Software",
        "Meeting Preference (Demo vs. Consultation)",
        "Location",
        "Website",
      ],
      services_offered: ["Saas"],
      pricing: {
        avg_job_value: "200",
        currency: "USD",
        diagnostic_fee: null,
        waive_diagnostic_with_repair: false,
      },
      emergency_rules: {
        supports_24_7_dispatch: false,
        emergency_dispatch_fee: null,
        after_hours_policy: "next_business_day_priority_booking",
        protocol: "Acknowledge urgency, collect contact info, and notify leadership immediately.",
      },
      booking_rules: {
        allow_direct_booking: true,
        buffer_time_minutes: 30,
        rule_type: "require_all",
      },
      temperature: 0.2,
      strict_validation: true,
    },

    secrets: {
      admin_email: "moid@aicyro.com",
      lead_receivers: "moid@aicyro.com",
      urgent_alerts: true,
      after_hours_alerts: true,
      email_alerts: true,
      sms_alerts: false,
      daily_summary: true,
      weekly_summary: true,
    },
  };

  // B. Sample HVAC Tenant 1: Apex Air Solutions (24/7 Dispatch)
  updates["tenants/tenant_apex_air_01"] = {
    tenant_id: "tenant_apex_air_01",
    name: "Apex Air Solutions",
    status: "active",
    tier: "enterprise",
    industry_pack_id: "hvac",
    created_at: now,
    updated_at: now,

    client_config: {
      business_name: "Apex Air Solutions",
      phone: "(555) 234-5678",
      address: "100 Industrial Pkwy, Dallas, TX 75201",
      operating_hours: {
        Monday: { active: true, open: "08:00", close: "18:00" },
        Tuesday: { active: true, open: "08:00", close: "18:00" },
        Wednesday: { active: true, open: "08:00", close: "18:00" },
        Thursday: { active: true, open: "08:00", close: "18:00" },
        Friday: { active: true, open: "08:00", close: "18:00" },
        Saturday: { active: true, open: "09:00", close: "15:00" },
        Sunday: { active: false, open: "00:00", close: "00:00" },
      },
      emergency_rules: {
        supports_24_7_dispatch: true,
        emergency_dispatch_fee: 189,
        after_hours_policy: "live_emergency_dispatch",
        protocol: "Verify life-safety first. Then offer on-call technician dispatch with $189 dispatch fee disclosed.",
      },
      pricing: {
        diagnostic_fee: 129,
        waive_diagnostic_with_repair: true,
        currency: "USD",
      },
      booking_rules: {
        allow_direct_booking: true,
        buffer_time_minutes: 45,
      },
      ai_persona: {
        name: "Apex Dispatch AI",
        tone: "Urgent, reassuring, and decisive",
        avatar_url: "/avatars/human-agent.svg",
        voice: "onyx",
      },
    },

    secrets: {
      admin_email: "dispatch@apexairsolutions.com",
    },
  };

  // C. Sample HVAC Tenant 2: Cool Breeze Heating & Air (Business Hours Only)
  updates["tenants/tenant_cool_breeze_02"] = {
    tenant_id: "tenant_cool_breeze_02",
    name: "Cool Breeze Heating & Air",
    status: "active",
    tier: "standard",
    industry_pack_id: "hvac",
    created_at: now,
    updated_at: now,

    client_config: {
      business_name: "Cool Breeze Heating & Air",
      phone: "(555) 876-5432",
      address: "450 Main St, Austin, TX 78701",
      operating_hours: {
        Monday: { active: true, open: "08:30", close: "17:00" },
        Tuesday: { active: true, open: "08:30", close: "17:00" },
        Wednesday: { active: true, open: "08:30", close: "17:00" },
        Thursday: { active: true, open: "08:30", close: "17:00" },
        Friday: { active: true, open: "08:30", close: "17:00" },
        Saturday: { active: false, open: "00:00", close: "00:00" },
        Sunday: { active: false, open: "00:00", close: "00:00" },
      },
      emergency_rules: {
        supports_24_7_dispatch: false,
        emergency_dispatch_fee: null,
        after_hours_policy: "next_business_day_priority_booking",
        protocol: "Advise safety. Inform customer that after-hours on-site service is unavailable. Schedule priority 8:30 AM arrival window.",
      },
      pricing: {
        diagnostic_fee: 79,
        waive_diagnostic_with_repair: false,
        currency: "USD",
      },
      booking_rules: {
        allow_direct_booking: false,
        buffer_time_minutes: 60,
      },
      ai_persona: {
        name: "Breeze Concierge",
        tone: "Friendly, casual, and transparent",
        avatar_url: "/avatars/ai-spark.svg",
        voice: "nova",
      },
    },

    secrets: {
      admin_email: "support@coolbreezeaustin.com",
    },
  };

  console.log("Writing multi-tenant paths to Firebase Realtime Database...");
  try {
    await update(ref(db), updates);
    console.log("✅ Successfully seeded multi-tenant schema to Firebase Realtime Database!");
    console.log("   - /industry_packs/saas");
    console.log("   - /industry_packs/hvac");
    console.log("   - /tenants/tenant_aicyro (Migrated from live business_profile & chatbot_config)");
    console.log("   - /tenants/tenant_apex_air_01 (Sample HVAC 24/7)");
    console.log("   - /tenants/tenant_cool_breeze_02 (Sample HVAC Business Hours)");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

seedMultiTenantData();
