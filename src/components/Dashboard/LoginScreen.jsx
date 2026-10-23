// src/components/Dashboard/LoginScreen.jsx
"use client";

import { useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../../lib/firebase";

import { createWebsiteLogger } from "../../lib/loggerPresets";
import { generateCorrelationId } from "../../lib/tracer";

const baseLogger = createWebsiteLogger("PulseLogin");


const checkUserMatch = (user, targetUser, targetPass) => {
  if (!user || typeof user !== "object") return false;
  const uName = (user.name || user.username || "").trim().toLowerCase();
  const tName = (targetUser || "").trim().toLowerCase();
  const uPass = String(user.password || "").trim();
  const tPass = String(targetPass || "").trim();
  return Boolean(uName && uPass && uName === tName && uPass === tPass);
};

export default function LoginScreen({
  onLoginSuccess,
  onNavigateToSuperAdmin,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);



  const handleLogin = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError("Please enter both username and password.");
      return;
    }

    const txId = generateCorrelationId();
    const txLogger = baseLogger.child({
      correlation: { correlation_id: txId },
    });

    setIsLoading(true);
    setError("");

    txLogger.info("auth", "login_attempt", { context: { user_id: cleanUsername } });

    try {
      let isSuccess = false;
      let resolvedTenantId = "default";
      let resolvedUserName = cleanUsername;

      // -------------------------------------------------------------
      // 1. Try Backend API first (Enforces rate-limits & audit trails)
      // -------------------------------------------------------------
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cleanUsername,
            password: cleanPassword,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            isSuccess = true;
            resolvedTenantId = data.tenant_id || "default";
          }
        }
      } catch (apiErr) {
        console.warn("Backend /api/login endpoint call failed, falling back to direct Firebase verification:", apiErr);
      }

      // -------------------------------------------------------------
      // 2. Direct Firebase Realtime DB Verification (Fallback / Offline)
      // -------------------------------------------------------------
      if (!isSuccess) {
        // A. Check root 'login' array (Default / Primary Users)
        try {
          const loginSnap = await get(ref(db, "login"));
          if (loginSnap.exists()) {
            const rawLogin = loginSnap.val();
            const userList = Array.isArray(rawLogin) ? rawLogin : Object.values(rawLogin);
            const matchedUser = userList.find((u) => checkUserMatch(u, cleanUsername, cleanPassword));
            if (matchedUser) {
              isSuccess = true;
              resolvedUserName = matchedUser.name || matchedUser.username || cleanUsername;
              resolvedTenantId = "default";
            }
          }
        } catch (dbErr) {
          console.warn("Root login check error:", dbErr);
        }

        // B. Check all multi-tenant partitions in 'tenants/*/users'
        if (!isSuccess) {
          try {
            const tenantsSnap = await get(ref(db, "tenants"));
            if (tenantsSnap.exists()) {
              const tenantsVal = tenantsSnap.val();
              for (const [tId, tData] of Object.entries(tenantsVal)) {
                if (tData && tData.users) {
                  const userList = Array.isArray(tData.users)
                    ? tData.users
                    : Object.values(tData.users);
                  const matchedTenantUser = userList.find((u) =>
                    checkUserMatch(u, cleanUsername, cleanPassword)
                  );
                  if (matchedTenantUser) {
                    isSuccess = true;
                    resolvedUserName =
                      matchedTenantUser.name ||
                      matchedTenantUser.username ||
                      cleanUsername;
                    resolvedTenantId = tId;
                    break;
                  }
                }
              }
            }
          } catch (tenantDbErr) {
            console.warn("Tenants users check error:", tenantDbErr);
          }
        }
      }

      // -------------------------------------------------------------
      // 3. Evaluate Authentication Result
      // -------------------------------------------------------------
      if (isSuccess) {
        localStorage.removeItem("currentSuperAdmin");
        localStorage.setItem("currentUser", resolvedUserName);
        localStorage.setItem("currentTenant", resolvedTenantId);

        txLogger.info("auth", "login_success", {
          context: { user_id: resolvedUserName, tenant_id: resolvedTenantId },
        });

        if (typeof onLoginSuccess === "function") {
          onLoginSuccess({
            user: resolvedUserName,
            tenantId: resolvedTenantId,
          });
        }
      } else {
        txLogger.warn("auth", "login_failed_invalid_credentials", {
          context: { user_id: cleanUsername },
        });
        setError("Invalid username or password.");
      }
    } catch (err) {
      txLogger.error("auth", "login_error", {
        error: err,
        context: { user_id: cleanUsername },
      });
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4 font-sans text-[var(--foreground)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[50vw] h-[50vw] bg-[var(--primary)] opacity-10 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-white shadow-[0_0_20px_var(--lead-glow)] mb-4">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
            Aicyro Pulse
          </h1>
          <p className="text-[var(--foreground-muted)] text-sm mt-1 font-medium">
            Sign in to access your tenant dashboard
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold text-[var(--foreground-muted)] uppercase tracking-wider mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all font-medium"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-[var(--foreground-muted)] uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all font-medium"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[var(--primary)] text-white font-bold py-3.5 rounded-xl shadow-[0_4px_15px_var(--lead-glow)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                "Secure Sign In"
              )}
            </button>
          </form>

        <div className="mt-8 pt-6 border-t border-[var(--border-color)] text-center">
          <p className="text-xs text-[var(--foreground-muted)] font-medium">
            Platform Administrator?{" "}
            <button
              type="button"
              onClick={onNavigateToSuperAdmin}
              className="text-[var(--primary)] font-bold hover:underline transition-all bg-transparent border-none p-0 cursor-pointer"
            >
              Super Admin Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
