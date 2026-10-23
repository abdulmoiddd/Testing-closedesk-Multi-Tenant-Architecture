// src/pages/api/superadmin/verify-pin.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../../lib/apiMiddleware";
import { db } from "../../../lib/firebase";
import { recordAuditTrail } from "../../../lib/auditTracer";

// Rate limit PIN verification to prevent 4-digit PIN brute forcing
const pinAttemptsMap = new Map();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function getPinRateKey(req, username) {
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress || "unknown_ip";
  return `pin_${clientIp}_${(username || "superadmin").toLowerCase()}`;
}

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, pin } = req.body || {};

  if (!username || !pin) {
    return res.status(400).json({ error: "Username and PIN are required" });
  }

  const cleanUsername = String(username).trim();
  const cleanPin = String(pin).trim();
  const rateKey = getPinRateKey(req, cleanUsername);
  const now = Date.now();

  const record = pinAttemptsMap.get(rateKey) || { count: 0, lockedUntil: 0 };
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many failed PIN attempts. Locked for ${Math.ceil(remainingSeconds / 60)} minutes.`,
      retryAfter: remainingSeconds
    });
  }

  try {
    const adminRef = ref(db, "superAdmin");
    const snapshot = await get(adminRef);

    if (!snapshot.exists()) {
      return res.status(500).json({ error: "SuperAdmin configuration unavailable" });
    }

    const adminData = snapshot.val();
    const adminList = Array.isArray(adminData) ? adminData : Object.values(adminData);
    const admin = adminList.find(
      (a) => a && a.name && a.name.toLowerCase() === cleanUsername.toLowerCase()
    );

    if (admin && String(admin.pin).trim() === cleanPin) {
      pinAttemptsMap.delete(rateKey);

      recordAuditTrail(apiLogger, "pin_verification_success", {
        who: cleanUsername,
        target: "sensitive_action",
        status: "success"
      });

      return res.status(200).json({ success: true, verified: true });
    } else {
      record.count += 1;
      if (record.count >= MAX_PIN_ATTEMPTS) {
        record.lockedUntil = now + PIN_LOCKOUT_DURATION_MS;
      }
      pinAttemptsMap.set(rateKey, record);

      recordAuditTrail(apiLogger, "pin_verification_failure", {
        who: cleanUsername,
        target: "sensitive_action",
        status: "failed",
        reason: "Invalid PIN"
      });

      return res.status(401).json({ error: "Invalid PIN. Access denied." });
    }
  } catch (error) {
    apiLogger.error("PIN Verification Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withApiLogger(handler, "SuperAdmin-VerifyPin-API");
