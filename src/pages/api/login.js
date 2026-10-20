// src/pages/api/login.js
import { ref, get } from "firebase/database";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase"; 
import { recordAuditTrail } from "../../lib/auditTracer"; // 🔥 TICKET 14

async function handler(req, res, apiLogger) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const loginRef = ref(db, "login");
    const snapshot = await get(loginRef);

    if (snapshot.exists()) {
      const users = snapshot.val();

      // Iterate through the "1", "2" keys to find a match
      const isValidUser = Object.values(users).some(
        (user) => user && user.name === username && user.password === password,
      );

      if (isValidUser) {
        // 🚨 TICKET 14: Log Successful Login
        recordAuditTrail(apiLogger, "login_success", {
          who: username,
          target: "pulse_dashboard",
          status: "success"
        });
        
        return res.status(200).json({ success: true });
      } else {
        // 🚨 TICKET 14: Log Failed Login Attempt
        recordAuditTrail(apiLogger, "login_failure", {
          who: username,
          target: "pulse_dashboard",
          status: "failed",
          reason: "Invalid credentials"
        });
        
        return res.status(401).json({ error: "Invalid credentials" });
      }
    } else {
      return res.status(500).json({ error: "Auth database not found" });
    }
  } catch (error) {
    apiLogger.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
export default withApiLogger(handler, "Login-API");