// src/pages/api/auth/microsoft/callback.js
import { db } from "../../../../lib/firebase";
import { ref, update } from "firebase/database";
import { extractSession } from "../../../../lib/authSession";
import { validateOAuthState } from "../../../../lib/oauthState";

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error || !code) {
    console.error("Microsoft OAuth Query Error:", error, error_description);
    return res.redirect(`/lg?status=microsoft_auth_failed&msg=${encodeURIComponent(error_description || error)}`);
  }

  const callerSession = await extractSession(req);

  // Validate state token: HMAC signature, expiry, purpose, user binding, and single-use replay protection
  const stateValidation = validateOAuthState(state, {
    expectedPurpose: "email_oauth_connect",
    expectedSub: callerSession ? callerSession.sub : null,
  });

  if (!stateValidation.valid) {
    return res.status(403).json({
      error: `Invalid or unauthorized OAuth state: ${stateValidation.error}`,
    });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/microsoft/callback`;

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || "Token exchange failed");
    }

    // 2. Fetch the connected user's Outlook profile email
    const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const userEmail = userData.mail || userData.userPrincipalName;

    // 3. Store OAuth credentials in Firebase settings/email_config
    await update(ref(db, "settings/email_config"), {
      provider: "microsoft_oauth",
      smtpEmail: userEmail,
      refreshToken: tokenData.refresh_token,
      clientId: clientId,
      connectedAt: new Date().toISOString(),
    });

    // 4. Redirect to Settings with success indicator
    res.redirect("/lg?status=microsoft_auth_success");
  } catch (err) {
    console.error("Microsoft OAuth Callback Error:", err);
    res.redirect(`/lg?status=microsoft_auth_error&msg=${encodeURIComponent(err.message)}`);
  }
}
