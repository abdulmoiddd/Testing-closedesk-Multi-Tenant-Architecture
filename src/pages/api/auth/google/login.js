// src/pages/api/auth/google/login.js
import { extractSession } from "../../../../lib/authSession";
import { generateOAuthState } from "../../../../lib/oauthState";

export default async function handler(req, res) {
  const session = await extractSession(req);
  if (!session || session.role !== "superadmin") {
    return res.status(401).json({
      error: "Unauthorized. Active SuperAdmin session required to initiate OAuth credential binding.",
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`
  );

  const scope = encodeURIComponent(
    "https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
  );

  // Signed cryptographic state prevents CSRF and unauthenticated email config hijacking
  const state = generateOAuthState({
    sub: session.sub,
    role: "superadmin",
    purpose: "email_oauth_connect",
    expiresIn: 600,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
}
