# EPIC-06: Core Libraries, Observability & Verification Infrastructure

**Epic Key:** `CD-EPIC-06`  
**Module:** Shared Library Engine (`src/lib/`), Cloud Functions (`functions/`), Automated Test Suites (`scripts/`)  
**Lead Architecture Files:**
* [`src/lib/logger.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/logger.js)
* [`src/lib/loggerPresets.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/loggerPresets.js)
* [`src/lib/auditTracer.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/auditTracer.js)
* [`src/lib/alertManager.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/alertManager.js)
* [`src/lib/safeDb.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/safeDb.js)
* [`src/lib/sanitizer.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/sanitizer.js)
* [`src/lib/integrationTracer.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/integrationTracer.js)
* [`functions/index.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/functions/index.js)
* [`scripts/cd01_baseline_audit.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/scripts/cd01_baseline_audit.js)
* [`scripts/cd02_security_acceptance_suite.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/scripts/cd02_security_acceptance_suite.js)
* [`scripts/cd03_isolation_and_secrets_suite.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/scripts/cd03_isolation_and_secrets_suite.js)
* [`scripts/cd06_lead_consistency_suite.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/scripts/cd06_lead_consistency_suite.js)

---

## Ticket Breakdown

### Ticket CD-INFRA-01: Enterprise Structured Logging Engine & Component Presets
* **Issue Type:** Story / Observability
* **Priority:** Highest (P0)
* **Summary:** CloseDeskLogger engine with level filtering, correlation propagation, and domain-specific factory presets.
* **Component:** `Infrastructure / Logging`
* **Description:**
  Provides a standardized, structured JSON logging mechanism across frontend and backend tiers. Implements standard log severity thresholds (`DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`) and factory constructors tailored for individual subsystems.
* **Functional Specifications:**
  1. *Logger Presets:* Specialized factory functions:
     * `createWebsiteLogger(component)`: Frontend UI events and navigation.
     * `createApiLogger(component)`: Serverless endpoint execution.
     * `createAiLogger(component)`: OpenAI completions, tokens, and prompt traces.
     * `createVoiceLogger(component)`: WebRTC session lifecycle and audio packets.
     * `createPulseLogger(component)`: Cockpit triage and operator actions.
  2. *Standard Schema:* Each log record contains `timestamp`, `service`, `component`, `level`, `correlation_id`, `session_id`, `tenant_id`, `environment`, `context`, and optional `error`.
  3. *PII Redaction:* Automatically sanitizes sensitive keys before persisting to `/system_logs`.
* **Acceptance Criteria:**
  * GIVEN any logger instance, WHEN calling `.info()` or `.error()`, THEN a standardized JSON entry is written to console and persisted in Firebase RTDB with correlation tracking.

---

### Ticket CD-INFRA-02: SOC2-Style Administrative Audit Trail (`recordAuditTrail`)
* **Issue Type:** Story / Compliance
* **Priority:** High (P1)
* **Summary:** Tamper-evident administrative audit logger recording configuration mutations and privileged actions.
* **Component:** `Infrastructure / Audit`
* **Description:**
  Maintains an immutable record of all administrative activities (tenant creation, password changes, SMTP credential updates, lead status overrides). Satisfies SOC2 and enterprise compliance requirements.
* **Functional Specifications:**
  1. *Audit Function:* `recordAuditTrail(action, actor, target, details, tenantId)` writes directly to `/audit_trail/{auditId}` in RTDB.
  2. *Context Captured:* Records actor username, IP address, timestamp, previous value, updated value, and step-up authorization flag.
  3. *Immutability:* Database rules lock `/audit_trail` to prevent modification or deletion by non-superadmins.
* **Acceptance Criteria:**
  * GIVEN an operator updates a password or creates a tenant, WHEN executed, THEN an audit record is stored with actor identity and timestamp.

---

### Ticket CD-INFRA-03: Firebase Cloud Function SMTP Relay (`functions/index.js`)
* **Issue Type:** Story / Cloud Infrastructure
* **Priority:** Highest (P0)
* **Summary:** Firebase Cloud Function listening to `/email_alerts/{id}` and dispatching outbound emails via dynamic SMTP configurations.
* **Component:** `Cloud Functions / Email Relay`
* **Description:**
  Decouples email sending from user-facing Next.js serverless functions. A Node.js 20 Cloud Function triggers on new entries in RTDB `/email_alerts`, resolves the tenant's email configuration, initializes Nodemailer, transmits the email, and marks the job as delivered.
* **Functional Specifications:**
  1. *Trigger:* RTDB event trigger `onValueCreated('/email_alerts/{alertId}')`.
  2. *Dynamic Configuration:* Fetches SMTP/OAuth credentials from `settings/email_config` or tenant-scoped config.
  3. *HTML Email Templates:* Renders professional email templates containing customer name, phone, problem summary, appointment time, and emergency badges.
  4. *Retry & Error Handling:* If transmission fails, increments retry count; alerts `system_alerts/` if max retries exceeded.
* **Acceptance Criteria:**
  * GIVEN a new lead is captured, WHEN written to `/email_alerts`, THEN the Cloud Function sends the email in < 2s and removes the alert from the queue.

---

### Ticket CD-INFRA-04: Resilient Database Execution & NoSQL Sanitization (`safeDb.js`, `sanitizer.js`)
* **Issue Type:** Story / Data Safety
* **Priority:** High (P1)
* **Summary:** Safe database read/write wrappers with timeout fallbacks and centralized Firebase key sanitizer preventing path traversal.
* **Component:** `Infrastructure / Database Safety`
* **Description:**
  Protects the application against slow network timeouts and NoSQL path injection vulnerabilities.
* **Functional Specifications:**
  1. *Safe Database Wrappers:* `safeDbGet(ref, timeoutMs)` and `safeDbSet(ref, value, timeoutMs)` wrap Firebase operations in a timeout promise (default 5000ms), falling back gracefully without hanging serverless lambdas.
  2. *Key Sanitization:* `sanitizeFirebaseKey(key)` strips illegal Firebase characters (`.`, `$`, `#`, `[`, `]`, `/`) and path traversal sequences (`..`), preventing cross-tenant path contamination.
* **Acceptance Criteria:**
  * GIVEN a malicious tenant ID like `../../superAdmin`, WHEN processed through `sanitizeFirebaseKey`, THEN illegal characters are stripped, preventing path breakout.

---

### Ticket CD-INFRA-05: Deterministic Capability & Security Acceptance Test Suites
* **Issue Type:** Story / Quality Assurance & CI/CD
* **Priority:** Highest (P0)
* **Summary:** Deterministic automated test harnesses (`cd01_baseline_audit.js`, `cd02_security_acceptance_suite.js`, `cd03_isolation_and_secrets_suite.js`, `cd06_lead_consistency_suite.js`).
* **Component:** `QA / Test Automation`
* **Description:**
  Deterministic regression test suites executing in Node.js >= 20 to verify the entire system against CD01, CD02, CD03, and CD06 engineering specifications.
* **Functional Specifications:**
  1. *`npm run audit:cd01`:* Verifies 41 baseline source files, policy hashes, benchmark evidence, and scans for telephony claim phrasing.
  2. *`npm run test:cd02`:* Tests 8 P0 security criteria: unauthenticated access rejection, expired session invalidation, RBAC enforcement, step-up gating, scrypt password verification, cookie security flags, persistent rate limiting, and RFC 6238 TOTP verification.
  3. *`npm run test:cd03`:* Validates tenant isolation, fake tenant 404 rejection, secret protection, and cross-tenant data leakage prevention.
  4. *`npm run test:cd06`:* Validates lead consistency, deduplication, and appointment booking transitions.
* **Acceptance Criteria:**
  * GIVEN code changes in the repository, WHEN running the test suites, THEN all verification checks pass with zero failures.
