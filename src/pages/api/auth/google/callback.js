// src/pages/api/auth/google/callback.js
import { db } from "../../../../lib/firebase";
import { ref, update } from "firebase/database";
import { verifySessionToken } from "../../../../lib/authSession";

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect("/lg?status=google_auth_failed");
  }

  // Verify HMAC-signed cryptographic state token to prevent CSRF and unauthenticated email hijacking
  const verifiedState = state ? verifySessionToken(state) : null;
  if (
    !verifiedState ||
    verifiedState.role !== "superadmin" ||
    verifiedState.purpose !== "email_oauth_connect"
  ) {
    return res.status(403).json({
      error: "Invalid or unauthorized OAuth state. Binding rejected.",
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  try {
    // 1. Exchange authorization code for Refresh & Access tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || "Token exchange failed");
    }

    // 2. Fetch the connected Gmail address
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const userEmail = userData.email;

    // 3. Store OAuth credentials in Firebase settings/email_config
    await update(ref(db, "settings/email_config"), {
      provider: "google_oauth",
      smtpEmail: userEmail,
      refreshToken: tokenData.refresh_token,
      clientId: clientId,
      clientSecret: clientSecret,
      connectedAt: Date.now(),
    });

    // Send a success message to the parent window and close the popup
    return res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_SUCCESS' }, '*');
          window.close();
        } else {
          window.location.href = "/lg";
        }
      </script>
    `);
  } catch (err) {
    console.error("Google OAuth Error:", err);
    return res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_ERROR' }, '*');
          window.close();
        } else {
          window.location.href = "/lg";
        }
      </script>
    `);
  }
}
