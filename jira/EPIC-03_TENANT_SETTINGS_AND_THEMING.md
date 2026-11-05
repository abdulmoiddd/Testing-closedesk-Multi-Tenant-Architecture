# EPIC-03: Tenant Configuration, Personalization & Theming Suite

**Epic Key:** `CD-EPIC-03`  
**Module:** Tenant Settings Subsystem (`/lg` Settings Submenu)  
**Lead Architecture Files:**
* [`src/Closedesk/Dashboard/Settings/BusinessProfile.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Settings/BusinessProfile.jsx)
* [`src/Closedesk/Dashboard/Settings/Chatbotsetting.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Settings/Chatbotsetting.jsx)
* [`src/Closedesk/Dashboard/Settings/apearance.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Settings/apearance.jsx)
* [`src/Closedesk/Dashboard/Settings/notification-settings.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Settings/notification-settings.jsx)
* [`src/Closedesk/Dashboard/Settings/PasswordChange.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Settings/PasswordChange.jsx)
* [`src/Closedesk/ThemeProvider.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/ThemeProvider.jsx)

---

## Ticket Breakdown

### Ticket CD-SET-01: Business Profile & Operating Hours Dispatch Calendar (`BusinessProfile.jsx`)
* **Issue Type:** Story / Configuration
* **Priority:** High (P1)
* **Summary:** Tenant business profile configuration, 7-day operating schedule, GMT timezone offsets, and brand logo uploader.
* **Component:** `Settings / BusinessProfile`
* **Description:**
  Configures critical business parameters that govern AI bot behavior and booking eligibility. Manages business name, primary trade industry, contact phone/email, physical service address, average job value, 7-day operating hours, and localized timezone.
* **Functional Specifications:**
  1. *Basic Metadata:* Stores Business Name, Industry, Website, Phone, Email, Address, Average Job Value in `tenants/{tenantId}/business_profile/basic_info`.
  2. *7-Day Schedule Matrix:* Toggle active/inactive per day (Monday-Sunday) and configure custom Open and Close times (`09:00` - `17:00`). Out-of-hours messages trigger automatically during closed windows.
  3. *Calculated GMT Timezone Selector:* Generates timezone options dynamically with formatted GMT offsets (e.g., `(GMT-5) America/New York`, `(GMT+0) Europe/London`) using `Intl.DateTimeFormat`.
  4. *Brand Logo Management:* Supports image file upload to Firebase Storage with instant Base64 preview; synchronizes across dashboard header and widget launcher.
* **UI & UX Design Specifications:**
  * Schedule Grid: Card layout with row per weekday, toggle switches (`bg-emerald-500` active state), and synchronized time pickers.
  * Form Fields: Floating label inputs with outline focus ring in `--primary`.
* **Acceptance Criteria:**
  * GIVEN business operating hours are configured to close at 5:00 PM, WHEN a visitor chats at 7:00 PM, THEN the AI bot acknowledges after-hours status and routes the inquiry to emergency triage.

---

### Ticket CD-SET-02: Conversational AI Persona, Voice Actor & Policy Rules (`Chatbotsetting.jsx`)
* **Issue Type:** Story / AI Policy
* **Priority:** Highest (P0)
* **Summary:** Front-desk AI personality configuration, OpenAI voice actor selection (`ash`, `alloy`, `echo`, `shimmer`, `coral`), lead capture field customizer, and direct booking rules.
* **Component:** `Settings / Chatbotsetting`
* **Description:**
  A comprehensive control panel customizing how the AI bot interacts with customers. Features voice preview playback, persona tone selection, direct booking killswitches, FAQ builders, and trade qualification questions.
* **Functional Specifications:**
  1. *Avatar Selection:* Choose from 4 built-in SVG avatars (`ai_spark`, `bot_classic`, `human_agent`, `minimal_dot`) or upload a custom SVG.
  2. *Voice Actor Engine:* Select from 5 OpenAI Realtime voices (`ash`, `alloy`, `echo`, `shimmer`, `coral`) with instant in-browser audio preview.
  3. *Voice Killswitch:* Master toggle enabling/disabling browser WebRTC voice calls on demand.
  4. *Personality & Tone:* Presets for "Warm, Conversational & Human-like", "Professional & Direct", "Empathetic & Reassuring", etc., injecting constraints into [`src/lib/ruleBook.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/ruleBook.js).
  5. *Lead Capture Field Builder:* Select which customer fields are mandatory (Name, Email, Phone, Address, Urgency).
  6. *Dynamic FAQ Editor:* Add/edit/remove Question & Answer pairs referenced by the bot during conversations.
  7. *Qualification Questions:* Dynamic list of trade questions (e.g. "Do you smell gas?", "Is water leaking through the ceiling?") asked before booking.
  8. *Booking Rules & Calendar Sync:* Toggle `enableDirectBooking` and `calendarActive`.
  9. *Audit Logging:* Records all parameter changes using `recordAuditTrail` and `pulseLogger`.
* **UI & UX Design Specifications:**
  * Voice Selection Card: Interactive tiles for each voice actor with speaker icon playing sample greeting clip.
  * Multi-Section Layout: Accordion/card sections with clear visual separators and informative tooltips (`InfoTooltip`).
* **Acceptance Criteria:**
  * GIVEN the operator changes the voice from "alloy" to "ash", WHEN saved, THEN subsequent WebRTC voice calls mint session tokens using the new voice persona.

---

### Ticket CD-SET-03: Dynamic Brand Theming Engine & Live Preview (`apearance.jsx`)
* **Issue Type:** Story / Design System
* **Priority:** High (P1)
* **Summary:** Multi-palette theme visualizer supporting 8 color hues, light/dark/system mode, shade slider (100-900), and live dashboard screen preview.
* **Component:** `Settings / Appearance`
* **Description:**
  Allows tenants to customize their dashboard visual theme to match their brand identity. Features dynamic color mixing (`color-mix`), immediate DOM CSS variable injection, and a split-screen live preview showing how Home, Terminal, or Booking screens look in the chosen theme.
* **Functional Specifications:**
  1. *Theme Modes:* `system` (matches OS preference), `light`, and `dark`.
  2. *8 Color Hues:* Default (Violet), Red, Orange, Yellow, Green, Blue, Indigo, Violet.
  3. *Accent Shade Slider:* Precision slider from 100 to 900 adjusting primary and secondary color saturation.
  4. *Live Screen Preview:* Embedded interactive container rendering either `HomeScreen`, `TerminalScreen`, or `Booking` in real time as the operator tweaks theme settings.
  5. *Persistence:* Saves to `users/{username}/appearance` in RTDB and mirrors to `localStorage`.
* **UI & UX Design Specifications:**
  * Color Swatches: Circular palette buttons with active ring highlight (`ring-2 ring-offset-2`).
  * Smooth DOM Transition: Body element transition `transition: background-color 0.3s ease, color 0.3s ease`.
* **Acceptance Criteria:**
  * GIVEN the user selects Emerald Green and Dark mode, WHEN clicking "Save Preferences", THEN the entire dashboard and preview reflect the new green dark theme instantly.

---

### Ticket CD-SET-04: Alert Thresholds, SMS & RFC 5322 Email Routing (`notification-settings.jsx`)
* **Issue Type:** Story / Notifications
* **Priority:** High (P1)
* **Summary:** Outbound lead notification settings with strict RFC 5322 regex validation, backup email recipients, and urgent-only alerts.
* **Component:** `Settings / NotificationSettings`
* **Description:**
  Controls how dispatched leads reach contractors in the field. Validates recipient email addresses strictly against RFC 5322 specifications, configures backup emergency addresses, and provides a test alert trigger.
* **Functional Specifications:**
  1. *Email Validation:* Uses strict RFC 5322 compliant regex:  
     `/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/`.
  2. *Notification Channels:* Toggle Email Alerts, SMS Alerts, and Urgent-Only filtering.
  3. *Recipient Management:* Configures Primary Recipient (`adminEmail`) and Backup Recipient (`backupEmail`).
  4. *Send Test Notification:* Action button posts to `/api/notifications/settings` to enqueue a sample notification verifying end-to-end delivery.
* **UI & UX Design Specifications:**
  * Clean form cards with toggle switches and informative helper badges.
  * Validation Toast: Displays clear error toast when invalid email syntax is submitted.
* **Acceptance Criteria:**
  * GIVEN an operator enters `user@domain`, WHEN saving, THEN the system rejects the input with an RFC 5322 error toast until a valid TLD is provided (`user@domain.com`).

---

### Ticket CD-SET-05: Account Security & Salted Scrypt Password Rotation (`PasswordChange.jsx`)
* **Issue Type:** Story / Security
* **Priority:** High (P1)
* **Summary:** Operator credential rotation verifying current password against salted scrypt hash with session rotation.
* **Component:** `Settings / PasswordChange`
* **Description:**
  Implements secure credential updating for tenant operators in accordance with CD02 security standards. Validates current password via server-side `/api/user/password`, generates a new salted scrypt hash, invalidates old sessions, and rotates bearer tokens.
* **Functional Specifications:**
  1. *Client Validation:* Checks all fields are filled, new password equals confirm password, and length is at least 4 characters.
  2. *Server-Side Scrypt Verification:* Invokes `POST /api/user/password` with session header. Verifies current password against stored hash using `timingSafeStringEqual`.
  3. *Scrypt Key Derivation:* Hashes new password with parameters `N=16384, r=8, p=1`, saving format `scrypt:<salt>:<hash>`.
  4. *Session Rotation:* Updates `cd_session_token` in `localStorage` and resets form.
* **UI & UX Design Specifications:**
  * Password Input with eye icon toggle (Show/Hide password).
  * Strength indicator and success toast redirecting back to Business Profile after 1.5 seconds.
* **Acceptance Criteria:**
  * GIVEN an operator provides an incorrect current password, WHEN submitting, THEN the server rejects with 401 Unauthorized and records a security audit log.
