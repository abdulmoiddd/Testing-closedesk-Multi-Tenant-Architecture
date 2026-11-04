// src/pages/api/auth/microsoft/callback.js
import { db } from "../../../../lib/firebase";
import { ref, update } from "firebase/database";
import { verifySessionToken } from "../../../../lib/authSession";

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect("/lg?status=microsoft_auth_failed");
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

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/microsoft/callback`;
  const scope = "openid email offline_access https://outlook.office.com/SMTP.Send";

  try {
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          scope: scope,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || "Microsoft token exchange failed");
    }

    // Decode the ID token to extract the email directly
    const payloadBuffer = Buffer.from(tokenData.id_token.split('.')[1], 'base64');
    const decodedIdToken = JSON.parse(payloadBuffer.toString('utf8'));
    const userEmail = decodedIdToken.email || decodedIdToken.preferred_username;

    if (!userEmail) {
      throw new Error("Could not extract email address from Microsoft account.");
    }

    await update(ref(db, "settings/email_config"), {
      provider: "microsoft",
      smtpEmail: userEmail,
      refreshToken: tokenData.refresh_token,
      clientId: clientId,
      clientSecret: clientSecret,
      connectedAt: Date.now(),
    });

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
    console.error("Microsoft OAuth Error:", err);
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
