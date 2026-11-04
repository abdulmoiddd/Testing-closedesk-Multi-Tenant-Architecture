// src/pages/api/auth/microsoft/login.js
import { extractSession } from "../../../../lib/authSession";
import { generateOAuthState } from "../../../../lib/oauthState";

export default async function handler(req, res) {
  const session = await extractSession(req);
  if (!session || session.role !== "superadmin") {
    return res.status(401).json({
      error: "Unauthorized. Active SuperAdmin session required to initiate OAuth credential binding.",
    });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/microsoft/callback`
  );

  const scope = encodeURIComponent(
    "offline_access https://outlook.office.com/SMTP.Send User.Read"
  );

  // Signed cryptographic state prevents CSRF and unauthenticated email config hijacking
  const state = generateOAuthState({
    sub: session.sub,
    role: "superadmin",
    purpose: "email_oauth_connect",
    expiresIn: 600,
  });

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
}
