"use client";

import { useState, useEffect } from "react";
// IMPORTANT: Import Realtime Database methods
import { db } from "../../../lib/firebase";
import { ref, get, update } from "firebase/database";

export default function PasswordChange({ onNavigate }) {
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [currentUser, setCurrentUser] = useState(null);

  // Retrieve the logged-in user's name when the component mounts
  useEffect(() => {
    // Make sure this matches exactly how your LoginScreen saves the user state
    const savedUser = localStorage.getItem("loggedInUser");
    if (savedUser) {
      setCurrentUser(savedUser);
    } else {
      // Fallback for testing if localStorage isn't set
      setCurrentUser("admin");
    }
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3500,
    );
  };

  const handleInputChange = (e) => {
    setPasswords((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    // 1. Basic Frontend Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      showToast("Please fill in all fields.", "error");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      showToast("New passwords do not match.", "error");
      return;
    }
    if (passwords.new.length < 4) {
      showToast("Password must be at least 4 characters.", "error");
      return;
    }

    setIsSaving(true);

    try {
      // 2. Fetch the 'login' array from Firebase
      const loginRef = ref(db, "login");
      const snapshot = await get(loginRef);

      if (!snapshot.exists()) {
        showToast("Database error: Login records not found.", "error");
        setIsSaving(false);
        return;
      }

      const usersArray = snapshot.val();
      let targetIndex = -1;
      let targetUserData = null;

      // 3. Find the specific user in the array
      for (let i = 0; i < usersArray.length; i++) {
        if (usersArray[i] && usersArray[i].name === currentUser) {
          targetIndex = i;
          targetUserData = usersArray[i];
          break;
        }
      }

      if (targetIndex === -1) {
        showToast(`User '${currentUser}' not found in database.`, "error");
        setIsSaving(false);
        return;
      }

      // 4. Verify the current password matches what is in the database
      if (targetUserData.password !== passwords.current) {
        showToast("Your current password is incorrect.", "error");
        setIsSaving(false);
        return;
      }

      // 5. Update the specific user's password at their exact array index
      const specificUserRef = ref(db, `login/${targetIndex}`);
      await update(specificUserRef, {
        password: passwords.new,
      });

      // 6. Success Feedback & Reset
      showToast("Password updated successfully!", "success");
      setPasswords({ current: "", new: "", confirm: "" });

      // Auto redirect back to profile after success
      setTimeout(() => {
        if (onNavigate) onNavigate("business_profile");
      }, 1500);
    } catch (error) {
      console.error("Password update error:", error);
      showToast(
        "Failed to update password. Check console for details.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative z-10 flex-grow w-full max-w-[800px] mx-auto px-6 sm:px-12 py-8 fade-in flex flex-col min-h-[calc(100vh-100px)]">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 shrink-0">
        <div>
          <button
            onClick={() => onNavigate && onNavigate("business_profile")}
            className="flex items-center gap-2 text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--primary)] uppercase tracking-widest mb-4 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Profile
          </button>
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
            Change Password
          </h1>
          <p className="text-[var(--foreground-muted)] text-sm mt-1">
            Update credentials for user:{" "}
            <span className="font-bold text-[var(--primary)]">
              {currentUser}
            </span>
          </p>
        </div>
      </div>

      {/* ================= SECURITY FORM ================= */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--foreground-muted)] uppercase tracking-widest">
              Current Password
            </label>
            <input
              type="password"
              name="current"
              value={passwords.current}
              onChange={handleInputChange}
              placeholder="Enter current password"
              className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>

          <div className="h-px w-full bg-[var(--border-color)] my-6"></div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--foreground-muted)] uppercase tracking-widest">
              New Password
            </label>
            <input
              type="password"
              name="new"
              value={passwords.new}
              onChange={handleInputChange}
              placeholder="Enter new password"
              className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--foreground-muted)] uppercase tracking-widest">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirm"
              value={passwords.confirm}
              onChange={handleInputChange}
              placeholder="Re-enter new password"
              className="w-full bg-[var(--background)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-6 py-3.5 w-full sm:w-auto bg-[var(--primary)] hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-[0_0_15px_var(--lead-glow)] transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              )}
              Update Database Password
            </button>
          </div>
        </form>
      </div>

      {/* Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 ease-out ${toast.show ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}`}
      >
        <div className="app-toast border shadow-[0_10px_40px_rgba(0,0,0,0.3)] rounded-2xl p-4 pr-10 flex items-center gap-3 backdrop-blur-xl relative overflow-hidden">
          <div
            className={`w-1.5 h-full absolute left-0 top-0 ${toast.type === "error" ? "bg-red-500" : "bg-green-500"}`}
          ></div>
          <div>
            <p className="text-[10px] font-bold app-toast-label uppercase tracking-widest mb-0.5">
              Security Notice
            </p>
            <p className="text-sm font-semibold">
              {toast.message}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
