// src/components/Dashboard/LoginScreen.jsx
"use client";

import { useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../../lib/firebase";

import { createWebsiteLogger } from "../../lib/loggerPresets";
import { generateCorrelationId } from "../../lib/tracer";

const baseLogger = createWebsiteLogger("PulseLogin");

// Helper function to generate a random 6-character CAPTCHA
const generateCaptcha = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function LoginScreen({
  onLoginSuccess,
  onNavigateToSuperAdmin,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- CAPTCHA & BRUTE FORCE STATE ---
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaValue, setCaptchaValue] = useState("");
  const [userCaptchaInput, setUserCaptchaInput] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    const txId = generateCorrelationId();
    const txLogger = baseLogger.child({
      correlation: { correlation_id: txId },
    });

    setIsLoading(true);
    setError("");

    txLogger.info("auth", "login_attempt", { context: { user_id: username } });

    try {
      const loginRef = ref(db, "login");
      const snapshot = await get(loginRef);

      if (snapshot.exists()) {
        const loginData = snapshot.val();
        const matchedUser = loginData.find(
          (user) =>
            user && user.name === username && user.password === password,
        );

        if (matchedUser) {
          localStorage.setItem("currentUser", matchedUser.name);
          setFailedAttempts(0); // Reset on success

          txLogger.info("auth", "login_success", {
            context: { user_id: username },
          });
          onLoginSuccess();
        } else {
          // --- BRUTE FORCE CHECK ---
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);

          txLogger.warn("auth", "login_failed_invalid_credentials", {
            context: { user_id: username, attempts: newAttempts },
          });

          if (newAttempts >= 3) {
            setCaptchaValue(generateCaptcha());
            setShowCaptcha(true);
            setError("Too many failed attempts. Please solve the CAPTCHA to continue.");
          } else {
            setError(`Invalid username or password. (${3 - newAttempts} attempts left)`);
          }
        }
      } else {
        txLogger.error("auth", "login_db_unavailable", {
          context: { user_id: username },
        });
        setError("Error connecting to the authentication server.");
      }
    } catch (err) {
      txLogger.error("auth", "login_error", {
        error: err,
        context: { user_id: username },
      });
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptchaSubmit = (e) => {
    e.preventDefault();
    if (userCaptchaInput.toUpperCase() === captchaValue) {
      // Captcha passed -> reset everything and show login form
      setShowCaptcha(false);
      setFailedAttempts(0);
      setUserCaptchaInput("");
      setError("");
      setPassword(""); // Clear password for security
    } else {
      setError("Incorrect CAPTCHA. Please try again.");
      setCaptchaValue(generateCaptcha()); // Regenerate on failure
      setUserCaptchaInput("");
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
            {showCaptcha ? "Security Verification Required" : "Sign in to access your dashboard"}
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {showCaptcha ? (
          // --- CAPTCHA FORM ---
          <form onSubmit={handleCaptchaSubmit} className="space-y-5 animate-fade-in">
            <div className="flex flex-col items-center bg-[var(--background)] border border-[var(--border-color)] p-6 rounded-xl">
              <span className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest font-bold mb-2">Type this code</span>
              <div className="text-3xl font-black tracking-[0.3em] text-[var(--primary)] select-none bg-[var(--card-bg)] px-6 py-3 rounded-lg border border-[var(--primary)]/20 line-through decoration-[var(--foreground-muted)] decoration-2">
                {captchaValue}
              </div>
            </div>
            
            <div>
              <input
                type="text"
                value={userCaptchaInput}
                onChange={(e) => setUserCaptchaInput(e.target.value.toUpperCase())}
                className="w-full text-center tracking-[0.2em] font-bold bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all"
                placeholder="ENTER CAPTCHA"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[var(--primary)] text-white font-bold py-3.5 rounded-xl shadow-[0_4px_15px_var(--lead-glow)] hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Verify & Return to Login
            </button>
          </form>
        ) : (
          // --- STANDARD LOGIN FORM ---
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
        )}

        <div className="mt-8 pt-6 border-t border-[var(--border-color)] text-center">
          <p className="text-xs text-[var(--foreground-muted)] font-medium">
            Authorized personnel only?{" "}
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