// src/components/Dashboard/superadmin/ClientManagement.jsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ref, get, set, update, remove, onValue } from "firebase/database";
import { db } from "../../../lib/firebase";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Lock,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Check,
  Loader2,
  RefreshCw,
  Power,
  Shield,
  Layers,
  Phone,
  Sparkles,
} from "lucide-react";

// Predefined Industry Packs supported by CloseDesk
const INDUSTRY_PACKS = [
  { id: "saas", name: "SaaS & AI Systems", badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: "hvac", name: "HVAC & Home Services", badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: "plumbing", name: "Plumbing & Mechanical", badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  { id: "dental", name: "Dental & Healthcare", badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { id: "legal", name: "Legal & Professional", badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { id: "custom", name: "Custom / General", badgeColor: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
];

export default function ClientManagement() {
  // --- REAL-TIME TENANTS STATE ---
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState("all");

  // --- MODAL STATES ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // --- FORM STATES ---
  const [createForm, setCreateForm] = useState({
    tenant_id: "",
    business_name: "",
    industry_pack: "saas",
    phone: "",
    enabled: true,
  });

  const [editForm, setEditForm] = useState({
    tenant_id: "",
    business_name: "",
    industry_pack: "saas",
    phone: "",
    enabled: true,
  });

  const [tenantToDelete, setTenantToDelete] = useState(null);

  // --- SECURITY PIN AUTHORIZATION MODAL ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  /**
   * Pending Action Descriptor:
   * {
   *   type: 'CREATE' | 'EDIT' | 'DELETE' | 'TOGGLE_STATUS',
   *   title: string,
   *   description: string,
   *   payload: object
   * }
   */
  const [pendingAction, setPendingAction] = useState(null);

  // --- TOAST NOTIFICATIONS ---
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // =========================================================================
  // 1. REAL-TIME LISTENER (VIEW)
  // =========================================================================
  useEffect(() => {
    const tenantsRef = ref(db, "tenants");

    const unsubscribe = onValue(
      tenantsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rawData = snapshot.val();
          const parsedTenants = Object.entries(rawData).map(([id, t]) => {
            const clientConfig = t?.client_config || {};
            const secrets = t?.secrets || {};

            return {
              tenant_id: id,
              business_name: clientConfig.business_name || t?.name || id,
              industry_pack:
                clientConfig.industry_pack ||
                clientConfig.industry_pack_id ||
                t?.industry_pack_id ||
                t?.industry_pack ||
                "saas",
              enabled:
                t?.enabled !== undefined
                  ? Boolean(t.enabled)
                  : clientConfig.enabled !== undefined
                  ? Boolean(clientConfig.enabled)
                  : true,
              phone: clientConfig.phone || t?.phone || null,
              created_at: t?.created_at || null,
              updated_at: t?.updated_at || null,
              client_config: clientConfig,
              secrets: secrets,
            };
          });

          // Sort alphabetically by business name
          parsedTenants.sort((a, b) =>
            a.business_name.localeCompare(b.business_name)
          );
          setTenants(parsedTenants);
        } else {
          setTenants([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("[ClientManagement] Error listening to /tenants:", error);
        showToast("Failed to connect to Firebase Realtime Database.", "error");
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Filtered tenants calculation
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tenant.tenant_id.toLowerCase().includes(query) ||
        tenant.business_name.toLowerCase().includes(query) ||
        tenant.industry_pack.toLowerCase().includes(query);

      const matchesIndustry =
        selectedIndustryFilter === "all" ||
        tenant.industry_pack === selectedIndustryFilter;

      return matchesSearch && matchesIndustry;
    });
  }, [tenants, searchQuery, selectedIndustryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.enabled).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [tenants]);

  // =========================================================================
  // 2. SECURITY PIN AUTHORIZATION & MUTATION DISPATCH
  // =========================================================================
  /**
   * Prompts the Superadmin to authorize a pending action via PIN.
   */
  const requestPinAuthorization = (action) => {
    setPendingAction(action);
    setPinInput("");
    setPinError("");
    setIsPinModalOpen(true);
  };

  /**
   * Verifies the entered PIN against `/superadmins/action_pin` in Firebase RTDB.
   */
  const handleVerifyAndExecutePin = async () => {
    if (!pinInput || pinInput.length !== 4) {
      setPinError("Please enter a 4-digit PIN.");
      return;
    }

    if (!pendingAction) {
      setIsPinModalOpen(false);
      return;
    }

    setIsVerifyingPin(true);
    setPinError("");

    try {
      // 1. Fetch Authoritative Superadmin PIN from Firebase at /superadmins/action_pin
      const pinRef = ref(db, "superadmins/action_pin");
      const pinSnap = await get(pinRef);

      let authoritativePin = null;

      if (pinSnap.exists()) {
        authoritativePin = String(pinSnap.val()).trim();
      } else {
        // Fallback: Check legacy /superAdmin array if action_pin is not yet populated
        const legacyAdminRef = ref(db, "superAdmin");
        const legacySnap = await get(legacyAdminRef);
        if (legacySnap.exists()) {
          const admins = legacySnap.val();
          const found = Array.isArray(admins)
            ? admins.find((a) => a && a.pin)
            : null;
          if (found && found.pin) authoritativePin = String(found.pin).trim();
        }

        // Final developer fallback if database has no PIN configured yet
        if (!authoritativePin) {
          authoritativePin = "1234";
          // Seed the canonical node for future executions
          try {
            await set(ref(db, "superadmins/action_pin"), "1234");
          } catch (_) {}
        }
      }

      // 2. Validate PIN Match
      if (pinInput.trim() !== authoritativePin) {
        setPinError("Invalid security PIN. Access denied.");
        setPinInput("");
        setIsVerifyingPin(false);
        return;
      }

      // 3. PIN Verified! Execute the staged mutation
      await executePendingMutation(pendingAction);

      // Clean up modal state on success
      setIsPinModalOpen(false);
      setPendingAction(null);
      setPinInput("");
      setIsVerifyingPin(false);
    } catch (error) {
      console.error("[ClientManagement] PIN verification or mutation failed:", error);
      setPinError(`Execution error: ${error.message || "Failed to execute action"}`);
      setIsVerifyingPin(false);
    }
  };

  /**
   * Performs the actual Firebase RTDB write (set, update, remove)
   * strictly after successful PIN validation.
   */
  const executePendingMutation = async (action) => {
    const now = Date.now();

    switch (action.type) {
      // ---------------------------------------------------------------------
      // CREATE TENANT
      // ---------------------------------------------------------------------
      case "CREATE": {
        const { tenant_id, business_name, industry_pack, phone, enabled } =
          action.payload;

        const newTenantRecord = {
          tenant_id,
          name: business_name.trim(),
          industry_pack_id: industry_pack,
          industry_pack: industry_pack,
          enabled: Boolean(enabled),
          created_at: now,
          updated_at: now,

          // Full client_config schema
          client_config: {
            business_name: business_name.trim(),
            industry_pack: industry_pack,
            enabled: Boolean(enabled),
            phone: phone?.trim() || null,
            email: null,
            timezone: "America/New_York",
            services_offered: [
              industry_pack === "saas"
                ? "AI Automation & SaaS Systems"
                : industry_pack === "hvac"
                ? "Heating, AC, Furnace & Heat Pumps"
                : "General Professional Services",
            ],
            pricing: {
              currency: "USD",
              diagnostic_fee: industryPackDefaultFee(industry_pack),
              waive_diagnostic_with_repair: industry_pack === "hvac",
            },
            ai_persona: {
              bot_name: `${business_name.trim()} Front Desk`,
              bot_avatar: "ai_spark",
              bot_voice: "alloy",
              voice_enabled: true,
              tone: "Professional, friendly, and helpful",
            },
            emergency_rules: {
              supports_24_7_dispatch:
                industry_pack === "hvac" || industry_pack === "plumbing",
              dispatch_phone: phone?.trim() || null,
            },
            actions: {
              create_service_request: true,
              create_booking: true,
              escalate_to_human: true,
            },
          },

          // Isolated Secrets container (never exposed to public client bootstrap)
          secrets: {
            created_by: "superadmin",
            created_at: new Date(now).toISOString(),
            notes: "Provisioned via Superadmin Client Management",
          },
        };

        await set(ref(db, `tenants/${tenant_id}`), newTenantRecord);
        setIsCreateModalOpen(false);
        resetCreateForm();
        showToast(`Tenant '${business_name}' created successfully!`, "success");
        break;
      }

      // ---------------------------------------------------------------------
      // EDIT TENANT
      // ---------------------------------------------------------------------
      case "EDIT": {
        const { tenant_id, business_name, industry_pack, phone, enabled } =
          action.payload;

        const updates = {
          name: business_name.trim(),
          industry_pack_id: industry_pack,
          industry_pack: industry_pack,
          enabled: Boolean(enabled),
          updated_at: now,
          "client_config/business_name": business_name.trim(),
          "client_config/industry_pack": industry_pack,
          "client_config/enabled": Boolean(enabled),
          "client_config/phone": phone?.trim() || null,
          "client_config/updated_at": new Date(now).toISOString(),
        };

        await update(ref(db, `tenants/${tenant_id}`), updates);
        setIsEditModalOpen(false);
        showToast(`Tenant '${business_name}' updated successfully!`, "success");
        break;
      }

      // ---------------------------------------------------------------------
      // TOGGLE ENABLED STATUS
      // ---------------------------------------------------------------------
      case "TOGGLE_STATUS": {
        const { tenant_id, new_status, business_name } = action.payload;

        const updates = {
          enabled: Boolean(new_status),
          updated_at: now,
          "client_config/enabled": Boolean(new_status),
        };

        await update(ref(db, `tenants/${tenant_id}`), updates);
        showToast(
          `Tenant '${business_name}' is now ${
            new_status ? "ACTIVE" : "DISABLED"
          }.`,
          "info"
        );
        break;
      }

      // ---------------------------------------------------------------------
      // DELETE TENANT
      // ---------------------------------------------------------------------
      case "DELETE": {
        const { tenant_id, business_name } = action.payload;

        await remove(ref(db, `tenants/${tenant_id}`));
        setIsDeleteModalOpen(false);
        setTenantToDelete(null);
        showToast(
          `Tenant '${business_name}' (${tenant_id}) permanently deleted.`,
          "success"
        );
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  };

  // Helper for pricing defaults
  const industryPackDefaultFee = (pack) => {
    if (pack === "hvac") return 99;
    if (pack === "plumbing") return 85;
    if (pack === "dental") return 50;
    return null;
  };

  const resetCreateForm = () => {
    setCreateForm({
      tenant_id: "",
      business_name: "",
      industry_pack: "saas",
      phone: "",
      enabled: true,
    });
  };

  // =========================================================================
  // 3. FORM SUBMISSION HANDLERS (STAGE ACTIONS FOR PIN)
  // =========================================================================
  const handleOpenCreateModal = () => {
    resetCreateForm();
    setIsCreateModalOpen(true);
  };

  const handleSubmitCreate = (e) => {
    e.preventDefault();

    // Sanitize tenant ID (lowercase, alphanumeric + underscore/dash)
    const sanitizedId = createForm.tenant_id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");

    if (!sanitizedId) {
      alert("Please provide a valid Tenant ID.");
      return;
    }

    if (!createForm.business_name.trim()) {
      alert("Please provide a Business Name.");
      return;
    }

    // Check if ID already exists
    if (tenants.some((t) => t.tenant_id === sanitizedId)) {
      alert(`Tenant ID '${sanitizedId}' already exists. Please choose a unique identifier.`);
      return;
    }

    // Request PIN authorization
    requestPinAuthorization({
      type: "CREATE",
      title: "Authorize Tenant Creation",
      description: `Create new tenant '${createForm.business_name}' with ID '${sanitizedId}'.`,
      payload: {
        ...createForm,
        tenant_id: sanitizedId,
      },
    });
  };

  const handleOpenEditModal = (tenant) => {
    setEditForm({
      tenant_id: tenant.tenant_id,
      business_name: tenant.business_name,
      industry_pack: tenant.industry_pack || "saas",
      phone: tenant.phone || "",
      enabled: tenant.enabled,
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitEdit = (e) => {
    e.preventDefault();

    if (!editForm.business_name.trim()) {
      alert("Please provide a Business Name.");
      return;
    }

    // Request PIN authorization
    requestPinAuthorization({
      type: "EDIT",
      title: "Authorize Tenant Modification",
      description: `Update configuration for tenant '${editForm.business_name}' (${editForm.tenant_id}).`,
      payload: { ...editForm },
    });
  };

  const handleToggleStatus = (tenant) => {
    const nextStatus = !tenant.enabled;
    requestPinAuthorization({
      type: "TOGGLE_STATUS",
      title: `Authorize Status: ${nextStatus ? "ENABLE" : "DISABLE"}`,
      description: `${
        nextStatus ? "Re-activate" : "Disable"
      } AI conversational services for tenant '${tenant.business_name}' (${tenant.tenant_id}).`,
      payload: {
        tenant_id: tenant.tenant_id,
        business_name: tenant.business_name,
        new_status: nextStatus,
      },
    });
  };

  const handleOpenDeleteModal = (tenant) => {
    setTenantToDelete(tenant);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!tenantToDelete) return;

    requestPinAuthorization({
      type: "DELETE",
      title: "CRITICAL: Authorize Tenant Deletion",
      description: `Permanently delete tenant '${tenantToDelete.business_name}' (${tenantToDelete.tenant_id}) and remove all its configuration. This action cannot be undone.`,
      payload: {
        tenant_id: tenantToDelete.tenant_id,
        business_name: tenantToDelete.business_name,
      },
    });
  };

  // =========================================================================
  // PIN MODAL KEYBOARD & SUBMIT
  // =========================================================================
  const handlePinKeyPress = (e) => {
    if (e.key === "Enter" && pinInput.length === 4) {
      handleVerifyAndExecutePin();
    }
  };

  const handlePinChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPinInput(digits);
    setPinError("");
  };

  // Helper for industry pack badge styling
  const getPackBadge = (packId) => {
    const found = INDUSTRY_PACKS.find((p) => p.id === packId);
    if (!found) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-300 border border-zinc-500/20 capitalize">
          {packId || "Custom"}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${found.badgeColor}`}
      >
        {found.name}
      </span>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 sm:p-8 max-w-7xl mx-auto text-[var(--foreground)]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/30"
              : toast.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-500/30"
              : "bg-blue-950/90 text-blue-200 border-blue-500/30"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          {toast.type === "info" && <Shield className="w-5 h-5 text-blue-400 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-current/60 hover:text-current transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
                Tenant Management
              </h1>
              <p className="text-xs sm:text-sm text-[var(--foreground-muted)]">
                Manage CloseDesk multi-tenant client instances, industry policies, and real-time operational status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tenant</span>
          </button>
        </div>
      </div>

      {/* STATS CHIPS & SEARCH BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Total Tenants
            </p>
            <p className="text-2xl font-black mt-1 text-[var(--foreground)]">
              {stats.total}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Active Tenants */}
        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Active Tenants
            </p>
            <p className="text-2xl font-black mt-1 text-emerald-400">
              {stats.active}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Disabled Tenants */}
        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Disabled
            </p>
            <p className="text-2xl font-black mt-1 text-rose-400">
              {stats.disabled}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Superadmin Security PIN Status */}
        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Security Gate
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <p className="text-sm font-bold text-[var(--foreground)]">4-Digit PIN Active</p>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <input
            type="text"
            placeholder="Search by ID, name, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-[var(--foreground-muted)] whitespace-nowrap">
            Industry Pack:
          </label>
          <select
            value={selectedIndustryFilter}
            onChange={(e) => setSelectedIndustryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Industries</option>
            {INDUSTRY_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TENANTS TABLE */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--foreground)]">
            <thead className="text-xs uppercase bg-[var(--background)] border-b border-[var(--border-color)] text-[var(--foreground-muted)] font-bold">
              <tr>
                <th scope="col" className="px-6 py-4">Tenant ID</th>
                <th scope="col" className="px-6 py-4">Business Name</th>
                <th scope="col" className="px-6 py-4">Industry Pack</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--foreground-muted)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="text-sm font-medium">Listening to Realtime Database (/tenants)...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--foreground-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="w-10 h-10 text-[var(--foreground-muted)]/40" />
                      <p className="text-base font-semibold text-[var(--foreground)]">No tenants found</p>
                      <p className="text-xs text-[var(--foreground-muted)] max-w-sm">
                        {searchQuery
                          ? "No tenants matched your search criteria."
                          : "No multi-tenant accounts exist yet. Click 'Create Tenant' to provision one."}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create First Tenant</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr
                    key={tenant.tenant_id}
                    className="hover:bg-[var(--background)]/50 transition-colors group"
                  >
                    {/* Tenant ID */}
                    <td className="px-6 py-4 font-mono text-xs font-medium text-indigo-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                          {tenant.tenant_id}
                        </span>
                      </div>
                    </td>

                    {/* Business Name & Contact */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--foreground)] text-sm">
                          {tenant.business_name}
                        </span>
                        {tenant.phone && (
                          <span className="text-xs text-[var(--foreground-muted)] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[var(--foreground-muted)]/60" />
                            {tenant.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Industry Pack */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPackBadge(tenant.industry_pack)}
                    </td>

                    {/* Status & Quick Toggle */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(tenant)}
                        title={`Click to ${tenant.enabled ? "Disable" : "Enable"} (Requires PIN)`}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 active:scale-95 ${
                          tenant.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            tenant.enabled ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                          }`}
                        ></span>
                        <span>{tenant.enabled ? "Active" : "Disabled"}</span>
                        <Power className="w-3 h-3 opacity-60 ml-0.5" />
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(tenant)}
                          title="Edit Tenant Configuration"
                          className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenDeleteModal(tenant)}
                          title="Delete Tenant"
                          className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CREATE TENANT MODAL */}
      {/* ===================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">Create New Tenant</h3>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Provision a new multi-tenant instance under /tenants.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 flex flex-col gap-4">
              {/* Tenant ID */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Tenant ID <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. tenant_apex_air_01"
                    value={createForm.tenant_id}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        tenant_id: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl font-mono text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Unique database key. Use lowercase alphanumeric characters and underscores.
                </p>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Business Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Heating & Air Conditioning"
                  value={createForm.business_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, business_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Industry Pack */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Industry Pack <span className="text-rose-400">*</span>
                </label>
                <select
                  value={createForm.industry_pack}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, industry_pack: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                >
                  {INDUSTRY_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} ({pack.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Determines urgency triage rules, required fields, and conversational policy.
                </p>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Dispatch / Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. (303) 555-0199"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, phone: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Enabled Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border-color)] mt-1">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Enable on Creation</p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Allow inbound chat/voice traffic immediately
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={createForm.enabled}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, enabled: e.target.checked })
                  }
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)] mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  <Lock className="w-4 h-4" />
                  <span>Authorize & Create (PIN Required)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EDIT TENANT MODAL */}
      {/* ===================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">Edit Tenant Details</h3>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Update client configuration for {editForm.tenant_id}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 flex flex-col gap-4">
              {/* Tenant ID (Immutable) */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Tenant ID (Immutable)
                </label>
                <input
                  type="text"
                  disabled
                  value={editForm.tenant_id}
                  className="w-full px-3.5 py-2.5 rounded-xl font-mono text-sm bg-[var(--background)]/50 border border-[var(--border-color)] text-[var(--foreground-muted)] cursor-not-allowed"
                />
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Business Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.business_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, business_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Industry Pack */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Industry Pack
                </label>
                <select
                  value={editForm.industry_pack}
                  onChange={(e) =>
                    setEditForm({ ...editForm, industry_pack: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                >
                  {INDUSTRY_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} ({pack.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Contact / Dispatch Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Enabled Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Active Status</p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Toggle conversational AI capabilities on or off
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) =>
                    setEditForm({ ...editForm, enabled: e.target.checked })
                  }
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)] mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  <Lock className="w-4 h-4" />
                  <span>Authorize & Save (PIN Required)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ===================================================================== */}
      {isDeleteModalOpen && tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[var(--card-bg)] border border-rose-500/30 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">Delete Tenant</h3>
                <p className="text-xs text-rose-400 font-semibold">Irreversible Administrative Action</p>
              </div>
            </div>

            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Are you sure you want to permanently delete{" "}
              <strong className="text-[var(--foreground)] font-bold">
                {tenantToDelete.business_name}
              </strong>{" "}
              (<span className="font-mono text-xs text-indigo-400">{tenantToDelete.tenant_id}</span>)?
              All tenant client configurations and secrets will be purged from Firebase RTDB.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setTenantToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Authorize Deletion (PIN Required)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECURITY PIN AUTHORIZATION MODAL (MANDATORY GATE FOR ALL MUTATIONS) */}
      {/* ===================================================================== */}
      {isPinModalOpen && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-[var(--card-bg)] border border-amber-500/40 shadow-2xl p-6 flex flex-col items-center text-center">
            {/* Security Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4 shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>

            {/* Title & Security Details */}
            <h3 className="text-lg font-black tracking-tight text-[var(--foreground)]">
              {pendingAction.title}
            </h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1 mb-2 px-2">
              {pendingAction.description}
            </p>

            <div className="w-full my-3 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 font-medium">
              Enter the 4-digit Superadmin Security PIN stored at <code className="font-mono text-[11px] bg-black/40 px-1 py-0.5 rounded">/superadmins/action_pin</code> to authorize this mutation.
            </div>

            {/* 4-Digit Masked Input */}
            <div className="w-full my-3">
              <input
                id="superadmin-action-pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={handlePinChange}
                onKeyDown={handlePinKeyPress}
                disabled={isVerifyingPin}
                className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3 rounded-xl bg-[var(--background)] border-2 border-amber-500/50 text-[var(--foreground)] focus:outline-none focus:border-amber-400 shadow-inner"
              />

              {/* Visual 4-box indicator */}
              <div className="flex justify-center gap-3 mt-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-full transition-all duration-150 ${
                      pinInput.length > idx
                        ? "bg-amber-400 scale-110 shadow-sm shadow-amber-400"
                        : "bg-[var(--border-color)]"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {pinError && (
              <div className="w-full p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-3 flex items-center justify-center gap-1.5 animate-in shake">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full mt-2">
              <button
                type="button"
                disabled={isVerifyingPin}
                onClick={() => {
                  setIsPinModalOpen(false);
                  setPendingAction(null);
                  setPinInput("");
                  setPinError("");
                }}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] border border-[var(--border-color)] transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={pinInput.length !== 4 || isVerifyingPin}
                onClick={handleVerifyAndExecutePin}
                className={`w-1/2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                  pinInput.length === 4 && !isVerifyingPin
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 active:scale-95"
                    : "bg-zinc-700/50 text-zinc-400 border border-zinc-700 cursor-not-allowed"
                }`}
              >
                {isVerifyingPin ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}