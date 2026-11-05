# EPIC-04: Master SuperAdmin Control Plane & Zero-Trust Administration

**Epic Key:** `CD-EPIC-04`  
**Module:** Master SuperAdmin Subsystem (`/lg` SuperAdmin Mode)  
**Lead Architecture Files:**
* [`src/Closedesk/Dashboard/superadmin/superadminlogin.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/superadmin/superadminlogin.jsx)
* [`src/Closedesk/Dashboard/superadmin/SuperAdminDashboard.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/superadmin/SuperAdminDashboard.jsx)
* [`src/Closedesk/Dashboard/superadmin/ClientManagement.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/superadmin/ClientManagement.jsx)
* [`src/Closedesk/Dashboard/superadmin/Settings/SuperAdminAppearance.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/superadmin/Settings/SuperAdminAppearance.jsx)
* [`src/Closedesk/Dashboard/superadmin/Settings/SuperAdminEmailProtocol.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/superadmin/Settings/SuperAdminEmailProtocol.jsx)
* [`src/pages/api/superadmin/login.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/api/superadmin/login.js)
* [`src/pages/api/superadmin/verify-pin.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/api/superadmin/verify-pin.js)
* [`src/pages/api/superadmin/tenants.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/api/superadmin/tenants.js)
* [`src/pages/api/superadmin/settings.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/api/superadmin/settings.js)
* [`src/lib/totp.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/totp.js)
* [`docs/SUPERADMIN_RECOVERY_RUNBOOK.md`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/docs/SUPERADMIN_RECOVERY_RUNBOOK.md)

---

## Ticket Breakdown

### Ticket CD-ADMIN-01: Two-Tier SuperAdmin Authentication & CAPTCHA Rate Limiting
* **Issue Type:** Story / Security & Auth
* **Priority:** Highest (P0)
* **Summary:** SuperAdmin authentication interface (`superadminlogin.jsx`) with salted scrypt validation, CAPTCHA defense, and persistent rate limiting.
* **Component:** `SuperAdmin / Auth`
* **Description:**
  Provides the primary authentication gateway for platform superadministrators. Implements zero-trust isolation separating standard tenant users from superadministrators. Defends against brute-force attacks via sliding-window rate limiting (5 attempts per 15 minutes) and a randomized 6-character CAPTCHA triggered after 3 consecutive failures.
* **Functional Specifications:**
  1. *Primary Factor Login:* Posts credentials to `/api/superadmin/login`. Validates salted scrypt hash.
  2. *Initial Session Issuance:* On success, mints an HMAC-SHA256 signed cookie with `role: "superadmin"`, but `stepUpVerified: false`.
  3. *CAPTCHA Engine:* Generates random 6-character uppercase alphanumeric CAPTCHA challenge after 3 failed attempts, requiring correct entry to re-enable submission.
  4. *Persistent Rate Limiting:* Enforces 429 backoff stored in RTDB `/rate_limits/` resistant to serverless container restarts.
  5. *Mode Navigation:* Clean toggle back to Standard User Login view.
* **UI & UX Design Specifications:**
  * Container: Centered glassmorphic card with violet glow border and shield icon.
  * CAPTCHA Display: Stylized high-contrast challenge box with refresh button.
* **Acceptance Criteria:**
  * GIVEN 5 incorrect password attempts from an IP, WHEN a 6th attempt is made, THEN the server responds with 429 Too Many Requests and locks out further attempts for 15 minutes.

---

### Ticket CD-ADMIN-02: Step-Up Authorization Engine (RFC 6238 TOTP, PIN, Recovery Runbook)
* **Issue Type:** Story / Security & Privilege
* **Priority:** Highest (P0)
* **Summary:** Secondary step-up verification modal invoking `/api/superadmin/verify-pin` to unlock destructive tenant operations.
* **Component:** `SuperAdmin / Step-Up Auth`
* **Description:**
  In compliance with CD02 privileged access standards, destructive operations (creating tenants, deleting tenants, modifying global SMTP relays) are strictly blocked until the superadmin passes a secondary verification factor.
* **Functional Specifications:**
  1. *Step-Up Triggers:* Any attempt to invoke `/api/superadmin/tenants` or `/api/superadmin/settings` without step-up verification is rejected with 403 Forbidden.
  2. *Verification Factor 1 (RFC 6238 TOTP):* Validates 6-digit authenticator codes with ±1 timestep (30-second) drift allowance using `src/lib/totp.js`.
  3. *Verification Factor 2 (Secondary PIN):* Fallback verification using salted scrypt hashed admin PIN.
  4. *Verification Factor 3 (Emergency Recovery Code):* Emergency single-use recovery code support documented in `docs/SUPERADMIN_RECOVERY_RUNBOOK.md`.
  5. *Session Elevation:* On verification, updates RTDB `/sessions/{sessionId}` to `{ stepUpVerified: true }`, enabling privileged API execution.
* **UI & UX Design Specifications:**
  * Modal: Glassmorphic center modal with 6-digit segmented input boxes, auto-focus, and keypad support.
  * Visual Indicator: Lock icon changes to unlocked emerald shield upon elevation.
* **Acceptance Criteria:**
  * GIVEN an authenticated superadmin whose `stepUpVerified` is false, WHEN calling `/api/superadmin/tenants`, THEN the server returns 403 Forbidden until `/api/superadmin/verify-pin` succeeds.

---

### Ticket CD-ADMIN-03: Multi-Tenant Client Onboarding Wizard & Industry Packs (`ClientManagement.jsx`)
* **Issue Type:** Story / Multi-Tenancy
* **Priority:** Highest (P0)
* **Summary:** Multi-tenant provisioning suite with slug sanitization, 7 trade industry packs, dynamic embed snippet generator, and operator management.
* **Component:** `SuperAdmin / ClientManagement`
* **Description:**
  Empowers platform owners to provision new contractor tenants in under 30 seconds. Automatically seeds industry-specific bot configurations, validates tenant ID slugs, creates admin credentials, provisions embed snippets, and manages operator user lists.
* **Functional Specifications:**
  1. *Tenant Provisioning Form:* Collects Business Name, Tenant ID (slug sanitized: lowercase alphanumeric, hyphens, underscores), Industry, Email, Phone, Website, Admin Username, Admin Password, and Allowed Origins (CORS).
  2. *7 Pre-Configured Industry Packs:*
     * `hvac_v2` (Heating & Air Conditioning)
     * `plumbing_v2` (Plumbing Services)
     * `restoration_v2` (Water & Fire Damage)
     * `roofing_v2` (Roofing & Storm Repair)
     * `electrical_v2` (Electrical Contracting)
     * `pest_v2` (Pest Control)
     * `general_v2` (General Home Services)
  3. *Embed Code Snippet Generation:* Generates one-click copyable `<script>` tag customized with the new tenant's ID.
  4. *Tenant Operator Accounts:* Add, edit password, or remove operator accounts under each tenant.
  5. *Tenant Deletion Protection:* Destructive deletion requires step-up verification and typing tenant confirmation slug.
* **UI & UX Design Specifications:**
  * Client Table: Card list of active tenants with brand logo, industry badge, active user count, and quick-action menu (Edit Profile, Manage Users, View Embed Snippet, Delete).
  * Creation Modal: Stepped form with field validations and instant copy snippet modal upon completion.
* **Acceptance Criteria:**
  * GIVEN a superadmin provisions a new tenant "Austin Roofing" with industry "Roofing", WHEN saved, THEN `tenants/austin_roofing` is created in RTDB seeded with `roofing_v2` conversation rules, and the admin user can immediately log in at `/lg`.

---

### Ticket CD-ADMIN-04: Platform-Wide Default Theming Controls (`SuperAdminAppearance.jsx`)
* **Issue Type:** Story / Appearance
* **Priority:** Medium (P2)
* **Summary:** Platform-wide global theme and appearance customizer setting baseline branding for uncustomized tenants.
* **Component:** `SuperAdmin / Appearance`
* **Description:**
  Allows superadministrators to define system-wide fallback theme modes, default hues, and primary accent colors applied to public pages, login screens, and newly created tenants.
* **Functional Specifications:**
  1. *Default Palette Customizer:* Sets default platform hue from the 8 theme hues.
  2. *Global Mode:* Defines default mode (System, Light, Dark) for unauthenticated visitors.
  3. *Database Sync:* Writes to `settings/appearance` in Firebase RTDB.
* **Acceptance Criteria:**
  * GIVEN the superadmin changes the global default hue to Blue, WHEN a new tenant is created without custom appearance, THEN it inherits the blue theme by default.

---

### Ticket CD-ADMIN-05: Centralized Multi-Provider SMTP & OAuth Email Relays (`SuperAdminEmailProtocol.jsx`)
* **Issue Type:** Story / Infrastructure & Integrations
* **Priority:** High (P1)
* **Summary:** Centralized email relay configuration supporting Google OAuth2, Microsoft 365, Hostinger, Namecheap, Titan, cPanel, and Custom SMTP.
* **Component:** `SuperAdmin / EmailProtocols`
* **Description:**
  Configures the platform's global outbound email pipeline used by Firebase Cloud Functions to dispatch lead notifications, customer booking receipts, and critical incident alerts.
* **Functional Specifications:**
  1. *OAuth Providers:* Integrates Google Workspace and Microsoft 365 OAuth2 flows, storing encrypted refresh tokens for automated relay.
  2. *Pre-Configured SMTP Providers:* Built-in host/port presets for:
     * Hostinger (`smtp.hostinger.com:465`)
     * Namecheap PrivateEmail (`mail.privateemail.com:465`)
     * Titan Email (`smtp.titan.email:465`)
     * DreamHost (`smtp.dreamhost.com:465`)
     * Rackspace (`secure.emailsrvr.com:465`)
     * Yandex (`smtp.yandex.com:465`)
     * Custom SMTP (custom host, port, TLS/SSL toggle)
  3. *Step-Up Authorization:* Configuration updates require step-up verification before posting to `/api/superadmin/settings`.
  4. *Disconnect Confirmation:* Safety modal preventing accidental disconnection of the active email relay.
* **UI & UX Design Specifications:**
  * Provider Dropdown: Dropdown with brand icons and host indicator badges.
  * Secure Password Field: Password input masked by default with reveal toggle.
* **Acceptance Criteria:**
  * GIVEN a superadmin connects Google OAuth, WHEN an email alert is triggered in RTDB, THEN the Cloud Function relays the email through the authorized Google account without credential leakage.
