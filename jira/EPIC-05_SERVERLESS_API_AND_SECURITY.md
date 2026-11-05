# EPIC-05: Serverless Microservices, Zero-Trust Security & Database Protocols

**Epic Key:** `CD-EPIC-05`  
**Module:** Serverless API Layer (`src/pages/api/`) & Security Primitives (`src/lib/`)  
**Lead Architecture Files:**
* [`src/lib/apiMiddleware.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/apiMiddleware.js)
* [`src/lib/authSession.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/authSession.js)
* [`src/lib/authCrypto.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/authCrypto.js)
* [`src/lib/persistentRateLimiter.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/persistentRateLimiter.js)
* [`src/lib/idempotencyLocker.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/idempotencyLocker.js)
* [`src/lib/sanitizer.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/sanitizer.js)
* [`database.rules.json`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/database.rules.json)
* 25 Serverless API Endpoints in [`src/pages/api/`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/api)

---

## Ticket Breakdown

### Ticket CD-API-01: Distributed Tracing & PII-Redacting API Middleware (`withApiLogger`)
* **Issue Type:** Story / Core Architecture
* **Priority:** Highest (P0)
* **Summary:** Higher-order API wrapper (`withApiLogger`) enforcing end-to-end distributed correlation IDs, response duration profiling, error boundaries, and PII masking.
* **Component:** `Backend / Middleware`
* **Description:**
  Wraps every Next.js API route in [`src/pages/api/`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/api). Standardizes request processing, generates or passes through `x-correlation-id`, `x-session-id`, and `x-tenant-id`, records transaction metrics in `system_logs`, and masks sensitive parameters (passwords, credit cards, SSNs).
* **Functional Specifications:**
  1. *Correlation Propagation:* Reads `x-correlation-id` header or generates a cryptographically random UUID v4 trace ID; mirrors in response headers.
  2. *Tenant Header Normalization:* Resolves tenant ID from `x-tenant-id`, query parameter `tenant`, or subdomains using `tenantResolver.js`.
  3. *PII Scrubbing:* Sanitizes request body and query logs, redacting keys containing `password`, `pin`, `secret`, `token`, `authorization`.
  4. *Execution Profiling:* Measures wall-clock execution time (`duration_ms`) and logs status codes (`200`, `400`, `401`, `403`, `429`, `500`).
  5. *Error Boundary:* Catches unhandled exceptions, returning structured error JSON without leaking internal stack traces.
* **Acceptance Criteria:**
  * GIVEN any incoming API request, WHEN inspected, THEN response headers include `x-correlation-id` and execution logs are persisted to RTDB with masked sensitive keys.

---

### Ticket CD-API-02: Cryptographic Session Guard & CSRF Defense (`withSessionGuard`)
* **Issue Type:** Story / Security
* **Priority:** Highest (P0)
* **Summary:** Role-based session authorization guard with HMAC-SHA256 signed cookies, CSRF protection, and server-side revocation.
* **Component:** `Backend / Security`
* **Description:**
  Protects all non-public administrative routes. Verifies cryptographically signed cookies (`cd_session`), enforces CSRF defense via custom header validation (`x-requested-with: XMLHttpRequest`), checks expiration against RTDB `/sessions/{sessionId}`, and enforces role boundaries (`superadmin` vs `tenant_operator`).
* **Functional Specifications:**
  1. *Cookie Signature Verification:* Verifies session cookie payload using HMAC-SHA256 secret (`SESSION_SECRET`).
  2. *CSRF Verification:* Rejects state-mutating requests (`POST`, `PATCH`, `DELETE`) lacking `x-requested-with: XMLHttpRequest`.
  3. *Database Revocation Check:* Queries RTDB `/sessions/{sessionId}` to verify session has not been revoked or expired.
  4. *Role Hierarchy:* Rejects requests if `requiredRole` does not match the active session role.
  5. *Step-Up Flag Enforcement:* Rejects calls to sensitive routes if `requireStepUp: true` and `session.stepUpVerified !== true`.
* **Acceptance Criteria:**
  * GIVEN an expired or revoked session token, WHEN calling an authenticated endpoint, THEN the request is rejected with 401 Unauthorized and the browser cookie is cleared.

---

### Ticket CD-API-03: Cold-Start Resilient Persistent Rate Limiter (`persistentRateLimiter.js`)
* **Issue Type:** Story / Security
* **Priority:** Highest (P0)
* **Summary:** Sliding-window rate limiter persisting attempt counts in Firebase RTDB `/rate_limits/` to survive serverless restarts.
* **Component:** `Backend / Rate Limiting`
* **Description:**
  Guards sensitive authentication endpoints (`/api/login`, `/api/superadmin/login`, `/api/superadmin/verify-pin`, `/api/user/password`) against brute force and credential stuffing. In-memory counters reset on serverless function recycling; this module persists attempt windows in RTDB.
* **Functional Specifications:**
  1. *Sliding Window:* Configurable time window (default 15 minutes) and max attempts (default 5).
  2. *Atomic Increment:* Records attempt timestamp under sanitized IP key in `/rate_limits/{sanitizedIp}`.
  3. *Lockout Response:* If threshold exceeded, returns HTTP 429 Too Many Requests with `Retry-After` header indicating remaining lockout seconds.
* **Acceptance Criteria:**
  * GIVEN an attacker attempts multiple rapid logins, WHEN serverless containers cycle, THEN the rate limiter continues enforcing the 429 lockout based on persisted RTDB state.

---

### Ticket CD-API-04: Conversational AI & Ephemeral Voice Token Services
* **Issue Type:** Story / AI Microservices
* **Priority:** Highest (P0)
* **Summary:** High-performance conversational completions (`/api/chat`), ephemeral WebRTC token minting (`/api/openai-token`), and telemetry sync (`/api/sync-voice`).
* **Component:** `Backend / AI Services`
* **Description:**
  Core AI backend driving text and voice dispatching. Features GPT-4o-mini structured JSON dialog completions, OpenAI Realtime ephemeral WebRTC token generation, and audio performance synchronization.
* **Functional Specifications:**
  1. *POST `/api/chat`:* Executes GPT-4o-mini chat completion; injects tenant system prompt from `ruleBook.js`, business profile hours, and JSON tool calling schemas (`log_lead`, `schedule_appointment`).
  2. *POST `/api/openai-token`:* Mints an ephemeral client session secret from OpenAI Realtime API (`gpt-4o-realtime-preview`); injects tenant voice actor, temperature, and trade prompt.
  3. *POST `/api/sync-voice`:* Ingests call duration, user speech transcript, assistant speech transcript, and audio metrics; records to prospect record in RTDB.
* **Acceptance Criteria:**
  * GIVEN a voice call request from the widget, WHEN calling `/api/openai-token`, THEN a valid ephemeral client secret is returned in < 400ms without exposing master OpenAI API keys to the browser.

---

### Ticket CD-API-05: Lead Ingestion & Mutex Idempotency Service (`/api/leads`)
* **Issue Type:** Story / Data Integrity
* **Priority:** Highest (P0)
* **Summary:** Lead validation, sanitization, and deduplication engine using Realtime Database mutex locks to prevent duplicate entries.
* **Component:** `Backend / Leads`
* **Description:**
  Processes customer lead submissions from text chat, voice calls, and manual entry. Validates fields against [`leadContract.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/leadContract.js), deduplicates incoming leads, and uses [`idempotencyLocker.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/idempotencyLocker.js) to prevent race condition duplicates.
* **Functional Specifications:**
  1. *Schema Validation:* Validates mandatory parameters (Name, Phone or Email, Trade Issue, Timestamp).
  2. *Idempotency Mutex Lock:* Acquires a temporary lock key in `/tenants/{tenantId}/idempotency_locks/{hash}`; releases lock on completion.
  3. *Deduplication:* If a lead with identical phone or email was captured in the last 15 minutes, merges interaction notes instead of creating a duplicate lead.
  4. *Persistence:* Stores validated lead to `/tenants/{tenantId}/leads/{leadId}`.
* **Acceptance Criteria:**
  * GIVEN two simultaneous network requests for the same lead submission, WHEN processed by `/api/leads`, THEN only one unique lead record is created in Firebase RTDB.

---

### Ticket CD-API-06: RBAC System Log Querying & Telemetry Receiver (`/api/app-query`, `/api/app-state`)
* **Issue Type:** Story / Observability
* **Priority:** High (P1)
* **Summary:** Secure log query microservice enforcing RBAC segregation over `system_logs/` and client error receiver.
* **Component:** `Backend / Observability`
* **Description:**
  Powers the System Logs inspection console (`/logs`). Gated by role permissions: SuperAdmins can query across all tenants; Tenant Clients can strictly query logs where `tenant_id` matches their own identity.
* **Functional Specifications:**
  1. *POST `/api/app-query`:* Validates user role. Executes filtered range queries across `system_logs` (Service, Component, Log Level, Date Range, Correlation ID, Session ID).
  2. *Tenant Segregation:* Automatically enforces tenant filtering for non-superadmin callers; attempts to query other tenant logs return empty or 403.
  3. *POST `/api/app-state`:* Ingests unhandled frontend JavaScript errors and telemetry traces from `GlobalActivityTracker.jsx`.
* **Acceptance Criteria:**
  * GIVEN a standard tenant operator queries `/api/app-query`, WHEN requesting logs, THEN only logs tagged with their tenant ID are returned.

---

### Ticket CD-API-07: Data Retention & Ephemeral Audio Cleanup Cron (`/api/cron/retention-cleanup`)
* **Issue Type:** Story / Compliance
* **Priority:** High (P1)
* **Summary:** Automated maintenance cron pruning ephemeral voice memory, archiving old cookies, and cleaning expired telemetry.
* **Component:** `Backend / Cron Maintenance`
* **Description:**
  Enforces privacy compliance as specified in [`docs/VOICE_PRIVACY_POLICY.md`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/docs/VOICE_PRIVACY_POLICY.md). Can be triggered via external cron job (Vercel Cron, Netlify Scheduled Functions, Cloud Scheduler) with bearer secret.
* **Functional Specifications:**
  1. *Secret Authentication:* Requires `Authorization: Bearer CRON_SECRET` to execute.
  2. *Voice Audio Memory Destruction:* Verifies no raw audio buffers persist in storage; prunes temporary voice nonces.
  3. *Visitor Cookie Retention:* Deletes archived visitor cookies exceeding 30 days (`THIRTY_DAYS_MS`).
  4. *Log Retention Pruning:* Prunes debug and info logs exceeding the configured retention threshold (default 14 days).
* **Acceptance Criteria:**
  * GIVEN the cleanup cron runs, WHEN executed, THEN all archived cookies older than 30 days are permanently purged from Firebase RTDB.

---

### Ticket CD-API-08: Zero-Trust Firebase Realtime Database Security Rules (`database.rules.json`)
* **Issue Type:** Story / Security & Infrastructure
* **Priority:** Highest (P0)
* **Summary:** Granular Firebase Realtime Database security rules enforcing default read/write lockouts and tenant boundary isolation.
* **Component:** `Database / Security Rules`
* **Description:**
  Enforces zero-trust data protection at the database engine level. Root `.read` and `.write` are set to `false`. Access to tenant paths requires authenticated tokens with matching tenant IDs or superadmin privileges.
* **Functional Specifications:**
  1. *Default Deny:* Root `.read: false` and `.write: false`.
  2. *Tenant Boundary:* `tenants/$tenant_id` paths are accessible only if `auth.token.role === 'superadmin'` or `auth.token.tenant_id === $tenant_id`.
  3. *Superadmin Exclusivity:* `/superAdmin`, `/login`, `/settings/email_config` are locked strictly to `auth.token.role === 'superadmin'`.
  4. *Indexed Fields:* Optimizes queries with `.indexOn` for timestamps, booking statuses, urgency levels, and usernames.
* **Acceptance Criteria:**
  * GIVEN a client token for `tenant_a`, WHEN attempting to read `/tenants/tenant_b/leads`, THEN Firebase rejects the query with Permission Denied.
