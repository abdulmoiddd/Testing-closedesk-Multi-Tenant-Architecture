// src/lib/tenantResolver.js
import { db } from "./firebase";
import { ref, get } from "firebase/database";

/**
 * Resolves the tenant_id from incoming request headers, query parameters,
 * request body, or host domain. Falls back to "default" if none provided.
 *
 * @param {import('next').NextApiRequest} req
 * @returns {string} resolved tenant_id
 */
export function resolveTenantId(req) {
  if (!req) return "default";

  // 1. Direct header (e.g., set by widget SDK or API client)
  const headerTenant = req.headers["x-tenant-id"];
  if (headerTenant && typeof headerTenant === "string" && headerTenant.trim()) {
    return sanitizeTenantId(headerTenant.trim());
  }

  // 2. Request body (for POST/PUT requests)
  if (req.body && typeof req.body === "object") {
    const bodyTenant = req.body.tenant_id || req.body.tenantId;
    if (bodyTenant && typeof bodyTenant === "string" && bodyTenant.trim()) {
      return sanitizeTenantId(bodyTenant.trim());
    }
  }

  // 3. Query string (e.g., /api/chat?tenant=brightstar_hvac)
  if (req.query) {
    const queryTenant = req.query.tenant || req.query.tenant_id;
    if (queryTenant && typeof queryTenant === "string" && queryTenant.trim()) {
      return sanitizeTenantId(queryTenant.trim());
    }
  }

  // 4. Host origin resolution (e.g., custom CNAME domain)
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      // Example: tenant1.closedesk.ai -> tenant1
      if (hostname.endsWith(".closedesk.ai") && hostname !== "app.closedesk.ai") {
        return sanitizeTenantId(hostname.replace(".closedesk.ai", ""));
      }
    } catch (_) {}
  }

  // Fallback to default tenant
  return "default";
}

/**
 * Strips dangerous characters to prevent Firebase Realtime Database path traversal.
 * Only allows lowercase alphanumeric characters, underscores, and hyphens.
 */
function sanitizeTenantId(id) {
  return id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/**
 * Fetches the tenant configuration from Firebase RTDB.
 * Checks /tenants/{tenantId}/config first.
 * If not found or tenantId is "default", falls back to global settings.
 *
 * @param {string} tenantId
 * @returns {Promise<{ tenantId: string, config: object, isMultiTenant: boolean }>}
 */
export async function getTenantConfig(tenantId = "default") {
  const safeId = sanitizeTenantId(tenantId);

  // If a specific tenant is requested, attempt to read their tenant partition
  if (safeId && safeId !== "default") {
    try {
      const tenantRef = ref(db, `tenants/${safeId}`);
      const snap = await get(tenantRef);
      if (snap.exists()) {
        const val = snap.val();
        return {
          tenantId: safeId,
          config: val.config || {},
          appearance: val.appearance || {},
          chatbotConfig: val.chatbot_config || val.config?.chatbot || {},
          businessProfile: val.business_profile || val.config?.business_profile || {},
          isMultiTenant: true,
          enabled: val.enabled !== false,
        };
      }
    } catch (err) {
      console.warn(`[TenantResolver] Failed to fetch tenant partition for ${safeId}:`, err.message);
    }
  }

  // Fallback: Global / Single-tenant default configuration
  return {
    tenantId: "default",
    config: {},
    appearance: {},
    chatbotConfig: {},
    businessProfile: {},
    isMultiTenant: false,
    enabled: true,
  };
}
