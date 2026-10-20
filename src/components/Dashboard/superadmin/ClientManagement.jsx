// src/components/Dashboard/superadmin/ClientManagement.jsx
"use client";

import React, { useState, useEffect } from "react";
import { ref, get, set, update } from "firebase/database";
import { db } from "../../../lib/firebase";

// 🔥 TICKET 14
import { createPulseLogger } from "../../../lib/loggerPresets";
import { recordAuditTrail } from "../../../lib/auditTracer";
const pulseLogger = createPulseLogger("ClientManagement");

export default function ClientManagement() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // --- MODAL STATES ---
  const [viewingProfile, setViewingProfile] = useState(null);
  const [managingUsers, setManagingUsers] = useState(null);

  // --- PIN VERIFICATION STATES ---
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    action: null,
    error: "",
  });
  const [pinInput, setPinInput] = useState("");

  // --- PROFILE EDIT STATES ---
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfileData, setEditedProfileData] = useState({});

  // --- USER EDIT STATES ---
  const [editingUser, setEditingUser] = useState(null); // { clientIndex, userIndex, name, password }
  const [newPassword, setNewPassword] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", password: "" });
  const [revealedPasswords, setRevealedPasswords] = useState(new Set()); 

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const settingsRef = ref(db, "settings/business_profile");
        const settingsSnap = await get(settingsRef);

        const loginRef = ref(db, "login");
        const loginSnap = await get(loginRef);

        let profileData = {};
        if (settingsSnap.exists()) {
          const rawProfile = settingsSnap.val();
          profileData = {
            ...rawProfile.basic_info,
            timezone: rawProfile.timezone,
            updated_at: rawProfile.updated_at,
          };
        }

        let usersData = [];
        if (loginSnap.exists()) {
          usersData = loginSnap.val().filter((u) => u !== null);
        }

        const loadedClients = [
          {
            id: "primary_client",
            profile: profileData,
            users: usersData,
          },
        ];

        setClients(loadedClients);
      } catch (error) {
        console.error("Error fetching client data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientData();
  }, []);

  const requestPinAuth = (actionPayload) => {
    setPinModal({ isOpen: true, action: actionPayload, error: "" });
    setPinInput("");
  };

  const verifyPin = async (pinToVerify) => {
    setActionLoading(true);
    try {
      const adminRef = ref(db, "superAdmin");
      const snap = await get(adminRef);
      if (snap.exists()) {
        const admins = snap.val();
        const currentAdminName = localStorage.getItem("currentSuperAdmin");
        const admin = admins.find((a) => a && a.name === currentAdminName);

        if (admin && admin.pin === pinToVerify) {
          executeSecuredAction(pinModal.action);
          setPinModal({ isOpen: false, action: null, error: "" });
          setPinInput(""); 
        } else {
          setPinModal((prev) => ({
            ...prev,
            error: "Invalid PIN. Access denied.",
          }));
          setPinInput(""); 
        }
      }
    } catch (error) {
      console.error("PIN check error:", error);
      setPinModal((prev) => ({
        ...prev,
        error: "Network error checking PIN.",
      }));
      setPinInput("");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPinInput(val);

    if (val.length === 4) {
      verifyPin(val);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.length === 4) {
      verifyPin(pinInput);
    }
  };

  const executeSecuredAction = (action) => {
    switch (action.type) {
      case "REVEAL_PASSWORD":
        setRevealedPasswords((prev) => {
          const newSet = new Set(prev);
          newSet.add(action.userIndex);
          return newSet;
        });
        break;
      case "EDIT_PASSWORD":
        setEditingUser(action.payload);
        break;
      case "EDIT_PROFILE":
        setIsEditingProfile(true);
        setEditedProfileData({ ...viewingProfile.profile });
        break;
      default:
        break;
    }
  };

  const saveUsersToFirebase = async (updatedUsersArray) => {
    try {
      setActionLoading(true);
      const firebaseFormattedArray = [null, ...updatedUsersArray];
      await set(ref(db, "login"), firebaseFormattedArray);
    } catch (error) {
      console.error("Error saving users:", error);
      alert("Failed to save changes to the database.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword.trim()) return;
    const updatedClients = [...clients];
    const targetUsers = updatedClients[editingUser.clientIndex].users;
    targetUsers[editingUser.userIndex].password = newPassword;
    await saveUsersToFirebase(targetUsers);
    
    // 🚨 TICKET 14: Log User Role / Password Changes
    recordAuditTrail(pulseLogger, "user_role_changed", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `client_${editingUser.clientIndex}_user_${editingUser.userIndex}`,
      status: "success",
      reason: "Password updated"
    });

    setClients(updatedClients);
    setEditingUser(null);
    setNewPassword("");
  };

  const handleAddUser = async (clientIndex) => {
    if (!newUser.name.trim() || !newUser.password.trim()) return;
    const updatedClients = [...clients];
    const targetUsers = updatedClients[clientIndex].users;
    targetUsers.push(newUser);
    await saveUsersToFirebase(targetUsers);

    // 🚨 TICKET 14: Log Client Updated (User Addition)
    recordAuditTrail(pulseLogger, "client_updated", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `client_${clientIndex}`,
      newState: newUser,
      status: "success",
      reason: "New user allocated"
    });

    setClients(updatedClients);
    setNewUser({ name: "", password: "" });
    setIsAddingUser(false);
  };

  const handleDeleteUser = async (clientIndex, userIndex) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const updatedClients = [...clients];
    const targetUsers = updatedClients[clientIndex].users;
    
    // 🚨 TICKET 14: Store what is being deleted first so it can be logged!
    const userBeingDeleted = targetUsers[userIndex];
    
    targetUsers.splice(userIndex, 1);
    await saveUsersToFirebase(targetUsers);

    // 🚨 TICKET 14: Log Data Deletion
    recordAuditTrail(pulseLogger, "data_deleted", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `client_${clientIndex}_user_${userIndex}`,
      previousState: userBeingDeleted,
      status: "success"
    });

    setClients(updatedClients);
  };

  const handleSaveProfile = async () => {
    setActionLoading(true);
    try {
      const updates = {
        "settings/business_profile/basic_info/address": editedProfileData.address,
        "settings/business_profile/basic_info/avgJobValue": editedProfileData.avgJobValue,
        "settings/business_profile/basic_info/businessName": editedProfileData.businessName,
        "settings/business_profile/basic_info/email": editedProfileData.email,
        "settings/business_profile/basic_info/industry": editedProfileData.industry,
        "settings/business_profile/basic_info/phone": editedProfileData.phone,
        "settings/business_profile/basic_info/website": editedProfileData.website,
        "settings/business_profile/timezone": editedProfileData.timezone,
        "settings/business_profile/updated_at": new Date().toISOString(),
      };

      await update(ref(db), updates);

      // 🚨 TICKET 14: Log configuration/profile changes
      recordAuditTrail(pulseLogger, "configuration_changed", {
        who: localStorage.getItem("currentSuperAdmin") || "superadmin",
        target: "settings/business_profile",
        previousState: clients[0].profile,
        newState: editedProfileData
      });

      const updatedClients = [...clients];
      updatedClients[0].profile = {
        ...editedProfileData,
        updated_at: updates["settings/business_profile/updated_at"],
      };

      setClients(updatedClients);
      setViewingProfile(updatedClients[0]);
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile changes.");
    } finally {
      setActionLoading(false);
    }
  };

  const closeProfileModal = () => {
    setViewingProfile(null);
    setIsEditingProfile(false);
  };

  const closeUsersModal = () => {
    setManagingUsers(null);
    setEditingUser(null);
    setIsAddingUser(false);
    setRevealedPasswords(new Set()); 
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
        <svg
          className="w-10 h-10 animate-spin text-[var(--primary)] mb-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M21 12a9 9 0 1 1-6.219-8.56"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-[var(--foreground-muted)] font-bold">
          Syncing with database...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-[var(--foreground)]">
            Client Directory
          </h2>
          <p className="text-[var(--foreground-muted)] font-medium text-sm mt-1">
            Manage tenant profiles, user allocations, and authentication
            credentials.
          </p>
        </div>
        <button className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-xl shadow-[0_4px_15px_var(--lead-glow)] hover:opacity-90 transition-all flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add New Client
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {clients.map((client, cIdx) => (
          <div
            key={client.id}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm hover:shadow-[0_4px_20px_var(--lead-glow)] transition-all flex flex-col"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-black text-xl border border-[var(--primary)]/20">
                  {client.profile.businessName
                    ? client.profile.businessName.charAt(0)
                    : "A"}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    {client.profile.businessName || "Unnamed Business"}
                  </h3>
                  <div className="flex items-center gap-2 text-[var(--foreground-muted)] text-xs font-medium mt-1">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3 text-[var(--logo-mongo-green)]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                      Active
                    </span>
                    <span>•</span>
                    <span>{client.profile.industry || "N/A"}</span>
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--foreground)]">
                {client.users.length} Users
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider">
                  Email
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {client.profile.email || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider">
                  Phone
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {client.profile.phone || "—"}
                </p>
              </div>
            </div>

            <div className="mt-auto flex gap-3">
              <button
                onClick={() => setViewingProfile(client)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--foreground)] text-sm font-bold hover:bg-[var(--background)] hover:border-[var(--primary)] transition-all"
              >
                View Profile
              </button>
              <button
                onClick={() => setManagingUsers({ client, cIdx })}
                className="flex-1 py-2.5 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-sm font-bold hover:bg-[var(--primary)] hover:text-white transition-all"
              >
                Manage Users
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewingProfile && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeProfileModal}
          ></div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-2xl w-full relative z-50 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0 border-b border-[var(--border-color)] pb-4">
              <div>
                <h3 className="text-xl font-black text-[var(--foreground)]">
                  Business Profile
                </h3>
                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                  Tenant core configuration
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isEditingProfile && (
                  <button
                    onClick={() => requestPinAuth({ type: "EDIT_PROFILE" })}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold rounded-lg border border-[var(--primary)]/20 hover:bg-[var(--primary)] hover:text-white transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Edit Profile
                  </button>
                )}
                <button
                  onClick={closeProfileModal}
                  className="text-[var(--foreground-muted)] hover:text-[var(--logo-politico-red)] transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {isEditingProfile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(editedProfileData).map((key) => {
                  if (key === "updated_at") return null;
                  return (
                    <div key={key} className="flex flex-col">
                      <label className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider mb-1">
                        {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                      </label>
                      <input
                        type="text"
                        value={editedProfileData[key] || ""}
                        onChange={(e) =>
                          setEditedProfileData({
                            ...editedProfileData,
                            [key]: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                  );
                })}
                <div className="col-span-1 md:col-span-2 flex gap-3 mt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={actionLoading}
                    className="flex-1 bg-[var(--primary)] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    disabled={actionLoading}
                    className="px-6 bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] font-bold py-3 rounded-xl hover:text-[var(--logo-politico-red)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                {Object.entries(viewingProfile.profile).map(([key, value]) => {
                  if (typeof value === "object") return null;
                  return (
                    <div
                      key={key}
                      className="flex flex-col border-b border-[var(--border-color)] pb-3"
                    >
                      <span className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider mb-1">
                        {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)] break-all">
                        {value || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {managingUsers && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeUsersModal}
          ></div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-2xl w-full relative z-50 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0 border-b border-[var(--border-color)] pb-4">
              <div>
                <h3 className="text-xl font-black text-[var(--foreground)]">
                  User Management
                </h3>
                <p className="text-[var(--foreground-muted)] text-xs font-medium mt-1">
                  Tenant: {managingUsers.client.profile.businessName}
                </p>
              </div>
              <button
                disabled={actionLoading}
                onClick={closeUsersModal}
                className="p-2 rounded-lg bg-[var(--background)] text-[var(--foreground-muted)] hover:text-[var(--logo-politico-red)] transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {managingUsers.client.users.map((user, uIdx) => (
                <div
                  key={uIdx}
                  className="flex items-center justify-between p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-2xl"
                >
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider">
                      Username
                    </p>
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {user.name}
                    </p>
                  </div>

                  {editingUser?.userIndex === uIdx ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        className="bg-[var(--card-bg)] border border-[var(--primary)] text-[var(--foreground)] text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 w-32 sm:w-40"
                        autoFocus
                      />
                      <button
                        disabled={actionLoading}
                        onClick={handleSavePassword}
                        className="p-1.5 bg-[var(--logo-mongo-green)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => setEditingUser(null)}
                        className="p-1.5 bg-[var(--background)] text-[var(--foreground-muted)] hover:text-[var(--logo-politico-red)] rounded-lg border border-[var(--border-color)] disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--foreground-muted)] min-w-[80px] text-center">
                        {revealedPasswords.has(uIdx) ? (
                          <span className="text-[var(--foreground)] font-bold">
                            {user.password}
                          </span>
                        ) : (
                          "••••••••"
                        )}
                      </div>

                      <button
                        disabled={actionLoading}
                        onClick={() => {
                          if (revealedPasswords.has(uIdx)) {
                            setRevealedPasswords((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(uIdx);
                              return newSet;
                            });
                          } else {
                            requestPinAuth({
                              type: "REVEAL_PASSWORD",
                              userIndex: uIdx,
                            });
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-colors border ${revealedPasswords.has(uIdx) ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20" : "bg-[var(--card-bg)] text-[var(--foreground-muted)] border-[var(--border-color)] hover:text-[var(--foreground)]"}`}
                        title={
                          revealedPasswords.has(uIdx)
                            ? "Hide Password"
                            : "View Password (Requires PIN)"
                        }
                      >
                        {revealedPasswords.has(uIdx) ? (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>

                      <button
                        disabled={actionLoading}
                        onClick={() =>
                          requestPinAuth({
                            type: "EDIT_PASSWORD",
                            payload: {
                              clientIndex: managingUsers.cIdx,
                              userIndex: uIdx,
                              ...user,
                            },
                          })
                        }
                        className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--accent-blue)] bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent-blue)]/50 rounded-lg transition-colors disabled:opacity-50"
                        title="Edit Password (Requires PIN)"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </button>

                      <button
                        disabled={actionLoading}
                        onClick={() =>
                          handleDeleteUser(managingUsers.cIdx, uIdx)
                        }
                        className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--logo-politico-red)] bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--logo-politico-red)]/50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete User"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {isAddingUser ? (
                <div className="p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl flex flex-col sm:flex-row items-end gap-3 mt-4">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider mb-1 block">
                      Username
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                      className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--primary)]"
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[10px] uppercase font-bold text-[var(--foreground-muted)] tracking-wider mb-1 block">
                      Password
                    </label>
                    <input
                      type="text"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--primary)]"
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="flex gap-2 pb-0.5 w-full sm:w-auto mt-2 sm:mt-0">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleAddUser(managingUsers.cIdx)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => setIsAddingUser(false)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground-muted)] text-sm font-bold rounded-xl hover:text-[var(--logo-politico-red)] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingUser(true)}
                  className="w-full py-4 mt-4 border-2 border-dashed border-[var(--border-color)] rounded-2xl text-[var(--foreground-muted)] font-bold text-sm hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Allocate New User
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {pinModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() =>
              setPinModal({ isOpen: false, action: null, error: "" })
            }
          ></div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full relative z-[70] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--logo-politico-red)]/10 text-[var(--logo-politico-red)] flex items-center justify-center mb-4 border border-[var(--logo-politico-red)]/20">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-black text-[var(--foreground)]">
                Security Authorization
              </h3>
              <p className="text-[var(--foreground-muted)] text-xs mt-2 mb-6">
                Please enter your Super Admin PIN to authorize this sensitive
                action.
              </p>

              <form onSubmit={handlePinSubmit} className="w-full">
                <input
                  type="password"
                  autoFocus
                  maxLength={4}
                  value={pinInput}
                  onChange={handlePinChange}
                  placeholder="••••"
                  className="w-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] text-center text-2xl tracking-[0.5em] font-mono px-4 py-3 rounded-xl focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all mb-2"
                />

                {pinModal.error && (
                  <p className="text-[var(--logo-politico-red)] text-xs font-bold mb-4">
                    {pinModal.error}
                  </p>
                )}

                {actionLoading && (
                  <p className="text-[var(--primary)] text-xs font-bold mb-4 animate-pulse">
                    Verifying...
                  </p>
                )}

                <div className="flex mt-6">
                  <button
                    type="button"
                    onClick={() =>
                      setPinModal({ isOpen: false, action: null, error: "" })
                    }
                    className="w-full bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] font-bold py-3 rounded-xl hover:text-[var(--logo-politico-red)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--foreground-muted); }
      `,
        }}
      />
    </div>
  );
}