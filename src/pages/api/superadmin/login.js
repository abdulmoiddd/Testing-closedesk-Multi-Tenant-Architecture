// src/pages/api/superadmin/login.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../../lib/apiMiddleware";
import { db } from "../../../lib/firebase";
import { recordAuditTrail } from "../../../lib/auditTracer";

// --- SECURITY: Server-Side Rate Limiter for SuperAdmin Login ---
const superAdminAttemptsMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function getRateKey(req, username) {
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress || "unknown_ip";
  return `superadmin_${clientIp}_${username.toLowerCase()}`;
}

function checkRateLimit(rateKey) {
  const now = Date.now();
  const record = superAdminAttemptsMap.get(rateKey);

  if (!record) return { isLocked: false };

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    superAdminAttemptsMap.delete(rateKey);
    return { isLocked: false };
  }

  return { isLocked: false };
}

function recordFailedAttempt(rateKey) {
  const now = Date.now();
  const record = superAdminAttemptsMap.get(rateKey) || { count: 0, firstAttempt: now };
  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  superAdminAttemptsMap.set(rateKey, record);
}

function recordSuccessfulLogin(rateKey) {
  superAdminAttemptsMap.delete(rateKey);
}

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password).trim();

  // Rate limit check
  const rateKey = getRateKey(req, cleanUsername);
  const { isLocked, remainingSeconds } = checkRateLimit(rateKey);

  if (isLocked) {
    apiLogger.warn("auth", "superadmin_rate_limited", {
      context: { user_id: cleanUsername, remainingSeconds }
    });
    return res.status(429).json({
      error: `Too many failed SuperAdmin login attempts. Locked for ${Math.ceil(remainingSeconds / 60)} minutes.`,
      retryAfter: remainingSeconds
    });
  }

  try {
    const adminRef = ref(db, "superAdmin");
    const snapshot = await get(adminRef);

    if (!snapshot.exists()) {
      return res.status(500).json({ error: "SuperAdmin database configuration unavailable" });
    }

    const adminData = snapshot.val();
    const adminList = Array.isArray(adminData) ? adminData : Object.values(adminData);
    const matchedAdmin = adminList.find(
      (admin) =>
        admin &&
        admin.name &&
        admin.name.toLowerCase() === cleanUsername.toLowerCase() &&
        String(admin.password).trim() === cleanPassword
    );

    if (matchedAdmin) {
      recordSuccessfulLogin(rateKey);

      recordAuditTrail(apiLogger, "superadmin_login_success", {
        who: cleanUsername,
        target: "superadmin_console",
        status: "success"
      });

      return res.status(200).json({
        success: true,
        name: matchedAdmin.name,
      });
    } else {
      recordFailedAttempt(rateKey);

      recordAuditTrail(apiLogger, "superadmin_login_failure", {
        who: cleanUsername,
        target: "superadmin_console",
        status: "failed",
        reason: "Invalid credentials"
      });

      return res.status(401).json({ error: "Invalid super admin credentials" });
    }
  } catch (error) {
    apiLogger.error("SuperAdmin Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withApiLogger(handler, "SuperAdmin-Login-API");
