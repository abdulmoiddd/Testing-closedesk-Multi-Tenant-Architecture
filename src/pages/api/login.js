// src/pages/api/login.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase"; 
import { recordAuditTrail } from "../../lib/auditTracer"; // 🔥 TICKET 14

const checkUserMatch = (user, targetUser, targetPass) => {
  if (!user || typeof user !== "object") return false;
  const uName = (user.name || user.username || "").trim().toLowerCase();
  const tName = (targetUser || "").trim().toLowerCase();
  const uPass = String(user.password || "").trim();
  const tPass = String(targetPass || "").trim();
  return Boolean(uName && uPass && uName === tName && uPass === tPass);
};

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password, tenant_id } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password).trim();
  const cleanTenantId = tenant_id ? String(tenant_id).trim() : null;

  try {
    let isValidUser = false;
    let matchedTenantId = cleanTenantId || "default";

    // 1. Check tenant-specific partition if tenant_id is provided
    if (cleanTenantId && cleanTenantId !== "default") {
      const tenantUsersRef = ref(db, `tenants/${cleanTenantId}/users`);
      const tenantUsersSnap = await get(tenantUsersRef);
      if (tenantUsersSnap.exists()) {
        const users = tenantUsersSnap.val();
        const userList = Array.isArray(users) ? users : Object.values(users);
        isValidUser = userList.some((user) => checkUserMatch(user, cleanUsername, cleanPassword));
      }
    }

    // 2. If not matched yet, check root login partition
    if (!isValidUser) {
      const loginRef = ref(db, "login");
      const snapshot = await get(loginRef);

      if (snapshot.exists()) {
        const users = snapshot.val();
        const userList = Array.isArray(users) ? users : Object.values(users);
        isValidUser = userList.some((user) => checkUserMatch(user, cleanUsername, cleanPassword));
        if (isValidUser) {
          matchedTenantId = "default";
        }
      }
    }

    // 3. Fallback: Search across all tenants if no explicit tenant_id was given
    if (!isValidUser && !cleanTenantId) {
      const allTenantsRef = ref(db, "tenants");
      const allTenantsSnap = await get(allTenantsRef);
      if (allTenantsSnap.exists()) {
        const tenantsData = allTenantsSnap.val();
        for (const [tId, tVal] of Object.entries(tenantsData)) {
          if (tVal && tVal.users) {
            const userList = Array.isArray(tVal.users) ? tVal.users : Object.values(tVal.users);
            const match = userList.some((user) => checkUserMatch(user, cleanUsername, cleanPassword));
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
        who: cleanUsername,
        target: "pulse_dashboard",
        tenant_id: matchedTenantId,
        status: "success"
      });
      
      return res.status(200).json({ success: true, tenant_id: matchedTenantId });
    } else {
      recordAuditTrail(apiLogger, "login_failure", {
        who: cleanUsername,
        target: "pulse_dashboard",
        status: "failed",
        reason: "Invalid credentials"
      });
      
      return res.status(401).json({ error: "Invalid username or password" });
    }
  } catch (error) {
    apiLogger.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
export default withApiLogger(handler, "Login-API");
