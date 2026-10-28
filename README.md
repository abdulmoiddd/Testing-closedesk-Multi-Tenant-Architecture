# CloseDesk Engine

> **Multi-Tenant Headless Multimodal AI Front-Desk & Real-Time Operational Dispatch Control Plane**  
> *Production Version: v2.1.0 | Runtime: Next.js 16 (Pages Router) & Node.js >= 20.x*

CloseDesk (branded as **Aicyro**) is a high-performance, decoupled multi-tenant platform designed for field service and enterprise organizations. It bridges conversational client acquisition with real-time operational CRM triage, live dispatch scheduling, and multi-tenant management.

---

## Architecture Overview

CloseDesk decouples conversational client acquisition from backend intelligence, database persistence, and CRM dispatch operations:

```
+---------------------------------------------------------------------------------------------------+
|                                  CLIENT CONSUMPTION LAYER (ANY HOST)                              |
|                                                                                                   |
|  [WordPress / Webflow / Shopify / Custom Next.js / Static HTML]                                   |
|   └── Universal Embed SDK: <script src="https://domain.com/widget.js" data-tenant="id"></script>  |
|         ├── Host DOM Telemetry & Geolocation Resolution (IPInfo / Navigator)                      |
|         ├── Screen-Lock Cookie & Geolocation Consent Banner (GDPR/CCPA Gate)                      |
|         └── Sandboxed Transparent Iframe (/embed/chatbot?tenant={id}&anonId={uuid})               |
+---------------------------------------------------------------------------------------------------+
                                         │ postMessage (Resize / State)
                                         │ HTTPS REST / WSS WebRTC
                                         ▼
+---------------------------------------------------------------------------------------------------+
|                                APPLICATION GATEWAY & API RUNTIME LAYER                            |
|                                                                                                   |
|  [Next.js 16.1.6 Pages Router Serverless Edge / Node.js Engine]                                   |
|   ├── CORS & Security Headers Middleware (next.config.js / netlify.toml)                         |
|   ├── Universal Tracing Pipeline: withApiLogger(handler, componentName)                           |
|   │     ├── Transaction Propagation (x-correlation-id, x-session-id, x-tenant-id)                |
|   │     └── Unhandled Exception Trapping & PII / Secret Sanitization                              |
|   ├── Security Middleware & Key Sanitizer: sanitizeDatabaseKey() against NoSQL injection          |
|   └── Multimodal Endpoints:                                                                       |
|         ├── Voice Session Ephemeral Minting: /api/openai-token                                    |
|         ├── Text Conversational Engine: /api/chat (GPT-4o-mini JSON mode)                         |
|         ├── Vision Ingestion & Diagnosis: /api/analyze-image (Multimodal GPT-4o-mini)             |
|         ├── Calendar OAuth Sync: /api/auth/google & /api/auth/microsoft                           |
|         └── Fallback Neural Speech Synthesis: /api/tts (AWS Polly)                                |
+---------------------------------------------------------------------------------------------------+
                                         │
                                         ▼
+---------------------------------------------------------------------------------------------------+
|                                PERSISTENCE & ASYNCHRONOUS WORKER LAYER                            |
|                                                                                                   |
|  [Firebase Realtime Database (us-central1) & Cloud Functions (Node 20)]                           |
|   ├── Isolated Tenant Tree: /tenants/{tenantId}/                                                  |
|   │     ├── /settings           (Branding, System Prompts, Business Hours, Tiers)                 |
|   │     ├── /conversations      (Live Sessions, Transcripts, Customer Payloads)                   |
|   │     ├── /bookings           (Appointments, Service Types, OAuth Sync Status)                 |
|   │     ├── /cookies            (Consent Tokens, Geolocation, Device Fingerprints)                |
|   │     └── /analytics          (Conversion Rates, Session Metrics, Channel Volume)               |
|   └── Cloud Functions (functions/index.js): Dynamic SMTP Mailer & Appointment Cron Dispatch       |
+---------------------------------------------------------------------------------------------------+
```

---

## Key Features

### 1. Multimodal Front-Desk AI (`/embed/chatbot`)
* **Realtime WebRTC Voice AI:** Sub-second conversational voice powered by OpenAI Realtime WebRTC with dynamic system instructions, Voice Activity Detection (VAD), and interruptions.
* **Text Chat with Guardrails:** GPT-4o-mini structured JSON completions enforcing domain rulebooks, business hours, and automated handoffs.
* **Multimodal Vision Diagnostics:** Users can capture or upload photos of issues (e.g., plumbing leaks, electrical panels, HVAC tags); the AI analyzes damage severity and repair scope before quoting.
* **Neural Speech Fallback:** High-fidelity speech generation with AWS Polly Neural voices.
* **Privacy & Compliance Gate:** Explicit screen-lock consent modal enforcing GDPR/CCPA compliance before tracking or voice recording.
* **Integrated Scheduling:** Frictionless booking flow with two-way calendar sync via Google Calendar and Microsoft Outlook OAuth.

### 2. Operational Dispatch CRM Cockpit (`/lg`)
* **Live Cockpit & KPI Velocity:** Real-time metrics on incoming inquiries, conversion rate, booked pipeline value, and response latency.
* **Terminal Screen:** Real-time triage monitor displaying active incoming inquiries, urgent issues, and one-click operator takeover.
* **Conversations Browser:** Full chat histories, voice session recordings/transcripts, sentiment indicators, and lead metadata.
* **Booking Manager:** Calendar and list view for customer appointments with status controls (Confirmed, Completed, Rescheduled, Cancelled).
* **Visitor Intelligence & Cookie Map:** Interactive Google Maps visualization showing geographic distribution of site visitors, device details, and consent statuses.
* **AI Business Insights:** Automated analytics and trend visualization powered by Recharts.
* **Automated Daily & Weekly Reports:** Operational performance summaries and lead acquisition reports.
* **Granular Tenant Configuration:**
  * Business Profile (name, phone, address, operating hours, emergency rates).
  * Chatbot Settings (voice persona, temperature, auto-open delays, lead scoring thresholds).
  * Appearance & Custom Theming (light/dark modes, custom accent colors, custom CSS).
  * Notification Settings & Password Security.

### 3. SuperAdmin Control Plane
* Secure administrative access via credentials and secondary PIN verification.
* Multi-tenant provisioning: instant creation, suspension, and license tier assignment.
* Platform-wide analytics, system theme management, and global SMTP email protocol configuration.

### 4. Enterprise Security & Resilience
* **Strict Multi-Tenant Isolation:** Database keys and API queries are validated and scoped exclusively to authorized tenant IDs.
* **Key Sanitization:** Centralized `sanitizeDatabaseKey` prevents NoSQL path injection and unauthorized traversal.
* **PII & Secret Sanitization:** Universal logger scrubs credentials, tokens, phone numbers, and emails from operational logs.
* **Resilient Retry Loops:** Built-in exponential backoff for external AI and database API requests.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & UI** | [Next.js 16.1.6](https://nextjs.org/) (Pages Router), [React 19](https://react.dev/), [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **Data & Backend** | [Firebase Realtime Database](https://firebase.google.com/), [Firebase Cloud Functions](https://firebase.google.com/docs/functions) (Node 20) |
| **Artificial Intelligence** | [OpenAI Realtime API](https://platform.openai.com/) (WebRTC Voice), GPT-4o-mini (Chat & Vision), [AWS Polly](https://aws.amazon.com/polly/) (Neural TTS) |
| **Mapping & Charts** | [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/), [Recharts 3](https://recharts.org/) |
| **Calendar Integrations** | Google Calendar API OAuth 2.0, Microsoft Graph API OAuth 2.0 |
| **Testing & QA** | Puppeteer Core, Custom VAD Tuning & AI Evaluation Harnesses |

---

## Directory Structure

```text
├── functions/                    # Firebase Cloud Functions (v1, Node 20)
│   ├── index.js                  # Dynamic SMTP mailer & appointment reminder crons
│   └── package.json              # Function runtime dependencies
│
├── public/                       # Static assets & client SDK
│   ├── avatars/                  # Chatbot avatar icons (SVG)
│   ├── widget.js                 # Universal portable embed script
│   ├── e2e-report.html           # Public E2E QA report
│   └── robots.txt                # Crawler directives
│
├── scripts/                      # Testing, tuning, and evaluation harnesses
│   ├── industry_regression_suite.js # API regression test across home-service verticals
│   ├── qa-simulator.js           # End-to-end chat and voice session simulator
│   ├── run_evaluations.js        # Synthetic evaluation suite (npm run test:ai)
│   ├── vad_tuning_harness.js     # Voice Activity Detection calibration
│   └── voice_qa_harness.js       # Audio generation & pronunciation verification
│
├── src/
│   ├── components/
│   │   ├── Chatbot/              # Customer-facing embeddable front-desk
│   │   │   └── AicyroChatbot.jsx
│   │   ├── Dashboard/            # Pulse CRM Cockpit screens (/lg)
│   │   │   ├── Booking.jsx       # Appointments management
│   │   │   ├── Conversations.jsx # Chat & voice transcripts
│   │   │   ├── CookieDataDisplay.jsx # Visitor cookies & device telemetry
│   │   │   ├── HomeScreen.jsx    # KPI cockpit & velocity
│   │   │   ├── Insight.jsx       # AI conversion analytics
│   │   │   ├── LiveNotifications.jsx # Real-time dispatch alerts
│   │   │   ├── LoginScreen.jsx   # Tenant authentication screen
│   │   │   ├── Report.jsx        # Scheduled performance reports
│   │   │   ├── TerminalScreen.jsx # Live triage terminal
│   │   │   ├── cookie/           # Google Maps & visitor grid widgets
│   │   │   ├── Settings/         # Business profile, theme, notifications, security
│   │   │   └── superadmin/       # Multi-tenant management & provisioning
│   │   ├── Essential/            # Cookie consent banner
│   │   └── GlobalActivityTracker.jsx # Client runtime error telemetry
│   │
│   ├── lib/                      # Core backend libraries & utilities
│   │   ├── activityTracker.js    # Telemetry logging helper
│   │   ├── aiTracer.js           # OpenAI execution telemetry
│   │   ├── alertManager.js       # Real-time incident alert publisher
│   │   ├── apiMiddleware.js      # Universal API logger & performance wrapper
│   │   ├── auditTracer.js        # Security audit trail tracer
│   │   ├── cookiePersonalization.js # Lead personalization engine
│   │   ├── dbTracer.js           # Database query latency tracer
│   │   ├── firebase.js           # Firebase Client SDK initialization
│   │   ├── logger.js             # Structured logger with PII scrubbing
│   │   ├── ruleBook.js           # Domain rules & conversation policies
│   │   ├── sanitizer.js          # NoSQL key sanitizer
│   │   ├── tenantResolver.js     # Tenant domain & slug resolver
│   │   └── visionRuleBook.js     # Multimodal image analysis rules
│   │
│   ├── pages/
│   │   ├── api/                  # Next.js Serverless API routes
│   │   │   ├── auth/             # Google & Microsoft OAuth endpoints
│   │   │   ├── chat.js           # Conversational AI endpoint
│   │   │   ├── analyze-image.js  # Multimodal Vision analysis
│   │   │   ├── openai-token.js   # WebRTC Realtime Voice token minting
│   │   │   ├── tts.js            # AWS Polly Neural TTS endpoint
│   │   │   ├── leads.js          # Lead capture & scoring
│   │   │   ├── insights.js       # Analytical aggregations
│   │   │   └── superadmin/       # Platform administration & PIN verification
│   │   ├── embed/
│   │   │   └── chatbot.jsx       # Standalone embed route loaded by iframe
│   │   ├── index.jsx             # Public marketing / landing portal
│   │   ├── lg.jsx                # Pulse Tenant & SuperAdmin CRM cockpit
│   │   ├── logs.jsx              # System operational log viewer
│   │   └── e2e-report.jsx        # Interactive QA dashboard page
│   └── styles/
│       └── globals.css           # Tailwind design tokens and animations
│
├── database.rules.json           # Firebase Realtime Database security rules & indexes
├── netlify.toml                  # Edge CORS headers and build configuration
└── next.config.js                # Next.js application runtime configuration
```

---

## Getting Started

### Prerequisites
* **Node.js**: `>= 20.0.0`
* **npm**: `>= 10.0.0`
* **Firebase Project**: With Realtime Database enabled.
* **OpenAI API Key**: With access to GPT-4o-mini and Realtime APIs.

### 1. Clone & Install
```bash
git clone https://github.com/abdulmoiddd/Testing-closedesk-Multi-Tenant-Architecture.git
cd Testing-closedesk-Multi-Tenant-Architecture
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:

```env
# Base Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# OpenAI Intelligence
OPENAI_API_KEY=sk-proj-your_openai_api_key

# Google Maps Platform (Visitor Map Display)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# AWS Polly Neural TTS (Optional Fallback)
CUSTOM_AWS_REGION=us-east-1
CUSTOM_AWS_ACCESS_KEY_ID=your_aws_access_key
CUSTOM_AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Google Calendar OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Microsoft 365 OAuth (Optional)
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Webhooks & Scheduled Cleanup
CRON_SECRET=your_secure_cron_secret
MAKE_COM_EMAIL_WEBHOOK_URL=https://hook.make.com/your_webhook
WEBHOOK_SECRET=your_webhook_secret
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application:
* **Tenant & SuperAdmin Cockpit**: [http://localhost:3000/lg](http://localhost:3000/lg)
* **Embedded Chatbot Sandbox**: [http://localhost:3000/embed/chatbot?tenant=demo](http://localhost:3000/embed/chatbot?tenant=demo)
* **Operational Logs**: [http://localhost:3000/logs](http://localhost:3000/logs)

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server with hot module reloading. |
| `npm run build` | Compiles an optimized production build. |
| `npm start` | Runs the compiled production server. |
| `npm run lint` | Analyzes code quality using ESLint. |
| `npm run test:ai` | Executes the synthetic AI evaluation and safety harness. |
| `node scripts/qa-simulator.js` | Runs end-to-end simulated chat and voice sessions. |
| `node scripts/industry_regression_suite.js` | Runs multi-vertical regression suites across business rules. |

---

## Embedding on Client Websites

To embed the CloseDesk front-desk on any external website (WordPress, Webflow, Shopify, Squarespace, or custom static sites), add this single script tag right before the closing `</body>` tag:

```html
<script 
  src="https://your-domain.com/widget.js" 
  data-tenant="your_tenant_id" 
  defer>
</script>
```

### How the Widget Works:
1. **Lightweight Loader**: Loads asynchronously without blocking the host page.
2. **Strict Privacy**: Displays the consent modal before activating cookies or telemetry.
3. **Isolated Iframe**: Injects a transparent, zero-conflict sandboxed iframe hosting `/embed/chatbot`.
4. **Adaptive Resizing**: Automatically handles expandable chat window geometry and mobile screen-docking via cross-domain `postMessage`.

---

## Deployment

### Netlify
1. Connect the GitHub repository to Netlify.
2. Build Settings:
   * **Build Command:** `npm run build`
   * **Publish Directory:** `.next`
3. Ensure all environment variables from `.env.local` are added to the Netlify site settings.
4. Headers and edge CORS rules are pre-configured in [`netlify.toml`](file:///d:/Software%20House%2001/Closedesk-ready%20deploy/netlify.toml).

### Firebase Realtime Database & Cloud Functions
1. Deploy database security rules and index definitions:
   ```bash
   firebase deploy --only database
   ```
2. Deploy Cloud Functions for email dispatch and crons:
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```

---

## Security & Compliance

* **Tenant Isolation:** Enforced at both the database rule level ([`database.rules.json`](file:///d:/Software%20House%2001/Closedesk-ready%20deploy/database.rules.json)) and API middleware layer ([`tenantResolver.js`](file:///d:/Software%20House%2001/Closedesk-ready%20deploy/src/lib/tenantResolver.js)).
* **NoSQL Injection Defense:** Centralized key sanitization ([`sanitizer.js`](file:///d:/Software%20House%2001/Closedesk-ready%20deploy/src/lib/sanitizer.js)) scrubs malicious characters before database writes.
* **Privacy Compliance:** Voice sessions and visitor location tracking require explicit user opt-in through the consent banner.
* **Auditing:** Complete operational logs with structured correlation IDs and automatic PII masking ([`logger.js`](file:///d:/Software%20House%2001/Closedesk-ready%20deploy/src/lib/logger.js)).

---

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or commercial deployment is strictly prohibited.  
Developed by **Aicyro**.
