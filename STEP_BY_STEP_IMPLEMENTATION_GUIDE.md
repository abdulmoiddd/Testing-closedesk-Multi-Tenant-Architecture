# Beginner's Step-by-Step Implementation & Deployment Guide: CloseDesk

**Document:** Complete Hands-On Integration Guide for New Users & Beginners  
**Product:** CloseDesk by Aicyro  
**Version:** 2.0 (Production Multi-Tenant Edition)  
**Goal:** Deploy the **CloseDesk Multimodal Chatbot Widget** and **Pulse Operations Dashboard** on any new website in less than 30 minutes, without writing complex backend code.

---

## 1. What You Are Building & How It Works

Before running any code, understand the 3 simple pieces of the CloseDesk platform:

```text
  +----------------------------------------------------------------------------------------------------+
  |                                        THE 3 PIECES OF CLOSEDESK                                   |
  |                                                                                                    |
  |  1. YOUR CLIENT'S NEW WEBSITE              2. THE CLOSEDESK BACKEND & PULSE        3. THE CLOUD    |
  |  (WordPress, Webflow, Shopify, or React)    (Hosted on Vercel / Netlify)          (Firebase/OpenAI)|
  |                                                                                                    |
  |  +----------------------------------+       +-------------------------------+      +------------+  |
  |  |  Client's Existing Website       |       |  api.youragency.com           |      |  OpenAI    |  |
  |  |                                  |       |                               |----->|  Realtime  |  |
  |  |  [ Floating CloseDesk Widget ]   |------>|  * /api/openai-token          |      |  GPT-4o    |  |
  |  |   - Voice AI (Talk with mic)     |       |  * /api/chat                  |      +------------+  |
  |  |   - Text Chat                    |       |  * /api/analyze-image         |             |        |
  |  |   - Upload broken equipment photo|       |                               |      +------------+  |
  |  +----------------------------------+       |  * Pulse Dashboard (/lg)      |<---->|  Firebase  |  |
  |                                             |    (Triage leads & calendar)  |      |  Database  |  |
  |                                             +-------------------------------+      +------------+  |
  +----------------------------------------------------------------------------------------------------+
```

1. **The Client's Website (Front-End):** Any website (WordPress, Shopify, Webflow, custom React). It simply loads the floating CloseDesk widget with one line of HTML code.
2. **CloseDesk Backend & Dashboard (`CloseDesk-Aicyro-GIT`):** A single Next.js project that you deploy to Vercel in 3 clicks. It manages the AI, processes speech and images, and provides the **Pulse Dashboard** at `/lg` for the contractor.
3. **Cloud Providers:** Free Firebase Realtime Database (to store leads and transcripts) and OpenAI (for GPT-4o voice and intelligence).

---

## 2. Phase 1: Prerequisites & Account Setup (10 Minutes)

You need two free cloud accounts to run the platform:

### 2.1 Step 1: Get an OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com) and log in or create an account.
2. Navigate to **API Keys** and click **+ Create new secret key**.
3. Name it `CloseDesk-Production` and copy the secret key (it begins with `sk-proj-...`).
4. Make sure your OpenAI account has at least \$5 credit loaded for API calls.

### 2.2 Step 2: Set Up a Free Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Name your project (e.g. `closedesk-platform`) and disable Google Analytics for simplicity.
3. Once created, click the **Web icon (`</>`)** on the dashboard to register a web app:
   * App nickname: `CloseDesk Web Engine`
   * Copy the `firebaseConfig` object values (you will need them in Step 2.3).
4. In the left sidebar, click **Build > Realtime Database**:
   * Click **Create Database**, select a region (e.g., `United States`), and choose **Start in test mode**.
   * Copy the database URL (e.g. `https://your-project-default-rtdb.firebaseio.com/`).
5. In the left sidebar, click **Build > Storage**:
   * Click **Get Started**, choose **Start in test mode**, and click **Done**.

### 2.3 Step 3: Create Your `.env.local` File
In your repository root directory (`CloseDesk-Aicyro-GIT`), create a file named `.env.local` and paste your keys:

```ini
# =============================================================================
# CLOSEDESK PRODUCTION ENVIRONMENT VARIABLES
# =============================================================================

# 1. OpenAI Secret Key
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_OPENAI_KEY_HERE

# 2. Firebase Configuration (From Firebase Console > Project Settings > Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...YOUR_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef123456

# 3. Base App URL (Use localhost for development, your real domain in production)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. Security Passkey for Daily Maintenance Cron
CRON_SECRET=super_secret_passkey_123456789
```

---

## 3. Phase 2: Deploying the Backend & Pulse Dashboard (5 Minutes)

Deploy the central engine so that any website can connect to it.

### Step 1: Deploy to Vercel (Easiest & Free)
1. Push this repository (`CloseDesk-Aicyro-GIT`) to your GitHub or GitLab account.
2. Go to [vercel.com](https://vercel.com) and click **Add New > Project**.
3. Import your repository.
4. In the **Environment Variables** section, expand it and paste all the keys from your `.env.local` file.
5. Click **Deploy**. Within 2 minutes, Vercel gives you a live production URL:
   ```text
   https://closedesk-engine.vercel.app
   ```

### Step 2: Verify Your Live Deployment
Open your browser and test these two URLs:
* `https://closedesk-engine.vercel.app/lg`  
  *(Should open the Pulse Dashboard login screen)*
* `https://closedesk-engine.vercel.app/embed/chatbot?tenant=default`  
  *(Should show the full-screen floating CloseDesk AI chatbot ready for testing)*

---

## 4. Phase 3: Provisioning a New Client in Super Admin (2 Minutes)

Before embedding the chatbot on a client's website, register the client in your Pulse control plane:

```text
+----------------------------------------------------------------------------------------------------+
|                                    PROVISIONING A CLIENT IN /lg                                    |
|                                                                                                    |
|   1. Open /lg                  2. Click "SuperAdmin"        3. Click "New Client"                  |
|      Login as SuperAdmin       Enter PIN / Passkey             Name: "Apex Plumbing"               |
|                                                                Tenant ID: "apex_plumbing"          |
|                                                                Industry Pack: "plumbing_v2"        |
|                                                                Domain: "https://apexplumbing.com"  |
|                                                                                                    |
|                                4. Save & Copy Widget Code Snippet!                                 |
+----------------------------------------------------------------------------------------------------+
```

1. Navigate to your live dashboard: `https://YOUR_DOMAIN.vercel.app/lg`.
2. Toggle to the **Super Admin Portal** view.
3. In the **Client Management** tab, click **+ Add New Client**:
   * **Company Name:** `Apex Emergency Plumbing`
   * **Tenant ID:** `apex_plumbing` *(Must be lowercase, no spaces)*
   * **Industry Pack:** Select `Plumbing`
   * **Allowed Domain:** `https://apexplumbing.com`
   * **Admin Username:** `apex_admin`
   * **Admin Password:** Create a password for the client (e.g. `Apex2026!`)
4. Click **Create Tenant**. CloseDesk automatically configures their database partition in Firebase at `/tenants/apex_plumbing/`.

---

## 5. Phase 4: Embedding the Widget on the New Website

You can now add the CloseDesk AI Front-Desk to **any website**. Pick your platform below:

### Option 4A: Plain HTML / Static Website
Add this snippet directly before the closing `</body>` tag of your HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Apex Emergency Plumbing</title>
</head>
<body>
  <h1>Welcome to Apex Plumbing</h1>
  <p>Call us 24/7 for plumbing emergencies.</p>

  <!-- ======================================================== -->
  <!-- CLOSEDESK UNIVERSAL EMBEDDABLE WIDGET                    -->
  <!-- ======================================================== -->
  <script 
    src="https://YOUR_DOMAIN.vercel.app/widget.js" 
    data-tenant="apex_plumbing" 
    defer>
  </script>
</body>
</html>
```

---

### Option 4B: WordPress Website
1. Log in to your WordPress Admin dashboard (`/wp-admin`).
2. Go to **Plugins > Add New** and search for **WPCode** (or any "Insert Headers and Footers" plugin).
3. Click **Install Now** and **Activate**.
4. In the left sidebar, go to **Code Snippets > Header & Footer**.
5. In the **Footer** box, paste:
   ```html
   <script 
     src="https://YOUR_DOMAIN.vercel.app/widget.js" 
     data-tenant="apex_plumbing" 
     defer>
   </script>
   ```
6. Click **Save Changes**. Visit your WordPress homepage—the CloseDesk floating widget appears instantly in the bottom-right corner!

---

### Option 4C: Webflow Website
1. Open your Webflow Designer and open your project.
2. Click the **W** icon in the top left and select **Site Settings**.
3. In the left navigation, click **Custom Code**.
4. Scroll down to the **Footer Code** section and paste:
   ```html
   <script 
     src="https://YOUR_DOMAIN.vercel.app/widget.js" 
     data-tenant="apex_plumbing" 
     defer>
   </script>
   ```
5. Click **Save Changes** and click **Publish to Selected Domains**.

---

### Option 4D: Shopify Store
1. Log in to your Shopify Admin.
2. Go to **Online Store > Themes**.
3. Next to your active theme, click the **three dots (`...`)** and select **Edit code**.
4. In the left file tree, click `layout/theme.liquid`.
5. Scroll to the very bottom of `theme.liquid` and find the closing `</body>` tag.
6. Paste the script tag right above `</body>`:
   ```liquid
   <!-- CloseDesk AI Multimodal Assistant -->
   <script 
     src="https://YOUR_DOMAIN.vercel.app/widget.js" 
     data-tenant="apex_plumbing" 
     defer>
   </script>
   </body>
   ```
7. Click **Save**.

---

### Option 4E: Modern Next.js or React Website
If you are building a custom React or Next.js website and want to render the widget directly as a React component:

1. Copy the component folder [`src/components/Chatbot/`](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Chatbot/) into your new Next.js project.
2. In your `pages/_app.jsx` or layout file, mount the component with your `tenantId`:
   ```jsx
   // pages/_app.jsx or app/layout.jsx
   import "@/styles/globals.css";
   import AicyroChatbot from "@/components/Chatbot/AicyroChatbot";

   export default function MyApp({ Component, pageProps }) {
     return (
       <>
         <Component {...pageProps} />

         {/* CloseDesk Multimodal AI Front-Desk */}
         <AicyroChatbot tenantId="apex_plumbing" />
       </>
     );
   }
   ```
3. Set your backend URL in your new project's `.env.local`:
   ```bash
   NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN.vercel.app
   NEXT_PUBLIC_TENANT_ID=apex_plumbing
   ```

---

## 6. Phase 5: Giving Your Client Access to Their Pulse Dashboard

Now hand off the operational dashboard to the business owner or dispatcher:

```text
+----------------------------------------------------------------------------------------------------+
|                                    CLIENT DISPATCHER DAILY WORKFLOW                                |
|                                                                                                    |
|  1. Dispatcher opens: https://YOUR_DOMAIN.vercel.app/lg                                            |
|  2. Logs in with:                                                                                  |
|     * Username: apex_admin                                                                         |
|     * Password: [Their Secret Password]                                                            |
|                                                                                                    |
|  3. What they see:                                                                                 |
|     ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────────────────┐   |
|     │ Terminal Screen        │  │ Booking Screen         │  │ Conversations Screen            │   |
|     │ Red emergency alerts   │  │ Confirmed calendar     │  │ Full text & voice call replays  │   |
|     │ One-click phone callback│ │ dispatch appointments  │  │ Photos of broken equipment      │   |
|     └────────────────────────┘  └────────────────────────┘  └─────────────────────────────────┘   |
+----------------------------------------------------------------------------------------------------+
```

### What the Client Can Do in `/lg`:
1. **Live Lead Triage ([TerminalScreen.jsx](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Dashboard/TerminalScreen.jsx)):**  
   Whenever a visitor speaks to the bot or requests an emergency service, it appears on the contractor's screen with a sound ping and a flashing red **EMERGENCY** badge. The dispatcher clicks **Call Customer** to instantly dial them.
2. **Review Voice Recordings ([Conversations.jsx](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Dashboard/Conversations.jsx)):**  
   The contractor can review full text transcripts and listen to the customer's voice audio, as well as view inspection photos uploaded by the homeowner.
3. **Customize Their AI Front-Desk ([Settings/](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Dashboard/Settings/)):**  
   The contractor can:
   * Set business hours and emergency on-call numbers ([BusinessProfile.jsx](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Dashboard/Settings/BusinessProfile.jsx)).
   * Choose their AI voice persona (Alloy, Echo, Shimmer, Coral, Ash) and test it live ([Chatbotsetting.jsx](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Dashboard/Settings/Chatbotsetting.jsx)).
   * Adjust the brand accent color ([apearance.jsx](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/src/components/Dashboard/Settings/apearance.jsx)).

---

## 7. Phase 6: End-to-End Flight Check (Verification Test)

Follow these 4 steps to verify that your new deployment works perfectly:

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **Test 1: Widget Visibility** | Open the client's website in Google Chrome. | The circular AI Front-Desk launcher bubble appears in the bottom-right corner. |
| **Test 2: Realtime Voice Call** | Click the launcher, click the **Microphone** icon, allow mic access, and say: *"I have an emergency water leak under my kitchen sink."* | The bot speaks back within 1 second: *"Please turn off the main water shutoff valve immediately. Let me get an emergency plumber to you. What is your phone number?"* |
| **Test 3: Lead Capture** | Provide a test phone number: *"555-019-2834"*. | The bot confirms the callback request and closes the qualification loop. |
| **Test 4: Verify Pulse Dashboard** | Open `/lg` in another tab, log in as `apex_admin`, and look at the **Terminal Screen**. | The lead appears at the top of the queue with an audible chime, priority labeled `EMERGENCY`, and phone `555-019-2834`. |

---

## 8. Troubleshooting Common Beginner Pitfalls

### Issue 1: "Microphone Not Allowed" or Voice Won't Connect
* **Cause:** WebRTC audio requires a secure HTTPS connection.
* **Fix:** Ensure both your host website and your Vercel backend are running on `https://`, not `http://`. Browsers block microphone access over unencrypted HTTP.

### Issue 2: Widget Disappears on Mobile
* **Cause:** Host website has a very high `z-index` banner or footer.
* **Fix:** The CloseDesk container has `z-index: 2147483647` (maximum 32-bit integer). If another element is blocking it, verify that your host theme does not have `overflow: hidden` on the `<body>` element.

### Issue 3: Firebase "Permission Denied" Error in Logs
* **Cause:** Firebase Realtime Database rules have expired or test mode has ended.
* **Fix:** Open Firebase Console > **Realtime Database > Rules**, and paste:
  ```json
  {
    "rules": {
      ".read": true,
      ".write": true
    }
  }
  ```
  *(For production hardening, refer to the authenticated tenant security rules in [MULTI_TENANT_ARCHITECTURE.md](file:///d:/Software%20House%2001/CloseDesk-Aicyro-GIT/MULTI_TENANT_ARCHITECTURE.md)).*

### Issue 4: "Voice Features Disabled by Administrator"
* **Cause:** The master kill-switch was toggled off.
* **Fix:** In Firebase RTDB, check `settings/chatbot_config/voiceEnabled` or `tenants/{tenant_id}/chatbot_config/voiceEnabled`. Ensure it is set to `true`.
