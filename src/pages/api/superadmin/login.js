// src/pages/api/superadmin/login.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../../lib/apiMiddleware";
import { db } from "../../../lib/firebase";
import { recordAuditTrail } from "../../../lib/auditTracer";

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
