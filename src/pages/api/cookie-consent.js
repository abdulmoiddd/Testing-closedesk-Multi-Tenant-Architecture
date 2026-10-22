// src/pages/api/cookie-consent.js
import { ref, set } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase";
import { resolveTenantId } from "../../lib/tenantResolver";

async function handler(req, res, apiLogger) {
  // CORS Headers for cross-domain SDK embed requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tenant-id, x-correlation-id, x-session-id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      anonId,
      username,
      deviceName,
      consentStatus = "accepted",
      ipAddress,
      ipLocation = {},
      location = {},
      language,
      timeZone,
      rawUserAgent,
      hostUrl = "",
      pagePath = "",
      tenant_id,
    } = req.body || {};

    if (!anonId) {
      return res.status(400).json({ error: "anonId is required" });
    }

    const tenantId = resolveTenantId(req) || tenant_id || "default";
    const timestamp = new Date().toISOString();

    // Fallback IP extraction from server headers if client didn't supply it
    const clientIp =
      ipAddress && ipAddress !== "unknown"
        ? ipAddress
        : (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
            .split(",")[0]
            .trim();

    // Parse numeric coordinates safely for Google Maps markers
    const numLat = location.lat != null && !isNaN(Number(location.lat))
      ? Number(location.lat)
      : ipLocation.lat != null && !isNaN(Number(ipLocation.lat))
      ? Number(ipLocation.lat)
      : null;

    const numLng = location.lng != null && !isNaN(Number(location.lng))
      ? Number(location.lng)
      : ipLocation.lng != null && !isNaN(Number(ipLocation.lng))
      ? Number(ipLocation.lng)
      : null;

    const locationStatus =
      location.status ||
      (consentStatus === "accepted" && numLat != null ? "allowed" : "rejected");

    const payload = {
      id: anonId,
      anonId,
      username: username || `Visitor_${anonId.substring(4, 12)}`,
      deviceName: deviceName || "Unknown Device",
      consentStatus,
      ipAddress: clientIp,
      ipLocation: {
        ip: clientIp,
        city: ipLocation.city || "Unknown",
        region: ipLocation.region || "Unknown",
        country: ipLocation.country || "Unknown",
        lat: numLat,
        lng: numLng,
      },
      location: {
        status: locationStatus,
        lat: numLat,
        lng: numLng,
      },
      language: language || "en-US",
      timeZone: timeZone || "UTC",
      rawUserAgent: rawUserAgent || req.headers["user-agent"] || "unknown",
      hostUrl,
      pagePath,
      tenant_id: tenantId,
      isArchived: false,
      updatedAt: timestamp,
    };

    // 1. Write to global user_cookies partition (consumed by Pulse Dashboard /lg)
    const globalCookieRef = ref(db, `user_cookies/${anonId}`);
    await set(globalCookieRef, payload);

    // 2. Also write to tenant-scoped partition for multi-tenant isolation
    if (tenantId && tenantId !== "default") {
      const tenantCookieRef = ref(db, `tenants/${tenantId}/user_cookies/${anonId}`);
      await set(tenantCookieRef, payload);
    }

    return res.status(200).json({ success: true, anonId, tenantId });
  } catch (error) {
    apiLogger.error("Cookie Consent Save Error:", error);
    return res.status(500).json({ error: "Failed to persist cookie data" });
  }
}

export default withApiLogger(handler, "CookieConsent-API");
