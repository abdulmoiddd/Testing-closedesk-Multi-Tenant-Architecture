# EPIC-01: Front-Desk Multimodal AI Chatbot & Universal Embed Widget

**Epic Key:** `CD-EPIC-01`  
**Module:** Front-End Client Widget, Embed Iframe, Multimodal AI Engine  
**Lead Architecture Files:**
* [`public/widget.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/public/widget.js)
* [`src/pages/embed/chatbot.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/embed/chatbot.jsx)
* [`src/Closedesk/Chatbot/AicyroChatbot.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Chatbot/AicyroChatbot.jsx)
* [`src/Closedesk/Essential/CookieConsentBanner.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Essential/CookieConsentBanner.jsx)
* [`src/lib/ruleBook.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/ruleBook.js)
* [`src/lib/visionRuleBook.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/visionRuleBook.js)

---

## Ticket Breakdown

### Ticket CD-CHAT-01: Universal Embeddable Widget SDK & Cross-Origin Host Telemetry
* **Issue Type:** Story / Core Infrastructure
* **Priority:** Highest (P0)
* **Summary:** Universal Embed SDK (`widget.js`) for embedding AI Front-Desk on third-party websites with telemetry and responsive iframe handling.
* **Component:** `Frontend / Widget SDK`
* **Description:**
  Third-party website owners (WordPress, Webflow, Shopify, custom HTML) embed CloseDesk using a single deferred `<script>` tag:
  `<script src="https://DOMAIN/widget.js" data-tenant="TENANT_ID" defer></script>`.
  The script automatically injects a transparent responsive sandboxed `<iframe>`, manages anonymous visitor UUIDs across host and iframe, tracks host pageviews, resolves IP geolocation for the radar map, and manages viewport resizing (floating pill -> expanded modal).
* **Functional Specifications:**
  1. *Host Prevention:* If current route starts with `/lg`, abort initialization immediately to avoid double loading.
  2. *Tenant Resolution:* Extracts `data-tenant` from the script tag; falls back to `window.__CLOSEDESK_TENANT_ID__` or `"default"`.
  3. *Visitor Identification:* Generates and persists a UUID `vis_{timestamp}_{random}` in `localStorage` under key `closedesk_anon_id`.
  4. *Host Visit Tracking:* Dispatches `POST /api/analytics` on initial page load with session deduplication per tab (`closedesk_visit_logged_{page}`).
  5. *IP & Geolocation Resolution:* Queries IP lookup API to obtain City, Region, Country, and Lat/Lng coordinates; persists to `tenants/{tenantId}/user_cookies/{anonId}` via `/api/cookie-consent`.
  6. *Cross-Origin Messaging (`postMessage`):* Listens for `CLOSEDESK_RESIZE` events (`shrink` to 100x100 pill vs `expand` to 420x680 desktop or 100vw/100vh mobile).
* **UI & UX Design Specifications:**
  * Iframe container: `position: fixed; bottom: 20px; right: 20px; z-index: 999999; border: none; background: transparent;`.
  * Mobile view (< 640px): On expand, transitions smoothly to `top: 0; left: 0; width: 100vw; height: 100vh; border-radius: 0;`.
  * Launcher State: Unobtrusive bottom-right floating pill with shadow `0 10px 25px rgba(0,0,0,0.2)`.
* **Acceptance Criteria:**
  * GIVEN any external website with the `<script>` tag injected, WHEN a visitor loads the page, THEN the visitor UUID is generated, page view recorded in RTDB, and the transparent widget iframe loads smoothly.
  * GIVEN the chat widget is opened, WHEN a mobile device (< 640px) is detected, THEN the iframe expands to cover the viewport cleanly without horizontal overflow.

---

### Ticket CD-CHAT-02: Glassmorphic Multimodal AI Chatbot Interface & Avatar Customizer
* **Issue Type:** Story / UI & Design
* **Priority:** High (P1)
* **Summary:** Conversational front-desk UI with customizable avatars, typewriter effect, responsive chat bubbles, and quick shortcut pills.
* **Component:** `Frontend / Chatbot`
* **Description:**
  Implements the full interactive conversational experience inside [`AicyroChatbot.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Chatbot/AicyroChatbot.jsx). Visitors can interact via text chat, voice calls, or defect photo diagnostics. The header displays dynamic tenant business profiles, live agent avatar, sound controls (mute/unmute), and mode toggles.
* **Functional Specifications:**
  1. *Avatar System:* Supports 4 standard avatars (`ai_spark`, `bot_classic`, `human_agent`, `minimal_dot`) and custom SVG uploads.
  2. *Avatar Micro-Interactions:* Hovering on avatar triggers playful speech bubbles ("Beep boop! 🤖", "Need an appointment?"); clicking plays a bounce/spin animation.
  3. *Typewriter Streaming:* `TypewriterBubble` component progressively renders tokens unless marked `instant: true`.
  4. *Quick Shortcuts:* Suggested buttons (e.g. "Emergency Leak", "Schedule Service", "Pricing Inquiry") dynamically populate beneath bot responses to accelerate lead capture.
  5. *Audio Fallback (TTS):* Integrated speech synthesis reads bot responses aloud when unmuted, utilizing AWS Polly (`/api/tts`) or standard Web Speech Synthesis API.
* **UI & UX Design Specifications:**
  * Container: Rounded 24px (`rounded-3xl`), border `border-white/15`, background `bg-gradient-to-b from-[#120b18]/95 to-[#0a0118]/95`, `backdrop-blur-2xl`.
  * Chat Bubbles:
    * Bot Bubble: Translucent dark card `bg-white/5 border border-white/10 text-white`, rounded with tail.
    * User Bubble: Primary accent background `bg-[var(--primary)] text-white font-medium`, right-aligned.
  * Header Bar: Displays brand logo, online status pulse indicator (emerald green), audio toggle, voice call launcher, and close button.
  * Input Bar: Text input with camera capture icon, microphone toggle icon, and send CTA button.
* **Acceptance Criteria:**
  * GIVEN the chatbot window is active, WHEN a user types a message or clicks a shortcut, THEN the conversation scrolls smoothly to the latest bubble and streams the response naturally.
  * GIVEN audio is enabled, WHEN the bot replies, THEN the speech is synthesized without stuttering.

---

### Ticket CD-CHAT-03: Sub-100ms WebRTC Realtime Voice Dispatch & Audio Visualizer
* **Issue Type:** Story / Realtime AI
* **Priority:** Highest (P0)
* **Summary:** Direct peer-to-peer WebRTC connection to OpenAI Realtime Gateway for bidirectional voice interactions with dynamic sound wave animation.
* **Component:** `AI / Voice Engine`
* **Description:**
  Provides full-duplex conversational voice AI directly in the visitor's browser. Rather than legacy audio recording uploads, it provisions an ephemeral WebRTC session secret via `/api/openai-token` and opens an `RTCPeerConnection` with the OpenAI Realtime gateway, streaming 24kHz audio with VAD (Voice Activity Detection).
* **Functional Specifications:**
  1. *Token Minting:* Posts to `/api/openai-token` with tenant ID to receive an ephemeral client secret; injects tenant system prompt, trade constraints, and function calling tools.
  2. *WebRTC Handshake:* Creates local audio track via `navigator.mediaDevices.getUserMedia({ audio: true })`, attaches to `RTCPeerConnection`, creates data channel `oai-events`, and performs SDP offer/answer exchange with OpenAI gateway.
  3. *VAD & Interruption:* Handles incoming `response.cancelled` events when visitor interrupts the AI speech, instantly truncating local audio buffer.
  4. *Function Calling over WebRTC Data Channel:* Listens for `response.function_call_arguments.done` (`book_appointment`, `escalate_human`, `update_lead_info`) and executes local state mutations.
  5. *Call Telemetry Sync:* On hangup, compiles call duration, audio turn count, and transcribed speech, dispatching to `POST /api/sync-voice`.
* **UI & UX Design Specifications:**
  * Active Voice Modal: Pulsing sound visualizer with real-time waveform bars animated to user microphone input.
  * Control Bar: Mute microphone button, speaker volume toggle, and red end-call button (`bg-rose-600 hover:bg-rose-500`).
  * Latency Indicator: Displays connection quality status ("Sub-100ms Ultra-Low Latency Active").
* **Acceptance Criteria:**
  * GIVEN the user clicks the Voice Call button, WHEN microphone permission is granted, THEN WebRTC connects in < 800ms and conversational audio flows bidirectionally.
  * GIVEN the AI is speaking, WHEN the user speaks over the assistant, THEN the assistant immediately halts speech (VAD interruption).

---

### Ticket CD-CHAT-04: Visual Defect Diagnostics & Multimodal Camera Inspection
* **Issue Type:** Story / Multimodal AI
* **Priority:** High (P1)
* **Summary:** In-chat webcam capture and photo upload with client-side compression and GPT-4o-mini Vision analysis for trade defect triage.
* **Component:** `AI / Vision Engine`
* **Description:**
  Allows homeowners and visitors to take live photos of trade defects (e.g. leaking pipes, frozen HVAC coils, burned circuit breakers, storm roof damage) or upload images from their gallery. Analyzed via `/api/analyze-image` and classified according to [`src/lib/visionRuleBook.js`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/lib/visionRuleBook.js).
* **Functional Specifications:**
  1. *Camera Integration:* Accesses user camera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` with live video viewfinder overlay.
  2. *Client Compression:* Compresses captured frame to 1024px JPEG at 75% quality via HTML5 Canvas before network transmission.
  3. *Storage Upload:* Stores image to Firebase Storage at `chat_images/{session}/{timestamp}.jpg`.
  4. *Vision Evaluation:* Calls `POST /api/analyze-image` with Base64 image payload. The vision model evaluates trade category, severity (Emergency, High, Routine), estimated diagnostic notes, and returns suggested shortcut actions.
  5. *Persistence:* Saves the inspection snapshot into the prospect's lead record in RTDB.
* **UI & UX Design Specifications:**
  * Viewfinder Modal: Glassmorphic viewport with crosshair guide, camera switch button (front/rear), and capture trigger button.
  * Diagnostic Result Card: In-chat inspection card showing thumbnail, severity badge (Red for Emergency, Yellow for Moderate), detected trade issue, and actionable CTA buttons (e.g. "Book Emergency Inspection").
* **Acceptance Criteria:**
  * GIVEN a visitor clicks the camera icon, WHEN they capture an image of a water leak, THEN the image is compressed, uploaded, evaluated in < 3s, and displays a categorized diagnostic triage card.

---

### Ticket CD-CHAT-05: Conversational Lead Qualification & Direct Calendar Booking
* **Issue Type:** Story / Conversion Flow
* **Priority:** Highest (P0)
* **Summary:** Guided conversational funnel collecting lead details (Name, Phone, Email, Address, Issue) and scheduling field-service appointments.
* **Component:** `Frontend / Booking Engine`
* **Description:**
  Narrows visitor intent into qualified leads. When the visitor is ready to book or an emergency is detected, the bot triggers interactive date selection (next 6 business days) and time slot grid (9:00 AM to 5:00 PM), persisting the lead to `POST /api/leads` and firing outbound email alerts.
* **Functional Specifications:**
  1. *Natural Language Extraction:* GPT-4o-mini extracts customer contact parameters (`name`, `phone`, `email`, `service_address`, `trade_problem`).
  2. *Interactive Calendar:* Dynamically calculates the next 6 business weekdays (`getNextWeekdays()`), excluding Sundays.
  3. *Time Slot Picker:* Generates 1-hour appointment dispatch windows (`09:00 AM` through `05:00 PM`).
  4. *Booking Confirmation:* Validates mandatory fields; saves appointment to RTDB `/tenants/{tenantId}/leads/{leadId}` with `booking_status: "Meeting Booked"`.
  5. *Notification Pipeline:* Enqueues email alert to `/email_alerts` for Firebase Cloud Function delivery and fires webhook to `/api/generate-email`.
* **UI & UX Design Specifications:**
  * Date Picker: Horizontal scrollable pill list of upcoming dates with selected state highlighted in `--primary`.
  * Time Slot Grid: 2-column grid of rounded time buttons with hover focus.
  * Confirmation Card: Summary card displaying checkmark icon, booked appointment time, customer details, and "Add to Calendar" link.
* **Acceptance Criteria:**
  * GIVEN a qualified conversation, WHEN a visitor selects Monday 10:00 AM and confirms, THEN the lead status updates to "Meeting Booked", an email notification is queued, and the lead appears immediately on the Tenant Leads Terminal.

---

### Ticket CD-CHAT-06: GDPR & CCPA Regulatory Cookie & Location Consent Screen Gate
* **Issue Type:** Story / Compliance
* **Priority:** High (P1)
* **Summary:** Screen-lock regulatory consent banner (`CookieConsentBanner.jsx`) enforcing user permission before tracking or audio streaming.
* **Component:** `Compliance / Privacy`
* **Description:**
  Implements a strict regulatory consent banner preventing non-consensual hardware fingerprinting, IP tracking, and voice audio streaming in compliance with GDPR, CCPA, and CPRA standards.
* **Functional Specifications:**
  1. *Policy Lockout:* Evaluates `localStorage.getItem("closedesk_cookie_consent")`. If absent, locks the widget launcher and presents consent choices.
  2. *Consent Storage:* Persists consent state (`accepted` or `declined`) and timestamp to `localStorage` and RTDB `/tenants/{tenantId}/user_cookies/{anonId}`.
  3. *Granular Policy:* If declined, voice and location tracking are disabled while text chat operates in strict anonymous mode.
* **UI & UX Design Specifications:**
  * Modal: Centered bottom banner with subtle backdrop blur overlay (`backdrop-blur-md`).
  * Actions: High-contrast "Accept & Continue" button (`bg-[var(--primary)]`) and outline "Necessary Only" button.
* **Acceptance Criteria:**
  * GIVEN a first-time visitor, WHEN landing on the site, THEN no tracking or audio permissions are invoked until explicit user consent is registered.
