// src/pages/api/login.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase"; 
import { recordAuditTrail } from "../../lib/auditTracer"; // 🔥 TICKET 14

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password, tenant_id } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    let isValidUser = false;
    let matchedTenantId = tenant_id || "default";

    // 1. Check tenant-specific partition if tenant_id is provided
    if (tenant_id && tenant_id !== "default") {
      const tenantUsersRef = ref(db, `tenants/${tenant_id}/users`);
      const tenantUsersSnap = await get(tenantUsersRef);
      if (tenantUsersSnap.exists()) {
        const users = tenantUsersSnap.val();
        isValidUser = Object.values(users).some(
          (user) => user && (user.name === username || user.username === username) && user.password === password,
        );
      }
    }

    // 2. If not matched yet, check root login partition
    if (!isValidUser) {
      const loginRef = ref(db, "login");
      const snapshot = await get(loginRef);

      if (snapshot.exists()) {
        const users = snapshot.val();
        isValidUser = Object.values(users).some(
          (user) => user && user.name === username && user.password === password,
        );
        if (isValidUser) {
          matchedTenantId = "default";
        }
      }
    }

    // 3. Fallback: Search across all tenants if no explicit tenant_id was given
    if (!isValidUser && !tenant_id) {
      const allTenantsRef = ref(db, "tenants");
      const allTenantsSnap = await get(allTenantsRef);
      if (allTenantsSnap.exists()) {
        const tenantsData = allTenantsSnap.val();
        for (const [tId, tVal] of Object.entries(tenantsData)) {
          if (tVal && tVal.users) {
            const match = Object.values(tVal.users).some(
              (user) => user && (user.name === username || user.username === username) && user.password === password,
            );
            if (match) {
              isValidUser = true;
              matchedTenantId = tId;
              break;
            }
          }
        }
      }
    }

    if (isValidUser) {
      recordAuditTrail(apiLogger, "login_success", {
        who: username,
        target: "pulse_dashboard",
        tenant_id: matchedTenantId,
        status: "success"
      });
      
      return res.status(200).json({ success: true, tenant_id: matchedTenantId });
    } else {
      recordAuditTrail(apiLogger, "login_failure", {
        who: username,
        target: "pulse_dashboard",
        status: "failed",
        reason: "Invalid credentials"
      });
      
      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    apiLogger.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
export default withApiLogger(handler, "Login-API");
