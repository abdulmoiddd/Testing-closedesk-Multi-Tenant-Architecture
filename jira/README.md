# CloseDesk Jira Documentation & System Analysis Repository

Welcome to the CloseDesk Jira Documentation folder. This directory contains an exhaustive, production-grade analysis of functionality, UI/UX design, technical architecture, and Jira ticket specifications for the CloseDesk Multimodal AI Dispatch Engine (`v2.1.0`).

---

## Document Index & Navigation

1. **[Master System Analysis & Jira Ticket Matrix](MASTER_SYSTEM_ANALYSIS_AND_TICKETS.md)**
   * Complete top-level architectural map.
   * Inventory of all 84 active files in `src/`, `public/`, `functions/`, `scripts/`, and `docs/`.
   * Complete Cross-Reference Ticket Matrix (36 detailed Jira tickets from `CD-CHAT-01` to `CD-INFRA-05`).

2. **[UI/UX Design System Specification](UI_UX_DESIGN_SYSTEM_SPECIFICATION.md)**
   * Glassmorphic visual language, radial spotlight glow tokens, and responsive breakpoints.
   * Complete CSS variables token table (`--background`, `--foreground`, `--primary`, `--card-bg`, etc.).
   * 8 Theme Hue palettes (Violet, Red, Orange, Yellow, Green, Blue, Indigo, Violet) in light & dark modes.
   * Dynamic shade math engine (`color-mix`), typography hierarchy, and status badges.

3. **[EPIC-01: Front-Desk Multimodal AI Chatbot & Universal Embed Widget](EPIC-01_FRONTEND_CHATBOT_AND_WIDGET.md)**
   * `CD-CHAT-01`: Universal Embeddable Widget SDK (`widget.js`) & Host Telemetry.
   * `CD-CHAT-02`: Glassmorphic Chatbot UI, Avatars & Typewriter Streaming (`AicyroChatbot.jsx`).
   * `CD-CHAT-03`: Sub-100ms OpenAI Realtime WebRTC Voice Engine & Audio Waveform.
   * `CD-CHAT-04`: Visual Defect Diagnostics & Multimodal Camera Inspection (`analyze-image.js`).
   * `CD-CHAT-05`: Conversational Lead Qualification & Direct Calendar Booking (`leads.js`).
   * `CD-CHAT-06`: GDPR/CCPA Regulatory Cookie Consent Screen Gate (`CookieConsentBanner.jsx`).

4. **[EPIC-02: Operational Tenant Cockpit (Aicyro Pulse Dashboard)](EPIC-02_OPERATIONAL_DASHBOARD_PULSE.md)**
   * `CD-DASH-01`: Executive KPI Velocity Cockpit & Revenue Funnel (`HomeScreen.jsx`).
   * `CD-DASH-02`: Real-time Inbound Leads Triage Terminal (`TerminalScreen.jsx`).
   * `CD-DASH-03`: Field Service Dispatch Calendar & Appointment Manager (`Booking.jsx`).
   * `CD-DASH-04`: Full Conversational Transcript Explorer & Drop-off Intelligence (`Conversations.jsx`).
   * `CD-DASH-05`: AI Business Intelligence Visualizer & Sentiment Trends (`Insight.jsx`).
   * `CD-DASH-06`: Multi-Dimensional Operational Reporting & Data Export (`Report.jsx`).
   * `CD-DASH-07`: Persistent Audio Chime & Live Notifications Feed (`LiveNotifications.jsx`).
   * `CD-DASH-08`: Visitor Geolocation Cluster Map & Hardware Telemetry (`CookieDataDisplay.jsx`).

5. **[EPIC-03: Tenant Configuration, Personalization & Theming Suite](EPIC-03_TENANT_SETTINGS_AND_THEMING.md)**
   * `CD-SET-01`: Business Profile & Operating Hours Schedule (`BusinessProfile.jsx`).
   * `CD-SET-02`: Conversational AI Persona, Voice Actor & Policy Rules (`Chatbotsetting.jsx`).
   * `CD-SET-03`: Dynamic Brand Theming Engine & Live Preview (`apearance.jsx`).
   * `CD-SET-04`: Alert Thresholds, SMS & RFC 5322 Email Routing (`notification-settings.jsx`).
   * `CD-SET-05`: Account Security & Salted Scrypt Password Rotation (`PasswordChange.jsx`).

6. **[EPIC-04: Master SuperAdmin Control Plane & Zero-Trust Administration](EPIC-04_SUPERADMIN_CONTROL_PLANE.md)**
   * `CD-ADMIN-01`: Two-Tier SuperAdmin Authentication & CAPTCHA Rate Limiting (`superadminlogin.jsx`).
   * `CD-ADMIN-02`: Step-Up Authorization Engine (TOTP, PIN, Recovery Runbook) (`verify-pin.js`).
   * `CD-ADMIN-03`: Multi-Tenant Client Onboarding Wizard & 7 Industry Packs (`ClientManagement.jsx`).
   * `CD-ADMIN-04`: Platform-Wide Default Theming Controls (`SuperAdminAppearance.jsx`).
   * `CD-ADMIN-05`: Centralized Multi-Provider SMTP & OAuth Email Relays (`SuperAdminEmailProtocol.jsx`).

7. **[EPIC-05: Serverless Microservices, Zero-Trust Security & Database Protocols](EPIC-05_SERVERLESS_API_AND_SECURITY.md)**
   * `CD-API-01`: Distributed Tracing & PII-Redacting API Middleware (`withApiLogger`).
   * `CD-API-02`: Cryptographic Session Guard & CSRF Defense (`withSessionGuard`).
   * `CD-API-03`: Cold-Start Resilient Persistent Rate Limiter (`persistentRateLimiter.js`).
   * `CD-API-04`: Conversational AI & Ephemeral Voice Token Services (`chat.js`, `openai-token.js`).
   * `CD-API-05`: Lead Ingestion & Mutex Idempotency Service (`leads.js`, `idempotencyLocker.js`).
   * `CD-API-06`: RBAC System Log Querying & Telemetry Receiver (`app-query.js`, `logs.jsx`).
   * `CD-API-07`: Data Retention & Ephemeral Audio Cleanup Cron (`retention-cleanup.js`).
   * `CD-API-08`: Zero-Trust Firebase Realtime Database Security Rules (`database.rules.json`).

8. **[EPIC-06: Core Libraries, Observability & Verification Infrastructure](EPIC-06_CORE_LIBRARIES_AND_INFRASTRUCTURE.md)**
   * `CD-INFRA-01`: Enterprise Structured Logging Engine & Component Presets (`loggerPresets.js`).
   * `CD-INFRA-02`: SOC2-Style Administrative Audit Trail (`recordAuditTrail`).
   * `CD-INFRA-03`: Firebase Cloud Function Dynamic SMTP Relay (`functions/index.js`).
   * `CD-INFRA-04`: Resilient Database Execution & NoSQL Sanitization (`safeDb.js`, `sanitizer.js`).
   * `CD-INFRA-05`: Deterministic Capability & Security Acceptance Test Suites (`npm run test:...`).
