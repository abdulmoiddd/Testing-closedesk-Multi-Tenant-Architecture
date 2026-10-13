# CloseDesk / AicyroNext — Repository Analysis

Updated: 13 October 2026, reflecting the current workspace sync at `d:\Software House 01\CloseDesk-Aicyro-GIT`.

**Repository sync snapshot:** This document reflects the current Next.js application, Firebase-backed admin dashboard, observability logs, and Cloud Functions as they exist in the synced workspace. It is intended as a living architecture map for onboarding, review, and dependency tracking.

**Product:** CloseDesk (branded publicly as Aicyro) — a marketing site plus an AI front-desk widget (text chat, OpenAI Realtime voice, and Vision image diagnostics), a Pulse admin dashboard (`/lg`), structured logging (`/logs`), and Firebase-backed lead/email automation.

**Runtime:** Next.js 16 pages router, React 19, Tailwind 3, Firebase Realtime Database + Storage, OpenAI (chat JSON, Vision `gpt-4o-mini`, Realtime WebRTC), AWS Polly (TTS preview), Firebase Cloud Functions (dynamic Gmail SMTP).

**Current repo highlights (2026 refresh):** This workspace includes live OAuth-based email provider setup for Google and Microsoft365 alongside the earlier SMTP flow, a dedicated superadmin email protocol UI, and additional dashboard cookie-management screens. The platform still uses the classic pages router, but the admin surface now spans email configuration, OAuth connection flows, and more granular cookie/analytics views than the original analysis captured.

---

## 1. How the system fits together

```text
Visitor browser
  ├─ Marketing pages (/) ── Navbar, landing sections, cookie banner
  ├─ AicyroChatbot (layout.jsx, hidden on /lg and /logs)
  │    ├─ POST /api/chat          → OpenAI JSON chat + prospects/{session}
  │    ├─ Firebase Storage upload → chat_images/{session}/{ts}.jpg
  │    ├─ POST /api/analyze-image → Vision (gpt-4o-mini) + last_vision_inspection
  │    ├─ POST /api/openai-token  → OpenAI Realtime client secret
  │    ├─ POST /api/sync-voice    → voice tools, transcripts, telemetry
  │    ├─ POST /api/leads         → leads/{id}
  │    └─ queueEmailAlert()       → email_alerts/{id} ── Cloud Function ── SMTP
  ├─ Free audit wizard        → POST /api/generate-audit → audits/{id}
  └─ Analytics / logs         → /api/analytics, logger → /api/app-state

Admin (/lg)
  ├─ Login vs Firebase `login` / `superadmins`
  ├─ Live RTDB listeners: leads, bookings, conversations, settings
  └─ Settings write chatbot_config, appearance, notifications, email_config

Ops
  ├─ /logs  → POST /api/app-query (RBAC over system_logs)
  ├─ GitHub Actions daily → /api/cron/retention-cleanup
  └─ Cloud Function cron hourly → scheduled_reminders
```

Two policy documents drive the AI:

| Policy                  | File                        | Version                                                                    |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------- |
| Text + voice front desk | `src/lib/ruleBook.js`       | `2.11.0` (merged with `settings/chatbot_config`, including `voiceEnabled`) |
| Image diagnostics       | `src/lib/visionRuleBook.js` | `1.1.0` (`gpt-4o-mini`)                                                    |

---

## 2. Complete file structure

Omitted: `node_modules/`, `.next/`, lockfile internals, and local env files. Duplicate/legacy copies are listed because they still exist.

```text
CloseDesk-Aicyro-GIT/
├── .eslintrc.json
├── .firebaserc
├── .github/workflows/retention-cron.yml
├── .gitignore
├── .npmrc
├── README.md
├── REDIRECT_CONFIG.md
├── REPOSITORY_ANALYSIS.md
├── eslint.config.mjs
├── firebase.json
├── jsconfig.json
├── next.config.js
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── docs/
│   ├── LOGGING_SCHEMA.md
│   ├── VOICE_PRIVACY_POLICY.md
│   ├── VOICE_PRODUCTION_READINESS_SIGNOFF.md
│   └── VOICE_QA_TEST_SUITE.md
├── evaluations/
│   └── report_v2.1.0.json
├── functions/
│   ├── .eslintrc.js
│   ├── .gitignore
│   ├── index.js                    (dynamic SMTP from RTDB + inline SVG logo)
│   ├── package.json
│   ├── package-lock.json
│   └── assets/logo.png             (legacy; emails now attach inline SVG)
├── public/
│   ├── avatars/ai-spark.svg
│   ├── og-image.svg
│   ├── robot.svg
│   └── robots.txt
├── scripts/
│   ├── qa-simulator.js
│   ├── run_evaluations.js
│   ├── vad_tuning_harness.js
│   └── voice_qa_harness.js
└── src/
    ├── assets/icon.svg, robot.svg
    ├── database.json
    ├── styles/globals.css, globals copy.css
    ├── lib/                        (18 modules)
    ├── pages/                      (routes + API)
    └── components/                 (UI)
```

### `src/pages/`

```text
_app.jsx, _document.jsx, layout.jsx
index.jsx, 404.jsx, lg.jsx, logs.jsx
free-website-audit.jsx, privacy.jsx, cookie.jsx, termofuse.jsx
api/
  analyze-image.js, analytics.js, app-query.js, app-state.js, chat.js
  generate-audit.js, generate-email.js, insights.js, leads.js
  login.js, openai-token.js, openai-token copy.js, openai-token copy 2.js
  sync-voice.js, tts.js, upload-logo.js
  auth/google/{login.js, callback.js}
  auth/microsoft/{login.js, callback.js}
  cron/retention-cleanup.js
```

### `src/lib/`

```text
firebase.js, ruleBook.js, visionRuleBook.js, cookiePersonalization.js
logger.js, loggerPresets.js, alertManager.js
apiMiddleware.js, tracer.js, aiTracer.js, ragTracer.js
toolTracer.js, dbTracer.js, retryTracer.js, integrationTracer.js
auditTracer.js, activityTracker.js, notificationHelper.js
```

### `src/components/`

```text
ThemeProvider.jsx, ThemeToggle.jsx, GlobalActivityTracker.jsx
Chatbot/AicyroChatbot.jsx
Essential/{Navbar, Navbar copy, Footer, Seo, CookieConsentBanner, Secondary_navbar}.jsx
Form/{Popupform, PopupModel}.jsx
Home/{Hero, Problem, TheTurn, NightScene, Pricing, Compare, NotFor, Trust, Offer, Faq, Cta}.jsx
Home/OLD/{Speed, Solution, LivePreviewSection, Process, Industries, Pulse,
          Founding, DoneForYou, TheDifference, FaqAndFooter}.jsx
Dashboard/{LoginScreen, HomeScreen, TerminalScreen, NewScreen, Booking, Insight,
           Conversations, Report, OperatingHours, LiveNotifications,
           CookieDataDisplay, SettingsScreen, cookie/CookieGrid, cookie/CookieMap}.jsx
Dashboard/Settings/{PasswordChange, BusinessProfile, Chatbotsetting,
                    notification-settings, apearance}.jsx
Dashboard/superadmin/{superadminlogin, SuperAdminDashboard, ClientManagement}.jsx
Dashboard/superadmin/Settings/{SuperAdminAppearance, SuperAdminEmailProtocol}.jsx
```

---

## 3. External dependencies

### 3.1 npm — Next.js app (`package.json`)

| Package                                    | Role in this repo                                                   |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `next` ^16.1.6                             | Pages router, API routes, build                                     |
| `react` / `react-dom` ^19.2.4              | UI                                                                  |
| `firebase` ^12.13.0                        | Client RTDB + **Storage** (`getStorage` in `src/lib/firebase.js`)   |
| `openai` ^6.37.0                           | Chat Completions, Vision (`image_url`), Realtime client secrets     |
| `@aws-sdk/client-polly`                    | `/api/tts` MP3 synthesis for dashboard voice preview                |
| `@aws-sdk/client-transcribe`               | Declared; **not imported** by application source                    |
| `@vis.gl/react-google-maps`               | Map-based cookie/geolocation display in the dashboard               |
| `formidable`                               | Declared; **not used** (`upload-logo.js` is a misplaced token mint) |
| `framer-motion`                            | Landing motion (`Home/OLD/DoneForYou` and similar)                  |
| `jspdf`                                    | PDF export on `/free-website-audit`                                 |
| `lucide-react`                             | Icons                                                               |
| `node-fetch`                               | Used in OAuth callback code for Google/Microsoft token exchange      |
| `react-hot-toast`                          | Still in package.json; notification settings now use a custom toast |
| `recharts`                                 | Insight charts                                                      |
| `tailwindcss` + `postcss` + `autoprefixer` | Styling                                                             |
| `eslint` + `eslint-config-next`            | Lint                                                                |

Path alias: `@/*` → `./src/*` (`jsconfig.json`). `.npmrc` sets `legacy-peer-deps=true`.

### 3.2 npm — Cloud Functions (`functions/package.json`)

| Package                 | Role                                      |
| ----------------------- | ----------------------------------------- |
| `firebase-functions` v1 | RTDB `onCreate`, Pub/Sub schedule         |
| `firebase-admin`        | Server RTDB                               |
| `nodemailer`            | Gmail SMTP (credentials from RTDB or env) |

Engine: Node 20. Firebase project: `aichatbot-a6217` (`.firebaserc`).

### 3.3 Hosted / HTTP services

| Service                          | Used by                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Firebase Realtime Database       | APIs, dashboard, chatbot, Cloud Functions                                             |
| Firebase Storage                 | Chatbot uploads `chat_images/{session_id}/{timestamp}.jpg`                            |
| OpenAI Chat Completions          | `/api/chat`, `/api/leads` (abandoned summary), `/api/insights`, `/api/generate-audit` |
| OpenAI Vision                    | `/api/analyze-image` (`gpt-4o-mini`, `detail: "low"`)                                 |
| OpenAI Realtime `client_secrets` | `/api/openai-token`                                                                   |
| OpenAI TTS (script)              | `scripts/voice_qa_harness.js`                                                         |
| AWS Polly                        | `/api/tts`                                                                            |
| Make.com webhook                 | `/api/generate-email`                                                                 |
| Gmail SMTP                       | `functions/index.js` via `settings/email_config` or `GMAIL_*` env                     |
| GitHub Actions                   | Daily POST to `https://aicyro.pro/api/cron/retention-cleanup`                         |
| Netlify (inferred)               | Production host in cron workflow; `.netlify/` gitignored                              |

### 3.4 Environment variables (names only)

- Firebase public: `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId, measurementId)
- App: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`
- Secrets: `OPENAI_API_KEY`, `CUSTOM_AWS_REGION`, `CUSTOM_AWS_ACCESS_KEY_ID`, `CUSTOM_AWS_SECRET_ACCESS_KEY`, `MAKE_COM_EMAIL_WEBHOOK_URL`, `WEBHOOK_SECRET`, `CRON_SECRET`
- Functions fallback: `GMAIL_EMAIL`, `GMAIL_PASSWORD` (overridden by `settings/email_config` when present)

---

## 4. Internal dependency map

### 4.1 Logging / tracing stack

```text
cookiePersonalization
        ↑
loggerPresets ← logger ← alertManager ← firebase
        ↑
apiMiddleware ← tracer (generateCorrelationId)
        ↑
AI routes: aiTracer, ragTracer, retryTracer, toolTracer, dbTracer, auditTracer
integrationTracer → retryTracer
```

`CloseDeskLogger._transmitToCentralDatabase` POSTs every log to `/api/app-state` (not wrapped in `withApiLogger`, to avoid recursion).

### 4.2 Chat / voice / vision runtime

```text
layout.jsx → AicyroChatbot
               ├─ notificationHelper → firebase (`notifications`, `email_alerts`)
               ├─ activityTracker → /api/analytics
               ├─ firebase/storage → chat_images/...
               ├─ tracer.fetchWithTrace → /api/chat, /api/analyze-image,
               │                         /api/openai-token, /api/sync-voice, /api/leads
               └─ firebase RTDB (settings/chatbot_config)

/api/chat           → ruleBook, openai, firebase, ragTracer, aiTracer, retryTracer
/api/analyze-image  → visionRuleBook, openai, firebase (prospects + leads)
/api/openai-token   → ruleBook, firebase, OpenAI HTTP
/api/sync-voice     → firebase
functions/index.js  ← email_alerts, scheduled_reminders, settings/email_config
```

### 4.3 App shell

```text
_document.jsx (FOUC theme script)
     ↓
_app.jsx → ThemeProvider, layout, GlobalActivityTracker, CookieConsentBanner, trackVisit
     ↓
pages (index, legal, audit, lg, logs, 404)
```

### 4.4 Pulse dashboard (`/lg`)

`lg.jsx` is the router/shell. Most screens talk **directly** to the Firebase client SDK. Exceptions: Insight → `/api/insights`, TerminalScreen → `/api/leads`. Notification settings now also write `settings/email_config`.

### 4.5 Unused / leftover internals

| File                                             | Notes                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/api/upload-logo.js`                   | Name/export say upload; **body is a voice token mint**                                                                                            |
| `openai-token copy.js`, `openai-token copy 2.js` | Duplicate token APIs                                                                                                                              |
| `src/styles/globals copy.css`, `Navbar copy.jsx` | Copies; audit page still uses Navbar copy                                                                                                         |
| `src/lib/toolTracer.js`                          | Implemented; **no API currently imports it**                                                                                                      |
| `@aws-sdk/client-transcribe`, `formidable`       | In package.json, unused in `src/`                                                                                                                 |
| `Home/OLD/*`                                     | Imported in `index.jsx` but commented out in the render tree                                                                                      |
| `functions/assets/logo.png`                      | Unused; emails embed inline SVG (`cid:company-logo`)                                                                                              |
| `REDIRECT_CONFIG.md`                             | Documents redirects **not** present in `next.config.js`                                                                                           |
| `src/database.json`                              | Seed login objects with plaintext passwords                                                                                                       |
| Notification field names                         | UI writes `emailAlerts`, `urgentOnly`, `adminEmail`. Function still reads `urgentAlerts`, `afterHoursAlerts`, plus `adminEmail` / `leadReceivers` |

---

## 5. Firebase paths (internal data graph)

### Realtime Database

| Path                                                  | Writers                                                          | Readers                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `settings/chatbot_config`                             | ChatbotSettings                                                  | ruleBook, AicyroChatbot, openai-token         |
| `settings/email_config`                               | NotificationSettings (`senderName`, `smtpEmail`, `smtpPassword`) | Cloud Function `getDynamicTransporter`        |
| `settings/log_retention`                              | (dashboard, if present)                                          | retention-cleanup                             |
| `login`                                               | PasswordChange, ClientManagement                                 | login API, LoginScreen                        |
| `superadmins`                                         | superadmin flows                                                 | SuperAdminLogin                               |
| `users/{username}/appearance`                         | Appearance settings                                              | ThemeProvider, lg.jsx                         |
| `users/root/notifications`                            | NotificationSettings                                             | Cloud Function (receiver + alert gates)       |
| `prospects/{session_id}`                              | chat, sync-voice                                                 | chat, openai-token, sync-voice, analyze-image |
| `prospects/{session_id}/last_vision_inspection`       | analyze-image (relevant images only)                             | lead/CRM consumers                            |
| `session_actions/{session_id}`                        | chat, sync-voice                                                 | same                                          |
| `transcripts/{session_id}`                            | sync-voice; wiped by chat deletion                               | Conversations                                 |
| `leads/{id}`                                          | /api/leads; analyze-image (issue/urgency/image URL)              | dashboard, insights                           |
| `audits/{id}`                                         | generate-audit                                                   | Report / audit UI                             |
| `email_alerts/{id}`                                   | notificationHelper                                               | `sendEmailAlert`                              |
| `scheduled_reminders`                                 | Cloud Function                                                   | `processScheduledReminders`                   |
| `notifications`                                       | notificationHelper                                               | LiveNotifications                             |
| `analytics/*`                                         | /api/analytics                                                   | HomeScreen / Report                           |
| `analytics_events`                                    | /api/chat                                                        | analytics consumers                           |
| `voice_telemetry/{session}`, `voice_errors/{session}` | sync-voice                                                       | ops                                           |
| `system_logs/structured_events/{log_id}`              | /api/app-state                                                   | /api/app-query, retention                     |
| `system_logs/activity_events`                         | legacy                                                           | app-query merge                               |
| `system_alerts`                                       | alertManager                                                     | ops                                           |
| `logs/email_errors`                                   | Cloud Function                                                   | ops                                           |

### Storage

| Path                                       | Writer                                       | Consumer                              |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------- |
| `chat_images/{session_id}/{timestamp}.jpg` | AicyroChatbot (`uploadString` JPEG data URL) | `/api/analyze-image` via download URL |

---

## 6. File-by-file core logic

### 6.1 Root / config

| File                 | Logic                                                              |
| -------------------- | ------------------------------------------------------------------ |
| `package.json`       | Scripts: `dev`, `build`, `start`, `lint`, `test:ai`                |
| `next.config.js`     | `{ reactStrictMode: true }` only                                   |
| `jsconfig.json`      | `@/` alias                                                         |
| `tailwind.config.js` | `darkMode: "class"`; CSS-variable tokens; scans pages + components |
| `postcss.config.js`  | Tailwind + Autoprefixer                                            |
| `eslint.config.mjs`  | Flat config wrapping `next/core-web-vitals`                        |
| `.eslintrc.json`     | Legacy ESLint config (alongside flat)                              |
| `firebase.json`      | Deploys `functions/`                                               |
| `.firebaserc`        | Default project `aichatbot-a6217`                                  |
| `.gitignore`         | node_modules, Next output, `.env*`, `.netlify`                     |
| `.npmrc`             | `legacy-peer-deps=true`                                            |
| `README.md`          | Outdated route list (`/services`, `/portfolio` do not exist)       |
| `REDIRECT_CONFIG.md` | How-to for redirects not wired in config                           |

### 6.2 Docs / evaluations / public / assets

| File                                         | Logic                                   |
| -------------------------------------------- | --------------------------------------- |
| `docs/LOGGING_SCHEMA.md`                     | Canonical structured log fields         |
| `docs/VOICE_PRIVACY_POLICY.md`               | Voice data handling                     |
| `docs/VOICE_PRODUCTION_READINESS_SIGNOFF.md` | Launch checklist                        |
| `docs/VOICE_QA_TEST_SUITE.md`                | Voice QA scenarios                      |
| `evaluations/report_v2.1.0.json`             | Last `npm run test:ai` output           |
| `public/*`                                   | SEO/static                              |
| `src/assets/*`                               | Component-imported SVGs                 |
| `src/styles/globals.css`                     | Theme CSS variables                     |
| `src/styles/globals copy.css`                | Duplicate stylesheet                    |
| `src/database.json`                          | Local seed of `login` users (plaintext) |

### 6.3 Cloud Functions

**`functions/index.js`**

1. `getDynamicTransporter()` — reads `settings/email_config` (`smtpEmail`, `smtpPassword`, `senderName`); falls back to `GMAIL_EMAIL` / `GMAIL_PASSWORD`. Throws if neither is set.
2. Logo — inline SVG attached as `logo.svg` with `cid:company-logo` (no filesystem PNG).
3. `sendEmailAlert` — onCreate `/email_alerts/{alertId}`: skip if not `pending`; load `users/root/notifications` (`adminEmail` or `leadReceivers`); honor `urgentAlerts` / `afterHoursAlerts`; send admin HTML; optional visitor confirmation from the same SMTP identity; queue `scheduled_reminders`.
4. `processScheduledReminders` — hourly: initialize one dynamic transporter, send due reminders.

**`functions/assets/logo.png`** — leftover; not referenced by current `index.js`.

**`functions/.eslintrc.js`** — Google ESLint for Functions.

### 6.4 GitHub

**`.github/workflows/retention-cron.yml`** — Daily 00:00 UTC (and manual) `curl` with `CRON_SECRET` to production retention API.

### 6.5 Scripts

| File                            | Logic                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `scripts/run_evaluations.js`    | Hits local `/api/chat` (pricing/handoff/deletion); writes `evaluations/report_*.json` |
| `scripts/qa-simulator.js`       | Smoke tests chat + sync-voice                                                         |
| `scripts/voice_qa_harness.js`   | OpenAI TTS MP3s for pronunciation QA                                                  |
| `scripts/vad_tuning_harness.js` | Offline VAD pause vs `silence_duration_ms`                                            |

### 6.6 `src/lib` (core)

| File                       | Logic                                                                                                                       | Internal deps                        | External                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| `firebase.js`              | Singleton app, `db`, **`storage`** (legacy commented block above live code)                                                 | —                                    | `firebase/app`, `database`, `storage` |
| `ruleBook.js`              | Defaults + merge `settings/chatbot_config`; text JSON schema vs voice brevity; `POLICY_VERSION` `2.11.0`                    | firebase                             | Firebase                              |
| `visionRuleBook.js`        | Vision system prompt: allowed home-service domains, `is_irrelevant` rejection, JSON schema; `VISION_POLICY_VERSION` `1.1.0` | —                                    | —                                     |
| `cookiePersonalization.js` | Strict cookies: consent + anon UUID                                                                                         | —                                    | `document.cookie`                     |
| `logger.js`                | Redact secrets/PII, POST `/api/app-state`, smart alerts                                                                     | alertManager                         | fetch                                 |
| `loggerPresets.js`         | Website, API, AI, Voice, Pulse factories                                                                                    | logger, cookiePersonalization        | —                                     |
| `alertManager.js`          | CRITICAL throttle 5 min → `system_alerts`                                                                                   | firebase                             | Firebase                              |
| `apiMiddleware.js`         | Correlation, latency, status, 500 catch                                                                                     | loggerPresets, tracer                | —                                     |
| `tracer.js`                | UUID + `fetchWithTrace` 15s abort                                                                                           | cookiePersonalization, loggerPresets | fetch                                 |
| `aiTracer.js`              | LLM lifecycle + `safeParseAiResponse`                                                                                       | —                                    | —                                     |
| `ragTracer.js`             | Retrieval IDs/scores, not content                                                                                           | —                                    | —                                     |
| `toolTracer.js`            | Tool JSON parse + execute                                                                                                   | —                                    | —                                     |
| `dbTracer.js`              | Time Firebase ops; classify failures                                                                                        | —                                    | —                                     |
| `retryTracer.js`           | Exponential backoff                                                                                                         | —                                    | —                                     |
| `integrationTracer.js`     | Sanitize URL/headers, fetch + retry                                                                                         | retryTracer                          | fetch                                 |
| `auditTracer.js`           | who/what/target/previous/new                                                                                                | —                                    | —                                     |
| `activityTracker.js`       | Skip `/lg`; POST analytics events                                                                                           | cookiePersonalization                | `/api/analytics`                      |
| `notificationHelper.js`    | `logToFirebase` + `queueEmailAlert`                                                                                         | firebase                             | Firebase                              |

### 6.7 API routes

| File                        | Logic                                                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat.js`                   | POST. Rate-limit 15/min/session. Prompt-injection flag. Merge prospect + client lead. Mock RAG. `getMasterRuleBook("text")`. OpenAI JSON with retry+trace. Persist `prospects` / `session_actions`. Wipe transcripts on `TRIGGER_DATA_DELETION`. Fallback 200 reply on engine failure. |
| `analyze-image.js`          | POST `{ session_id, image_url, user_prompt }`. Load prospect business context. Vision JSON via `getVisionSystemPrompt`. If `is_irrelevant`, return reply **without** writing CRM. Else write `prospects/{id}/last_vision_inspection` and patch `leads/{id}`.                           |
| `openai-token.js`           | POST. Validate `lead_{ts}_{hash}`. Rate-limit 5/min. Voice rulebook. **403 if `voiceEnabled === false`**. Mint Realtime client secret + tools.                                                                                                                                         |
| `sync-voice.js`             | POST telemetry, errors, transcripts, or `tool_name` routing with `session_actions` idempotency.                                                                                                                                                                                        |
| `leads.js`                  | GET all leads. POST upsert; duplicate skip; abandoned-chat summary; dbTracer.                                                                                                                                                                                                          |
| `app-state.js`              | POST ingest structured log                                                                                                                                                                                                                                                             |
| `app-query.js`              | POST RBAC log query; merge legacy; cap 1500; tenant isolation                                                                                                                                                                                                                          |
| `analytics.js`              | POST counters + visitor events                                                                                                                                                                                                                                                         |
| `login.js`                  | POST plaintext match against `login`; audit trail                                                                                                                                                                                                                                      |
| `insights.js`               | POST last 50 leads → OpenAI KPI/chart JSON                                                                                                                                                                                                                                             |
| `generate-audit.js`         | POST save audit lead, GPT report (re-inits Firebase locally)                                                                                                                                                                                                                           |
| `generate-email.js`         | POST Make.com via integrationTracer                                                                                                                                                                                                                                                    |
| `tts.js`                    | POST Polly neural MP3; maps OpenAI `ash` → Polly `Matthew`                                                                                                                                                                                                                             |
| `upload-logo.js`            | **Misnamed** Realtime token mint                                                                                                                                                                                                                                                       |
| `openai-token copy*.js`     | Older token handlers                                                                                                                                                                                                                                                                   |
| `cron/retention-cleanup.js` | Bearer `CRON_SECRET`; approved retention policy; delete aged logs                                                                                                                                                                                                                      |

### 6.8 Pages (routes)

| File                                           | Logic                                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_document.jsx`                                | Inline theme script except `/lg`                                                                                                                                     |
| `_app.jsx`                                     | ThemeProvider, layout, GlobalActivityTracker, visit tracking, cookie banner (not on `/logs`)                                                                         |
| `layout.jsx`                                   | Chatbot except `/lg` and `/logs`                                                                                                                                     |
| `index.jsx`                                    | Navbar, PopupModal, Hero, NightScene, TheTurn, Problem, Pricing, Compare, NotFor, Trust, Offer, Faq, CTA, Footer, Popupform. `Home/OLD/*` imported but commented out |
| `lg.jsx`                                       | Pulse shell: reload terminates session; user vs superadmin; sidebar views                                                                                            |
| `logs.jsx`                                     | localStorage auth; poll `/api/app-query`                                                                                                                             |
| `free-website-audit.jsx`                       | 16-step wizard; `/api/generate-audit`; jsPDF; Navbar copy                                                                                                            |
| `privacy.jsx` / `cookie.jsx` / `termofuse.jsx` | Static legal                                                                                                                                                         |
| `404.jsx`                                      | Themed 404                                                                                                                                                           |

### 6.9 Chatbot

**`AicyroChatbot.jsx`** — Widget state machine (`WELCOME` → chat / booking). Dual loggers (AI + Voice). Loads `chatbot_config`.

- **Text:** `fetchWithTrace("/api/chat")`; shortcuts and booking calendar.
- **Voice:** token → WebRTC; tools → `/api/sync-voice`.
- **Vision:** gallery file or webcam capture → client JPEG compress → Storage `chat_images/{session}/{ts}.jpg` → `/api/analyze-image`. Irrelevant images still get a polite bot reply; lead fields update only when `is_irrelevant` is false.
- Emails via `notificationHelper`. Leads via `/api/leads`.

### 6.10 Essential / theme / forms

| File                               | Logic                                                     |
| ---------------------------------- | --------------------------------------------------------- |
| `ThemeProvider.jsx`                | Public vs dashboard theme; live `users/{user}/appearance` |
| `ThemeToggle.jsx`                  | localStorage light/dark                                   |
| `GlobalActivityTracker.jsx`        | Window error / resource 404 / unhandledrejection          |
| `Seo.jsx`                          | `next/head`                                               |
| `Navbar.jsx`                       | Marketing nav                                             |
| `Navbar copy.jsx`                  | Used by audit page                                        |
| `Footer.jsx`                       | Footer links                                              |
| `CookieConsentBanner.jsx`          | Consent cookie + anon id                                  |
| `Popupform.jsx` / `PopupModel.jsx` | Lead popups writing Firebase                              |

### 6.11 Home (current)

Hero, Problem, NightScene, TheTurn, Pricing, Compare, NotFor, Trust, Offer, Faq, Cta. React + lucide + CSS; **no API**.

### 6.12 Home/OLD

Legacy blocks still imported by `index.jsx` but commented out in the return: Speed, Solution, LivePreviewSection, Process, Industries, Pulse, Founding, DoneForYou, TheDifference, FaqAndFooter.

### 6.13 Dashboard (Pulse)

| File                        | Logic                                                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoginScreen.jsx`           | Client login vs `login` node                                                                                                                                                             |
| `superadminlogin.jsx`       | Superadmin login                                                                                                                                                                         |
| `SuperAdminDashboard.jsx`   | Superadmin shell                                                                                                                                                                         |
| `ClientManagement.jsx`      | CRUD clients + audit                                                                                                                                                                     |
| `SuperAdminAppearance.jsx`  | Superadmin theme                                                                                                                                                                         |
| `HomeScreen.jsx`            | Analytics summary from RTDB                                                                                                                                                              |
| `TerminalScreen.jsx`        | Lead terminal via `/api/leads`                                                                                                                                                           |
| `NewScreen.jsx`             | Alternate view stub                                                                                                                                                                      |
| `Booking.jsx`               | Live bookings; status `update`                                                                                                                                                           |
| `Insight.jsx`               | `/api/insights` + recharts                                                                                                                                                               |
| `Conversations.jsx`         | Transcripts / leads                                                                                                                                                                      |
| `Report.jsx`                | Reporting from RTDB                                                                                                                                                                      |
| `OperatingHours.jsx`        | Hours from Firebase                                                                                                                                                                      |
| `LiveNotifications.jsx`     | Live `notifications`                                                                                                                                                                     |
| `CookieDataDisplay.jsx`     | Visitor cookie/geo + maps                                                                                                                                                                |
| `SettingsScreen.jsx`        | Combined settings writer                                                                                                                                                                 |
| `PasswordChange.jsx`        | Update `login` passwords                                                                                                                                                                 |
| `BusinessProfile.jsx`       | Business profile                                                                                                                                                                         |
| `Chatbotsetting.jsx`        | Writes `settings/chatbot_config`                                                                                                                                                         |
| `notification-settings.jsx` | Two cards: **Outgoing Sender** (`settings/email_config`) and **Admin Alert Routing** (`users/root/notifications`: `emailAlerts`, `adminEmail`, `urgentOnly`). Custom toast, Pulse logger |
| `apearance.jsx`             | Theme preview using Home/Terminal/Booking                                                                                                                                                |

---

## 7. Request / data flows

### Text chat

1. Widget creates `session_id` matching `lead_{timestamp}_{hash}`.
2. User message → `/api/chat` with history + `current_lead_data`.
3. Server merges `prospects/{session}`, builds policy prompt, calls GPT JSON.
4. Sanitized `context_patch` saved; flags enqueue `session_actions`.
5. Widget may POST `/api/leads` and `queueEmailAlert` → Function emails via dynamic SMTP.

### Voice

`/api/openai-token` (kill switch) → browser WebRTC → model tool calls → `/api/sync-voice` on the same prospect graph.

### Vision

1. User picks gallery image or captures webcam JPEG (compressed client-side).
2. Upload to Storage `chat_images/{session_id}/{timestamp}.jpg`.
3. POST download URL to `/api/analyze-image`.
4. `visionRuleBook` prompt + `gpt-4o-mini` returns JSON (`is_irrelevant`, issue, component, urgency, reply, shortcuts).
5. Irrelevant: reply only. Relevant: write `last_vision_inspection` and patch lead urgency/issue.

### Email

1. Dashboard saves SMTP to `settings/email_config`.
2. `queueEmailAlert` pushes `email_alerts/{id}` with `status: "pending"`.
3. Function builds transporter from RTDB (else env), sends branded HTML with inline SVG logo, optionally queues reminders.

---

## 8. Notable architectural facts

- **Pages router only** — no `src/app/`.
- **Observability is first-class**: almost every API is `withApiLogger`; UI uses presets; logs land in RTDB and `/logs`.
- **RAG is stubbed**: chat wraps a mock vector search when `retrievedKnowledge` is passed from the client.
- **Auth is not Firebase Auth**: dashboard uses RTDB password tables + `localStorage`; some admin flows also rely on OAuth-backed mail providers. `/api/app-query` still trusts client-supplied `role`/`userId`.
- **Voice rollback**: `settings/chatbot_config.voiceEnabled = false` hides UI and 403s token mint.
- **Vision is domain-gated**: off-topic photos are rejected in-model (`is_irrelevant`) and never stored as defects.
- **SMTP is dashboard-owned**: functions no longer hard-bind only to env Gmail; `settings/email_config` wins, and Google/Microsoft OAuth providers can populate SMTP identity + refresh token state.
- **SMTP secrets live in RTDB** (`smtpPassword`, OAuth `refreshToken`, `clientId`, `clientSecret`) if an admin saves them from Pulse — treat that node as highly sensitive.
- **Notification schema drift**: Pulse UI fields (`emailAlerts`, `urgentOnly`) do not match Function gates (`urgentAlerts`, `afterHoursAlerts`). Receiver does use `adminEmail`.
- **Superadmin email protocol support**: `SuperAdminEmailProtocol.jsx` exposes provider presets for Google, Microsoft 365, Hostinger, Namecheap, cPanel, and custom SMTP, then persists them in `settings/email_config`.

---

## 9. Suggested reading order for engineers

1. `src/lib/ruleBook.js` — text/voice product policy
2. `src/lib/visionRuleBook.js` + `src/pages/api/analyze-image.js` + vision path in `AicyroChatbot.jsx`
3. `src/pages/api/chat.js` + `src/components/Chatbot/AicyroChatbot.jsx`
4. `src/pages/api/openai-token.js` + `sync-voice.js`
5. `src/lib/logger.js` + `apiMiddleware.js` + `docs/LOGGING_SCHEMA.md`
6. `functions/index.js` + `notificationHelper.js` + `notification-settings.jsx`
7. `src/pages/lg.jsx` + `Chatbotsetting.jsx`
