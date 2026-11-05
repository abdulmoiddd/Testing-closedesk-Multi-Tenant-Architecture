# CloseDesk / Aicyro Pulse Engine — Master System Analysis & Jira Ticket Matrix

> **Target Platform:** CloseDesk Multimodal AI Voice & Visual Dispatch Engine (`v2.1.0`)  
> **Repository:** `closedesk-engine` (Production Ready)  
> **Runtime Stack:** Next.js 16.1.6 (Pages Router, Turbopack), React 19.2.4, Node.js >= 20.x, Tailwind CSS 3.4.18, Firebase Realtime Database & Storage, Firebase Cloud Functions (Node 20).

---

## 1. Executive System Topology & Architectural Map

CloseDesk is a multi-tenant enterprise engine designed for field-service contractors (HVAC, Plumbing, Electrical, Roofing, Restoration, Pest Control). It bridges the gap between incoming consumer inquiries on third-party websites and field contractors via real-time multimodal AI (WebRTC Voice, GPT-4o-mini text, and Computer Vision diagnostics).

```text
Visitor / Customer Host Website (WordPress, Webflow, Shopify, HTML)
  ├── Universal Embed Loader: <script src="https://domain.com/widget.js" data-tenant="tenant_id"></script>
  ├── Screen-Lock Consent Banner: src/Closedesk/Essential/CookieConsentBanner.jsx (GDPR/CCPA Gate)
  └── Sandboxed Transparent Iframe (/embed/chatbot?tenant={id}&anonId={uuid})
       └── AicyroChatbot: src/Closedesk/Chatbot/AicyroChatbot.jsx
            ├── POST /api/chat          → GPT-4o-mini structured JSON dialog + RTDB prospects/{session}
            ├── Storage Upload          → Firebase Storage chat_images/{session}/{ts}.jpg
            ├── POST /api/analyze-image → Multimodal GPT-4o-mini Vision + RTDB last_vision_inspection
            ├── POST /api/openai-token  → Ephemeral WebRTC token minting with client policy injection
            ├── Direct WebRTC Peer      → OpenAI Realtime Gateway (sub-100ms 24kHz bidirectional audio)
            ├── POST /api/sync-voice    → Voice telemetry, transcripts, and audio performance metrics
            ├── POST /api/leads         → RTDB /tenants/{tenantId}/leads/{leadId}
            └── queueEmailAlert()       → RTDB /email_alerts/{id} ── Firebase Cloud Function ── SMTP

Contractor & Tenant Operations Portal (/lg)
  ├── POST /api/login                   → Scrypt verification, persistent rate limiting, session cookie
  ├── Tenant Cockpit (CSR SPA):
  │    ├── HomeScreen                   → Real-time KPI velocity, visitor counts, conversion metrics
  │    ├── TerminalScreen               → Live inbound triage monitor, emergency chimes, one-click dial
  │    ├── Booking                      → Field service calendar, manual status overrides (Reschedule/Cancel)
  │    ├── Conversations                → Full text transcripts and WebRTC telemetry logs
  │    ├── CookieDataDisplay & Map      → Google Maps visitor cluster telemetry & device fingerprinting
  │    ├── Insight                      → Conversational sentiment trends and lead analytics (Recharts)
  │    ├── LiveNotifications            → Persistent audio chime alert feed
  │    ├── Report                       → Daily/weekly summaries with client-side CSV & PDF export
  │    └── Settings                     → Business profile, AI persona, brand theming, and password rotation
  └── POST /api/logout                  → Server-side session revocation in RTDB /sessions/{sessionId}

Master SuperAdmin Control Plane (/lg SuperAdmin Mode)
  ├── POST /api/superadmin/login        → Scrypt authentication, session issuance (stepUpVerified: false)
  ├── POST /api/superadmin/verify-pin   → Step-Up Authorization (RFC 6238 TOTP / PIN / Emergency Recovery)
  │                                       Elevates session in RTDB to (stepUpVerified: true)
  ├── Client Management                 → POST/GET /api/superadmin/tenants (Tenant CRUD, tier assignment)
  ├── Email Protocols                   → POST/GET /api/superadmin/settings (Global SMTP/OAuth relays)
  └── Global Theming                    → SuperAdminAppearance & cross-tenant configuration

Observability & Compliance Operations
  ├── /logs                             → POST /api/app-query (RBAC log queries across /system_logs)
  ├── Telemetry Pipeline                → POST /api/app-state (PII-scrubbed distributed trace receiver)
  ├── Daily Maintenance Cron            → /api/cron/retention-cleanup (Ephemeral transcripts & log pruning)
  ├── Security Acceptance Suite         → npm run test:cd02 (scripts/cd02_security_acceptance_suite.js)
  └── Capability Baseline Audit         → npm run audit:cd01 (scripts/cd01_baseline_audit.js)
```

---

## 2. Exhaustive Physical File Inventory & Responsibilities

| File Path | Lines | Architectural Responsibility |
|---|---|---|
| **Root Configuration** | | |
| `package.json` | 39 | Project dependencies, engine versions (Node >= 20), build/test scripts |
| `next.config.js` | 42 | Next.js compilation config, security headers, image domains |
| `tailwind.config.js` | 78 | CSS variables color mapping, dark mode selector, radial backgrounds |
| `database.rules.json` | 172 | Firebase RTDB zero-trust security rules and indexing definitions |
| `firebase.json` | 18 | Hosting and Realtime Database cloud configurations |
| `public/widget.js` | 656 | Universal embeddable client SDK with responsive iframe resizing |
| **Frontend UI Components (`src/Closedesk/`)** | | |
| `src/Closedesk/Chatbot/AicyroChatbot.jsx` | 1549 | Flagship front-desk chatbot (WebRTC voice, Vision camera, Text chat, Direct booking) |
| `src/Closedesk/Dashboard/HomeScreen.jsx` | 501 | Executive KPI velocity cockpit, conversion funnel, revenue calculator |
| `src/Closedesk/Dashboard/TerminalScreen.jsx` | 514 | Live lead triage terminal, emergency chime alerts, slide-over drawer |
| `src/Closedesk/Dashboard/Booking.jsx` | 721 | Field service dispatch calendar, date parsing, status overrides |
| `src/Closedesk/Dashboard/Conversations.jsx` | 663 | Plain-text transcript browser, drop-off point analyzer, field completeness |
| `src/Closedesk/Dashboard/Insight.jsx` | 418 | Recharts business intelligence, sentiment charts, peak hours, recommendations |
| `src/Closedesk/Dashboard/Report.jsx` | 496 | 7 analytical report dimensions, CSV Data URI export, print/PDF generator |
| `src/Closedesk/Dashboard/LiveNotifications.jsx` | 184 | Reactive audio chime alert feed with 30-day auto-pruning |
| `src/Closedesk/Dashboard/LoginScreen.jsx` | 302 | Tenant operator scrypt login form with password masking |
| `src/Closedesk/Dashboard/CookieDataDisplay.jsx` | 489 | Visitor telemetry tracker, Google Maps integration, batch purge |
| `src/Closedesk/Dashboard/cookie/CookieMap.jsx` | 136 | Google Maps radar visualizer with live geo-pins (`@vis.gl/react-google-maps`) |
| `src/Closedesk/Dashboard/cookie/CookieGrid.jsx` | 215 | Tabular device/browser/IP telemetry grid with archive filters |
| `src/Closedesk/Dashboard/Settings/BusinessProfile.jsx` | 485 | Business info, 7-day operating schedule, calculated GMT timezone selector |
| `src/Closedesk/Dashboard/Settings/Chatbotsetting.jsx` | 1138 | AI persona, voice actor selector with preview, FAQ editor, booking rules |
| `src/Closedesk/Dashboard/Settings/apearance.jsx` | 549 | 8-hue theme selector, light/dark/system mode, live screen preview |
| `src/Closedesk/Dashboard/Settings/notification-settings.jsx` | 331 | Outbound email routing, RFC 5322 validation, urgent-only filter |
| `src/Closedesk/Dashboard/Settings/PasswordChange.jsx` | 260 | Password rotation verifying salted scrypt with session rotation |
| `src/Closedesk/Dashboard/superadmin/superadminlogin.jsx` | 348 | SuperAdmin login with CAPTCHA challenge and persistent rate limiting |
| `src/Closedesk/Dashboard/superadmin/SuperAdminDashboard.jsx` | 283 | Master control plane navigation shell with responsive drawer |
| `src/Closedesk/Dashboard/superadmin/ClientManagement.jsx` | 1603 | Multi-tenant client onboarding wizard, 7 industry packs, user management |
| `src/Closedesk/Dashboard/superadmin/Settings/SuperAdminAppearance.jsx` | 240 | System-wide global fallback theme customizer |
| `src/Closedesk/Dashboard/superadmin/Settings/SuperAdminEmailProtocol.jsx` | 455 | Centralized SMTP and Google/Microsoft OAuth2 relay configuration |
| `src/Closedesk/Essential/CookieConsentBanner.jsx` | 192 | GDPR/CCPA regulatory consent gate with background blur screen-lock |
| `src/Closedesk/GlobalActivityTracker.jsx` | 98 | Unhandled frontend JavaScript error and route telemetry transmitter |
| `src/Closedesk/ThemeProvider.jsx` | 145 | Context provider synchronizing RTDB appearance values to document CSS variables |
| **Next.js Pages (`src/pages/`)** | | |
| `src/pages/index.jsx` | 144 | Public landing page, system status indicator, embed snippet copy |
| `src/pages/lg.jsx` | 604 | Main Cockpit dispatcher rendering Login, Tenant Dashboard, or SuperAdmin |
| `src/pages/logs.jsx` | 674 | SOC2 compliant RBAC log browser with live streaming and filters |
| `src/pages/embed/chatbot.jsx` | 54 | Clean transparent iframe container for third-party widget embedding |
| `src/pages/e2e-report.jsx` | 17 | Visual QA reporting dashboard embedding automated audit screenshots |
| `src/pages/404.jsx` | 48 | Branded 404 error page |
| `src/pages/_app.jsx` | 42 | Custom Next.js App wrapper injecting global styles and providers |
| `src/pages/_document.jsx` | 32 | Custom HTML Document structure with pre-rendered theme classes |
| `src/pages/layout.jsx` | 50 | Base layout container |
| **Serverless API Routes (`src/pages/api/`)** | | |
| `api/analytics.js` | 74 | POST: Ingests pageviews, clicks, and visitor hardware specs |
| `api/analyze-image.js` | 142 | POST: GPT-4o-mini Vision trade defect evaluation |
| `api/app-query.js` | 186 | POST: Secure RBAC log query engine over `system_logs/` |
| `api/app-state.js` | 89 | POST: Telemetry ingestion for frontend errors and traces |
| `api/chat.js` | 246 | POST: GPT-4o-mini completions with JSON tool calling |
| `api/cookie-consent.js` | 112 | POST: Stores visitor privacy preferences and geolocation in RTDB |
| `api/generate-email.js` | 95 | POST: Dispatches customer webhook alerts to Make.com / CRM |
| `api/insights.js` | 168 | GET/POST: Aggregates conversion metrics and conversation sentiment |
| `api/leads.js` | 210 | POST: Validates, deduplicates, and saves incoming customer leads |
| `api/login.js` | 134 | POST: Tenant operator scrypt authentication & session minting |
| `api/logout.js` | 64 | POST: Revokes tenant session in RTDB and clears cookies |
| `api/openai-token.js` | 128 | POST: Generates ephemeral OpenAI Realtime WebRTC client secrets |
| `api/sync-voice.js` | 94 | POST: Ingests WebRTC call telemetry, text transcripts, and latency |
| `api/tts.js` | 82 | POST: AWS Polly neural speech synthesis fallback |
| `api/auth/google/login.js` | 56 | GET: Google OAuth2 consent URL generator for calendar sync |
| `api/auth/google/callback.js` | 88 | GET: Exchanges Google auth code for refresh tokens |
| `api/auth/microsoft/login.js` | 54 | GET: Microsoft 365 OAuth2 consent URL generator |
| `api/auth/microsoft/callback.js` | 86 | GET: Exchanges Microsoft auth code for Graph API tokens |
| `api/cron/retention-cleanup.js` | 114 | POST/GET: Enforces privacy policies by pruning ephemeral logs |
| `api/notifications/acknowledge.js`| 62 | POST: Acknowledges unread notification feed items |
| `api/notifications/index.js` | 80 | GET: Retrieves active notification feed for tenant |
| `api/notifications/replay.js` | 76 | POST: Replays missed notification events |
| `api/notifications/settings.js` | 98 | GET/POST: Configures alert thresholds and recipient emails |
| `api/superadmin/login.js` | 145 | POST: SuperAdmin scrypt login, issuing unverified session cookie |
| `api/superadmin/logout.js` | 62 | POST: Invalidates superadmin session in RTDB |
| `api/superadmin/settings.js` | 124 | GET/POST: Step-up protected global email relay configuration |
| `api/superadmin/tenants.js` | 215 | GET/POST/PATCH/DELETE: Step-up protected tenant CRUD operations |
| `api/superadmin/verify-pin.js` | 148 | POST: Step-up verification (RFC 6238 TOTP, PIN, Recovery Code) |
| `api/user/password.js` | 118 | POST: Scrypt password update with re-authentication & session rotation |
| **Security & Core Modules (`src/lib/`)** | | |
| `src/lib/activityTracker.js` | 120 | Records client page views and widget interactions |
| `src/lib/aiTracer.js` | 95 | OpenAI completion telemetry and safe JSON response parser |
| `src/lib/alertManager.js` | 110 | Incident escalation engine pushing alerts to `system_alerts/` |
| `src/lib/apiMiddleware.js` | 165 | `withApiLogger` HOC: correlation IDs, timing, and error boundaries |
| `src/lib/auditTracer.js` | 85 | SOC2-style administrative audit logger (`recordAuditTrail`) |
| `src/lib/authCrypto.js` | 140 | Salted scrypt hashing (`N=16384, r=8, p=1`), `timingSafeStringEqual` |
| `src/lib/authSession.js` | 195 | HMAC-SHA256 signed session cookies, CSRF defense, `withSessionGuard` |
| `src/lib/cookiePersonalization.js`| 80 | UUID v4 generator for anonymous visitor tracking & consent checks |
| `src/lib/dbTracer.js` | 65 | Realtime Database latency profiler |
| `src/lib/firebase.js` | 72 | Singleton Firebase Client SDK (RTDB & Storage initialization) |
| `src/lib/handoffContract.js` | 85 | Schema contract for human agent takeover |
| `src/lib/handoffManager.js` | 110 | Live human dispatch takeover state management |
| `src/lib/idempotencyLocker.js` | 90 | Cold-start resilient mutex locking in RTDB |
| `src/lib/integrationTracer.js` | 105 | Resilient external HTTP caller with exponential backoff |
| `src/lib/leadContract.js` | 95 | Schema validation and standard normalization for leads |
| `src/lib/logger.js` | 185 | CloseDeskLogger engine with level thresholds & PII redaction |
| `src/lib/loggerPresets.js` | 115 | Logger factory (Website, API, AI, Voice, Pulse) |
| `src/lib/notificationHelper.js` | 140 | Formats and enqueues email alerts to `/email_alerts` |
| `src/lib/oauthState.js` | 75 | Cryptographic OAuth2 state generation and validation |
| `src/lib/persistentRateLimiter.js`| 130 | Sliding-window throttling in RTDB resistant to cold starts |
| `src/lib/ragTracer.js` | 85 | Knowledge retrieval and document embedding tracer |
| `src/lib/retryTracer.js` | 70 | Exponential backoff retry execution wrapper |
| `src/lib/ruleBook.js` | 380 | Master prompt and conversation policies (v2.14.0) |
| `src/lib/safeDb.js` | 95 | Safe database wrappers with timeout fallback (`safeDbGet`/`safeDbSet`) |
| `src/lib/sanitizer.js` | 80 | Centralized NoSQL key sanitizer (`sanitizeFirebaseKey`) |
| `src/lib/tenantResolver.js` | 90 | Resolves tenant slug from headers, query params, or subdomain |
| `src/lib/totp.js` | 110 | RFC 6238 TOTP generation, ±1 window verification & recovery codes |
| `src/lib/tracer.js` | 95 | Distributed tracing utilities (`generateCorrelationId`, `fetchWithTrace`) |
| `src/lib/visionRuleBook.js` | 195 | Policy book and classification categories for GPT-4o-mini Vision |
| `src/lib/voiceAuth.js` | 90 | WebRTC voice nonce validation and policy checker |
| **Cloud Functions (`functions/`)** | | |
| `functions/index.js` | 165 | Firebase Cloud Function `sendEmailAlert` (v1, Node 20 runtime) with Nodemailer |

---

## 3. Comprehensive Jira Ticket Matrix (Cross-Reference)

| Ticket Key | Epic | Issue Type | Priority | Feature Summary | Target Codebase Files |
|---|---|---|---|---|---|
| `CD-CHAT-01` | `CD-EPIC-01` | Story | P0 | Universal Embed Widget SDK & Host Telemetry | `public/widget.js`, `src/pages/embed/chatbot.jsx` |
| `CD-CHAT-02` | `CD-EPIC-01` | Story | P1 | Glassmorphic Chatbot UI, Avatars & Typewriter | `src/Closedesk/Chatbot/AicyroChatbot.jsx` |
| `CD-CHAT-03` | `CD-EPIC-01` | Story | P0 | Sub-100ms OpenAI Realtime WebRTC Voice Engine | `AicyroChatbot.jsx`, `api/openai-token.js`, `api/sync-voice.js` |
| `CD-CHAT-04` | `CD-EPIC-01` | Story | P1 | Multimodal Camera Defect Diagnostics | `AicyroChatbot.jsx`, `api/analyze-image.js`, `visionRuleBook.js` |
| `CD-CHAT-05` | `CD-EPIC-01` | Story | P0 | Conversational Lead Qualification & Direct Booking | `AicyroChatbot.jsx`, `api/leads.js`, `ruleBook.js` |
| `CD-CHAT-06` | `CD-EPIC-01` | Story | P1 | GDPR/CCPA Regulatory Consent Gate | `src/Closedesk/Essential/CookieConsentBanner.jsx` |
| `CD-DASH-01` | `CD-EPIC-02` | Story | P0 | Pulse Executive KPI Cockpit & Revenue Funnel | `src/Closedesk/Dashboard/HomeScreen.jsx` |
| `CD-DASH-02` | `CD-EPIC-02` | Story | P0 | Inbound Lead Triage Terminal & Emergency Chimes | `src/Closedesk/Dashboard/TerminalScreen.jsx` |
| `CD-DASH-03` | `CD-EPIC-02` | Story | P1 | Field Service Dispatch Calendar & Booking Overrides | `src/Closedesk/Dashboard/Booking.jsx` |
| `CD-DASH-04` | `CD-EPIC-02` | Story | P2 | Full Conversational Transcripts & Drop-off Intelligence | `src/Closedesk/Dashboard/Conversations.jsx` |
| `CD-DASH-05` | `CD-EPIC-02` | Story | P1 | AI Business Intelligence & Recharts Visualizer | `src/Closedesk/Dashboard/Insight.jsx`, `api/insights.js` |
| `CD-DASH-06` | `CD-EPIC-02` | Story | P1 | Operational Reports & Client-side CSV/PDF Export | `src/Closedesk/Dashboard/Report.jsx` |
| `CD-DASH-07` | `CD-EPIC-02` | Story | P1 | Reactive Audio Notifications Feed & 30-Day Auto Purge | `src/Closedesk/Dashboard/LiveNotifications.jsx` |
| `CD-DASH-08` | `CD-EPIC-02` | Story | P2 | Visitor Radar Map Clustering & Device Telemetry | `CookieDataDisplay.jsx`, `CookieMap.jsx`, `CookieGrid.jsx` |
| `CD-SET-01` | `CD-EPIC-03` | Story | P1 | Business Profile & 7-Day Operating Hours Schedule | `src/Closedesk/Dashboard/Settings/BusinessProfile.jsx` |
| `CD-SET-02` | `CD-EPIC-03` | Story | P0 | AI Front-Desk Persona, Voice Actor & Policy Rules | `src/Closedesk/Dashboard/Settings/Chatbotsetting.jsx` |
| `CD-SET-03` | `CD-EPIC-03` | Story | P1 | Dynamic Theming Engine & Live Screen Preview | `src/Closedesk/Dashboard/Settings/apearance.jsx` |
| `CD-SET-04` | `CD-EPIC-03` | Story | P1 | RFC 5322 Outbound Email & Alert Routing Settings | `src/Closedesk/Dashboard/Settings/notification-settings.jsx` |
| `CD-SET-05` | `CD-EPIC-03` | Story | P1 | Account Security & Salted Scrypt Password Rotation | `src/Closedesk/Dashboard/Settings/PasswordChange.jsx` |
| `CD-ADMIN-01`| `CD-EPIC-04` | Story | P0 | SuperAdmin Multi-Factor Auth & CAPTCHA Defense | `superadminlogin.jsx`, `api/superadmin/login.js` |
| `CD-ADMIN-02`| `CD-EPIC-04` | Story | P0 | Step-Up Verification (TOTP, PIN, Recovery Runbook) | `api/superadmin/verify-pin.js`, `src/lib/totp.js` |
| `CD-ADMIN-03`| `CD-EPIC-04` | Story | P0 | Multi-Tenant Onboarding & 7 Trade Industry Packs | `ClientManagement.jsx`, `api/superadmin/tenants.js` |
| `CD-ADMIN-04`| `CD-EPIC-04` | Story | P2 | Platform-Wide Global Fallback Appearance | `SuperAdminAppearance.jsx` |
| `CD-ADMIN-05`| `CD-EPIC-04` | Story | P1 | Multi-Provider SMTP & Google/Microsoft OAuth Relays | `SuperAdminEmailProtocol.jsx`, `api/superadmin/settings.js` |
| `CD-API-01` | `CD-EPIC-05` | Story | P0 | Distributed Tracing & PII-Redacting Middleware | `src/lib/apiMiddleware.js`, `src/lib/tracer.js` |
| `CD-API-02` | `CD-EPIC-05` | Story | P0 | Cryptographic Session Guard & CSRF Defense | `src/lib/authSession.js`, `src/lib/authCrypto.js` |
| `CD-API-03` | `CD-EPIC-05` | Story | P0 | Cold-Start Resilient Persistent Rate Limiter | `src/lib/persistentRateLimiter.js` |
| `CD-API-04` | `CD-EPIC-05` | Story | P0 | Conversational AI & WebRTC Token Microservices | `api/chat.js`, `api/openai-token.js`, `api/sync-voice.js` |
| `CD-API-05` | `CD-EPIC-05` | Story | P0 | Lead Ingestion & Mutex Idempotency Service | `api/leads.js`, `idempotencyLocker.js`, `leadContract.js` |
| `CD-API-06` | `CD-EPIC-05` | Story | P1 | RBAC Log Querying & Telemetry Ingestion Service | `api/app-query.js`, `api/app-state.js`, `src/pages/logs.jsx`|
| `CD-API-07` | `CD-EPIC-05` | Story | P1 | Automated Retention & Ephemeral Audio Pruning Cron | `src/pages/api/cron/retention-cleanup.js` |
| `CD-API-08` | `CD-EPIC-05` | Story | P0 | Zero-Trust Firebase RTDB Security Rules | `database.rules.json` |
| `CD-INFRA-01`| `CD-EPIC-06` | Story | P0 | Structured Logging Subsystem & Logger Presets | `src/lib/logger.js`, `src/lib/loggerPresets.js` |
| `CD-INFRA-02`| `CD-EPIC-06` | Story | P1 | SOC2 Administrative Audit Trail Recording | `src/lib/auditTracer.js` |
| `CD-INFRA-03`| `CD-EPIC-06` | Story | P0 | Firebase Cloud Function Dynamic SMTP Dispatcher | `functions/index.js` |
| `CD-INFRA-04`| `CD-EPIC-06` | Story | P1 | Resilient DB Wrappers & NoSQL Key Sanitization | `src/lib/safeDb.js`, `src/lib/sanitizer.js` |
| `CD-INFRA-05`| `CD-EPIC-06` | Story | P0 | Deterministic Verification & Acceptance Test Suites | `scripts/cd01_baseline_audit.js`, `cd02_...`, `cd03_...` |

---

## 4. Verification & Testing Instructions

To verify each ticket before closing in Jira:

1. **Verify Capability Baseline Audit (CD01):**
   ```bash
   npm run audit:cd01
   ```
2. **Verify Security Acceptance Suite (CD02):**
   ```bash
   npm run test:cd02
   ```
3. **Verify Tenant Isolation & Secret Protection (CD03):**
   ```bash
   npm run test:cd03
   ```
4. **Verify Lead Consistency & Booking Integrity (CD06):**
   ```bash
   npm run test:cd06
   ```
5. **Verify Clean Production Build:**
   ```bash
   npm run build
   ```
