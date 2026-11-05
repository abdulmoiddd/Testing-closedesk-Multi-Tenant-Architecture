# EPIC-02: Operational Tenant Cockpit (Aicyro Pulse Dashboard)

**Epic Key:** `CD-EPIC-02`  
**Module:** Tenant Operations Portal (`/lg`)  
**Lead Architecture Files:**
* [`src/pages/lg.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/pages/lg.jsx)
* [`src/Closedesk/Dashboard/HomeScreen.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/HomeScreen.jsx)
* [`src/Closedesk/Dashboard/TerminalScreen.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/TerminalScreen.jsx)
* [`src/Closedesk/Dashboard/Booking.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Booking.jsx)
* [`src/Closedesk/Dashboard/Conversations.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Conversations.jsx)
* [`src/Closedesk/Dashboard/Insight.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Insight.jsx)
* [`src/Closedesk/Dashboard/Report.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/Report.jsx)
* [`src/Closedesk/Dashboard/LiveNotifications.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/LiveNotifications.jsx)
* [`src/Closedesk/Dashboard/CookieDataDisplay.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/CookieDataDisplay.jsx)
* [`src/Closedesk/Dashboard/cookie/CookieMap.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/cookie/CookieMap.jsx)
* [`src/Closedesk/Dashboard/cookie/CookieGrid.jsx`](file:///d:/Software%20House%2001/Closedesk-ready%20to%20deploy/src/Closedesk/Dashboard/cookie/CookieGrid.jsx)

---

## Ticket Breakdown

### Ticket CD-DASH-01: Executive KPI Velocity Cockpit & Revenue Funnel (`HomeScreen.jsx`)
* **Issue Type:** Story / Analytics & UI
* **Priority:** Highest (P0)
* **Summary:** Real-time top-of-funnel velocity dashboard displaying visitor conversions, appointment booking rates, and projected pipeline revenue.
* **Component:** `Dashboard / HomeScreen`
* **Description:**
  Provides the primary executive overview when tenant operators log into `/lg`. Subscribes via Firebase Realtime Database to `/tenants/{tenantId}/analytics` and `/leads`, continuously calculating top-of-funnel conversion rates and estimated closed revenue using the configurable average job value slider.
* **Functional Specifications:**
  1. *Realtime Data Binding:* Listens to `tenants/{tenantId}/leads` with automatic fallback to authenticated `/api/leads`.
  2. *Velocity KPIs:* Calculates:
     * Total Website Visitors (`totalWebsiteVisitors`)
     * Total Chatbot Opens (`totalChatbotOpens`)
     * Conversations Started (`totalConversationsStarted`)
     * Qualified Leads Captured & Conversion % (`capturedLeads / totalConversationsStarted`)
     * Booked Appointments & Booking % (`bookedAppointments / capturedLeads`)
  3. *Revenue Estimator:* Multiplies `bookedAppointments * avgJobValue` (default $1,200, adjustable via interactive slider) to project pipeline value.
  4. *Timeframe Filtering:* Toggles calculations dynamically across "All Time", "Today", "Last 7 Days", and "Last 30 Days".
  5. *Recent Triage Stream:* Displays a live feed of the 5 most recent customer interactions.
* **UI & UX Design Specifications:**
  * Top Metric Grid: 4-column responsive grid of glassmorphic KPI cards with subtle radial spotlight gradients (`bg-card-gradient`).
  * Funnel Visualization: Horizontal stepped funnel diagram showing drop-off percentages between visitor acquisition and appointment booking.
  * Operational Status Pill: Live indicator badge showing bot readiness and system latency.
* **Acceptance Criteria:**
  * GIVEN new leads arrive in RTDB, WHEN viewing HomeScreen, THEN the counters and pipeline estimation update instantly without page reload.

---

### Ticket CD-DASH-02: Real-time Inbound Leads Triage Terminal (`TerminalScreen.jsx`)
* **Issue Type:** Story / Dispatch Operations
* **Priority:** Highest (P0)
* **Summary:** High-density live triage terminal for inbound customer leads with emergency chimes, multi-filtering, search, and slide-over dispatch drawer.
* **Component:** `Dashboard / TerminalScreen`
* **Description:**
  The command center for contractor dispatchers. Renders incoming leads in real time, prioritizes urgent issues (gas leaks, flooding, furnace breakdown in winter) with pulsing badges and audible alerts, and allows one-click calling/emailing from a slide-over detail drawer.
* **Functional Specifications:**
  1. *Real-time Data Table:* Sorts inbound leads chronologically, formatting scores (`High`, `Medium`, `Low`) and urgency levels.
  2. *Status Badge Rendering:* Maps lifecycle states: `Pending` (amber pulse), `Booked` (emerald glow), `Abandoned` (rose), `Captured` (muted).
  3. *Search & Filter Engine:* Instant client-side filtering by customer name, phone, email, notes, trade issue, urgency level, score, and date range.
  4. *Slide-Over Detail Drawer:* Clicking any lead slides out a comprehensive drawer showing:
     * Direct one-click dial link (`tel:+1...`) and email link (`mailto:...`).
     * Defect photo inspection modal with high-resolution lightbox.
     * Full conversational transcript between AI bot and homeowner.
     * Customer address with Google Maps directions shortcut.
  5. *Audit Trail Integration:* Dispatches `recordAuditTrail` events on triage interactions.
* **UI & UX Design Specifications:**
  * Table Density: Compact padding (`py-3.5 px-4`), hover highlight (`hover:bg-white/[0.03]`), border dividers.
  * Urgent Priority Highlighting: Emergency leads display a flashing amber border and distinct audio alert sound.
  * Slide-Over Drawer: Width 580px (`max-w-xl`), fixed right, glassmorphic dark container with smooth slide animation.
* **Acceptance Criteria:**
  * GIVEN an emergency lead is captured by the chatbot, WHEN the dispatcher has the Terminal open, THEN an emergency audio chime sounds, the lead appears at the top of the queue, and clicking it opens the slide-over drawer with one-click dial.

---

### Ticket CD-DASH-03: Field Service Dispatch Calendar & Appointment Manager (`Booking.jsx`)
* **Issue Type:** Story / Field Operations
* **Priority:** High (P1)
* **Summary:** Service appointment dispatch list and calendar with multi-tab status triage and manual status overrides.
* **Component:** `Dashboard / Booking`
* **Description:**
  Manages scheduled service visits and consultations. Features a unified date parsing engine handling disparate date formats (`booked_slot`, `selected_date`, `preferred_date`), appointment status filtering, and manual status override dropdowns.
* **Functional Specifications:**
  1. *Unified Date Parser:* Standardizes date candidates (`2026-11-10 14:00`, `Nov 10 at 2:00 PM`, ISO strings) into comparable JavaScript Date objects.
  2. *Appointment Tabs:* Filter by status: `All`, `Upcoming`, `Near upcoming` (within 24 hours), `Completed`, `Rescheduled`, `Cancelled`, `No-show`.
  3. *Manual Status Overrides:* Dropdown updates RTDB `{ booking_status }` directly for the lead (`Completed`, `Rescheduled`, `Cancelled`).
  4. *Appointment Drawer:* Slide-over inspection drawer displaying customer details, service problem description, and associated call duration.
* **UI & UX Design Specifications:**
  * Tab Navigation: Pill-style active tabs with smooth highlight transition (`bg-[var(--primary)] text-white`).
  * Time Status Pill: Shows countdown for upcoming jobs ("In 2 hours", "Tomorrow at 9:00 AM").
* **Acceptance Criteria:**
  * GIVEN an upcoming appointment, WHEN the dispatcher overrides status to "Completed", THEN the lead is immediately categorized under the Completed tab and synced to Firebase.

---

### Ticket CD-DASH-04: Full Conversational Transcript Explorer & Drop-off Intelligence (`Conversations.jsx`)
* **Issue Type:** Story / Intelligence
* **Priority:** Medium (P2)
* **Summary:** Plain-text conversation browser with chat bubble rendering, drop-off point analyzer, and field capture completion scoring.
* **Component:** `Dashboard / Conversations`
* **Description:**
  Allows supervisors and business owners to inspect the exact transcripts of every conversation handled by the AI Front-Desk. Provides automated drop-off detection to pinpoint why visitors leave without completing a booking.
* **Functional Specifications:**
  1. *Transcript Parser:* Parses `full_conversation_transcript` into interactive chat bubbles labeled `[BOT]:` and `[USER]:`.
  2. *Drop-Off Analyzer:* Analyzes the final interaction in abandoned sessions (e.g., "At Booking Confirmation", "Selecting Date", "User abandoned session during discovery").
  3. *Completeness Score:* Computes captured parameters (Name, Email, Phone, Problem, Address) and displays a completeness rating (0-100%).
  4. *Full-Text Search:* Scans inside customer messages and AI prompts for specific keywords (e.g. "warranty", "estimate", "commercial").
* **UI & UX Design Specifications:**
  * Chat Log View: Scrollable bubble container styled identically to modern messaging applications.
  * Meta Sidebar: Sticky sidebar displaying lead details, inspection photos, and drop-off diagnostic tags.
* **Acceptance Criteria:**
  * GIVEN an abandoned chat session, WHEN viewed in Conversations, THEN the system displays the exact drop-off step and highlights missing contact fields.

---

### Ticket CD-DASH-05: AI Business Intelligence Visualizer & Sentiment Trends (`Insight.jsx`)
* **Issue Type:** Story / Reporting & BI
* **Priority:** High (P1)
* **Summary:** Recharts visual intelligence dashboard displaying conversational sentiment, peak inquiry hours, and AI-driven business recommendations.
* **Component:** `Dashboard / Insight`
* **Description:**
  Integrates Recharts visual components with `/api/insights` to generate strategic insights from aggregate lead interactions.
* **Functional Specifications:**
  1. *Sentiment Distribution (Pie Chart):* Breaks down inquiries into Positive, Neutral, Urgent, and Frustrated categories.
  2. *Peak Ingestion Hours (Bar/Line Chart):* Highlights the times of day when visitors request service most frequently.
  3. *Service Breakdown:* Visualizes most requested services (e.g. AC Repair vs Duct Cleaning vs Water Heater).
  4. *On-Demand Generation:* Button invokes `POST /api/insights` to summarize recurring customer pain points and recommend business adjustments.
* **UI & UX Design Specifications:**
  * Charts: Responsive Recharts containers (`ResponsiveContainer`), custom dark-mode tooltips, consistent color palette (`#10b981`, `#3b82f6`, `#f59e0b`, `#ef4444`, `#8b5cf6`).
  * Recommendations Card: AI highlight card with sparkle icon and actionable bullet points.
* **Acceptance Criteria:**
  * GIVEN the user clicks "Generate Insights", WHEN the API returns, THEN the graphs and recommendations update dynamically.

---

### Ticket CD-DASH-06: Multi-Dimensional Operational Reporting & Data Export (`Report.jsx`)
* **Issue Type:** Story / Exports & Compliance
* **Priority:** High (P1)
* **Summary:** Operations reporting module with 7 analytical report types, client-side CSV Data URI export, and print/PDF formatting.
* **Component:** `Dashboard / Report`
* **Description:**
  Formats lead and dispatch metrics into 7 operational report views: Lead Generation, Overall Performance, Booked Appointments, Missed Opportunities, After-Hours Leads, Conversation Insights, and Estimated Revenue. Includes client-side CSV and print-optimized PDF generation.
* **Functional Specifications:**
  1. *Report Dimensions:* 7 distinct view presets with customized data filtering.
  2. *Date Range Selector:* Last 7 Days, Last 30 Days, Last 90 Days, and All Time.
  3. *Client-side CSV Export:* Converts filtered lead objects into sanitized CSV format, triggering browser download via `data:text/csv;charset=utf-8`.
  4. *Print & PDF Generator:* Executes `window.print()` with `@media print` stylesheets hiding navigation bars and optimizing tables for letter/A4 paper.
* **UI & UX Design Specifications:**
  * Interactive Bar Breakdown: Hourly/daily distribution bars with hover tooltips.
  * Export Controls: Dedicated "Export CSV" and "Print Report" action buttons with loading spinners.
* **Acceptance Criteria:**
  * GIVEN a date filter of Last 30 Days, WHEN the user exports CSV, THEN a sanitized `.csv` file downloads immediately containing all corresponding leads.

---

### Ticket CD-DASH-07: Persistent Audio Chime & Live Notifications Feed (`LiveNotifications.jsx`)
* **Issue Type:** Story / Alerts
* **Priority:** High (P1)
* **Summary:** Reactive notification banner and feed listening to RTDB `notifications/` with sound alerts and 30-day auto-pruning.
* **Component:** `Dashboard / LiveNotifications`
* **Description:**
  Maintains an alert channel for operators. Listens to `notifications/` in RTDB, playing an audible chime when high-priority leads arrive and automatically cleaning up entries older than 30 days.
* **Functional Specifications:**
  1. *Audio Chime:* Plays HTML5 audio notification on new inbound leads when unmuted.
  2. *Retention Pruning:* Filters out notification entries exceeding 30 days (`THIRTY_DAYS_MS`).
  3. *Mark as Read:* Acknowledges notifications individually or in bulk via `/api/notifications/acknowledge`.
* **Acceptance Criteria:**
  * GIVEN an inbound notification arrives, WHEN the operator has the dashboard open, THEN an audible chime plays and an unread counter badge updates in the top bar.

---

### Ticket CD-DASH-08: Visitor Geolocation Cluster Map & Hardware Telemetry (`CookieDataDisplay.jsx`)
* **Issue Type:** Story / Telemetry & Maps
* **Priority:** Medium (P2)
* **Summary:** Interactive Google Maps visitor cluster telemetry and device fingerprinting manager with batch archiving.
* **Component:** `Dashboard / Cookie Telemetry`
* **Description:**
  Visualizes website visitor traffic using `@vis.gl/react-google-maps`. Displays IP-resolved locations on a world radar map, correlates hardware specifications (OS, Browser, Screen resolution), and provides GDPR-compliant bulk deletion and archive capabilities.
* **Functional Specifications:**
  1. *Map Clustering:* Renders visitor pins with custom marker icons; clicking a pin displays visitor details, city, and session length.
  2. *Telemetry Grid (`CookieGrid.jsx`):* Tabular view of anonymous visitor IDs, IP addresses, country/city, device types, and consent timestamps.
  3. *Batch Management:* Select multiple cookies to archive or delete with modal confirmation dialog.
  4. *30-Day Auto Purge:* Automatically removes archived cookie records exceeding 30 days.
* **UI & UX Design Specifications:**
  * Map Widget: Dark-themed Google Maps canvas with violet and cyan glowing cluster markers.
  * Search & Filter: Filter by Device (Desktop/Mobile), Region, Language, and Search Query.
* **Acceptance Criteria:**
  * GIVEN website visitors browse the host site, WHEN the operator views the Cookie Telemetry screen, THEN live pins appear on the Google Map showing geographic locations.
