// src/pages/api/login.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase"; 
import { recordAuditTrail } from "../../lib/auditTracer"; // 🔥 TICKET 14

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password, tenant_id } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    let matchedUser = null;
    let authSource = "legacy_login";
    let matchedTenantId = tenant_id || "tenant_aicyro";

    // 1. If an explicit tenant_id was provided, check that specific tenant first
    if (tenant_id && typeof tenant_id === "string" && tenant_id.trim() !== "") {
      const sanitizedId = tenant_id.trim();
      try {
        const tenantUsersRef = ref(db, `tenants/${sanitizedId}/users`);
        const tenantUsersSnap = await get(tenantUsersRef);

        if (tenantUsersSnap.exists()) {
          const usersObj = tenantUsersSnap.val();
          const found = Object.values(usersObj).find(
            (u) =>
              u &&
              (u.username === username || u.name === username || u.email === username) &&
              u.password === password
          );
          if (found) {
            matchedUser = {
              username: found.username || found.name || username,
              name: found.name || username,
              role: found.role || "tenant_admin",
              email: found.email || "",
              tenant_id: sanitizedId,
            };
            matchedTenantId = sanitizedId;
            authSource = "explicit_tenant_silo";
          }
        }
      } catch (err) {
        apiLogger.warn("auth", "explicit_tenant_user_check_failed", { error: err });
      }
    }

    // 2. Scan ALL tenants in /tenants to find which tenant this user belongs to
    if (!matchedUser) {
      try {
        const tenantsRef = ref(db, "tenants");
        const tenantsSnap = await get(tenantsRef);

        if (tenantsSnap.exists()) {
          const tenantsObj = tenantsSnap.val();
          for (const [tId, tenant] of Object.entries(tenantsObj)) {
            if (tenant && tenant.users) {
              const usersObj = tenant.users;
              const found = Object.values(usersObj).find(
                (u) =>
                  u &&
                  (u.username === username || u.name === username || u.email === username) &&
                  u.password === password
              );

              if (found) {
                matchedUser = {
                  username: found.username || found.name || username,
                  name: found.name || username,
                  role: found.role || "tenant_admin",
                  email: found.email || "",
                  tenant_id: tId,
                };
                matchedTenantId = tId;
                authSource = "tenant_scan";
                break;
              }
            }
          }
        }
      } catch (scanErr) {
        apiLogger.warn("auth", "all_tenants_scan_failed", { error: scanErr });
      }
    }

    // 3. Fallback to Legacy /login array if not found in any tenant silo
    if (!matchedUser) {
      const loginRef = ref(db, "login");
      const snapshot = await get(loginRef);

      if (snapshot.exists()) {
        const users = snapshot.val();
        const foundLegacy = Object.values(users).find(
          (user) => user && user.name === username && user.password === password,
        );

        if (foundLegacy) {
          matchedUser = {
            username: foundLegacy.name,
            name: foundLegacy.name,
            role: "tenant_admin",
            tenant_id: "tenant_aicyro",
          };
          matchedTenantId = "tenant_aicyro";
          authSource = "legacy_root";
        }
      }
    }

    if (matchedUser) {
      // 🚨 TICKET 14: Log Successful Login
      recordAuditTrail(apiLogger, "login_success", {
        who: username,
        target: "pulse_dashboard",
        status: "success",
        tenant_id: matchedTenantId,
        auth_source: authSource,
      });

      return res.status(200).json({
        success: true,
        tenant_id: matchedTenantId,
        username: matchedUser.username,
        role: matchedUser.role,
        name: matchedUser.name,
      });
    } else {
      // 🚨 TICKET 14: Log Failed Login Attempt
      recordAuditTrail(apiLogger, "login_failure", {
        who: username,
        target: "pulse_dashboard",
        status: "failed",
        tenant_id: matchedTenantId,
        reason: "Invalid credentials",
      });

      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    apiLogger.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withApiLogger(handler, "Login-API");