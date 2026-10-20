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
  Power,
  Shield,
  Layers,
  Phone,
  MapPin,
  Users,
  UserPlus,
  Globe,
  Key,
  Clock,
  Eye,
  EyeOff,
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

const TIMEZONES = [
  "Asia/Karachi",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "UTC",
];

const USER_ROLES = [
  { id: "tenant_admin", name: "Tenant Admin", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { id: "agent", name: "Agent / Rep", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: "technician", name: "Field Technician", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: "staff", name: "Support Staff", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { id: "viewer", name: "Read-Only Viewer", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
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
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

  // --- FORM STATES ---
  const [createForm, setCreateForm] = useState({
    tenant_id: "",
    business_name: "",
    industry_pack: "saas",
    phone: "",
    address: "",
    city: "",
    timezone: "Asia/Karachi",
    enabled: true,
  });

  const [editForm, setEditForm] = useState({
    tenant_id: "",
    business_name: "",
    industry_pack: "saas",
    phone: "",
    enabled: true,
  });

  // Location Form State
  const [locationForm, setLocationForm] = useState({
    tenant_id: "",
    business_name: "",
    address: "",
    city: "",
    region: "",
    postal_code: "",
    country: "PK",
    lat: "",
    lng: "",
    timezone: "Asia/Karachi",
    service_area: "",
  });

  // Users Form State
  const [managingTenant, setManagingTenant] = useState(null);
  const [tenantUsersList, setTenantUsersList] = useState([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [revealedPasswords, setRevealedPasswords] = useState(new Set());

  const [userForm, setUserForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "agent",
    email: "",
    phone: "",
    status: "active",
  });

  const [tenantToDelete, setTenantToDelete] = useState(null);

  // --- SECURITY PIN AUTHORIZATION MODAL ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // --- TOAST NOTIFICATIONS ---
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
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
            const location = t?.location || {};
            const rawUsers = t?.users || {};

            // Parse users map to array for convenience
            const userArray = Object.entries(rawUsers).map(([uId, u]) => ({
              user_id: uId,
              username: u.username || u.name || uId,
              name: u.name || u.username || uId,
              password: u.password || "",
              role: u.role || "agent",
              email: u.email || "",
              phone: u.phone || "",
              status: u.status || "active",
              created_at: u.created_at || null,
            }));

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
                  : t?.status ? t.status.toLowerCase() === "active" : true,
              phone: clientConfig.phone || t?.phone || null,
              created_at: t?.created_at || null,
              updated_at: t?.updated_at || null,
              location: {
                address: location.address || clientConfig.address || "",
                city: location.city || "",
                region: location.region || location.state || "",
                postal_code: location.postal_code || location.zip || "",
                country: location.country || "",
                coordinates: location.coordinates || { lat: null, lng: null },
                timezone: location.timezone || clientConfig.timezone || "Asia/Karachi",
                service_area: Array.isArray(location.service_area) ? location.service_area : [],
              },
              users: userArray,
              client_config: clientConfig,
              secrets: secrets,
            };
          });

          parsedTenants.sort((a, b) => a.business_name.localeCompare(b.business_name));
          setTenants(parsedTenants);

          // If managing a tenant's users right now, sync the active user list
          if (managingTenant) {
            const updated = parsedTenants.find((pt) => pt.tenant_id === managingTenant.tenant_id);
            if (updated) setTenantUsersList(updated.users);
          }
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
  }, [managingTenant]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tenant.tenant_id.toLowerCase().includes(query) ||
        tenant.business_name.toLowerCase().includes(query) ||
        tenant.industry_pack.toLowerCase().includes(query) ||
        (tenant.location?.address && tenant.location.address.toLowerCase().includes(query)) ||
        (tenant.location?.city && tenant.location.city.toLowerCase().includes(query));

      const matchesIndustry =
        selectedIndustryFilter === "all" || tenant.industry_pack === selectedIndustryFilter;

      return matchesSearch && matchesIndustry;
    });
  }, [tenants, searchQuery, selectedIndustryFilter]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.enabled).length;
    const disabled = total - active;
    const totalUsers = tenants.reduce((acc, t) => acc + (t.users?.length || 0), 0);
    return { total, active, disabled, totalUsers };
  }, [tenants]);

  // =========================================================================
  // 2. SECURITY PIN AUTHORIZATION & MUTATION DISPATCH
  // =========================================================================
  const requestPinAuthorization = (action) => {
    setPendingAction(action);
    setPinInput("");
    setPinError("");
    setIsPinModalOpen(true);
  };

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
      const pinRef = ref(db, "superadmins/action_pin");
      const pinSnap = await get(pinRef);

      let authoritativePin = null;

      if (pinSnap.exists()) {
        authoritativePin = String(pinSnap.val()).trim();
      } else {
        const legacyAdminRef = ref(db, "superAdmin");
        const legacySnap = await get(legacyAdminRef);
        if (legacySnap.exists()) {
          const admins = legacySnap.val();
          const found = Array.isArray(admins) ? admins.find((a) => a && a.pin) : null;
          if (found && found.pin) authoritativePin = String(found.pin).trim();
        }

        if (!authoritativePin) {
          authoritativePin = "1234";
          try {
            await set(ref(db, "superadmins/action_pin"), "1234");
          } catch (_) {}
        }
      }

      if (pinInput.trim() !== authoritativePin) {
        setPinError("Invalid security PIN. Access denied.");
        setPinInput("");
        setIsVerifyingPin(false);
        return;
      }

      await executePendingMutation(pendingAction);

      setIsPinModalOpen(false);
      setPendingAction(null);
      setPinInput("");
      setIsVerifyingPin(false);
    } catch (error) {
      console.error("[ClientManagement] Mutation execution failed:", error);
      setPinError(`Execution error: ${error.message || "Failed to execute action"}`);
      setIsVerifyingPin(false);
    }
  };

  const executePendingMutation = async (action) => {
    const now = Date.now();

    switch (action.type) {
      // ---------------------------------------------------------------------
      // CREATE TENANT
      // ---------------------------------------------------------------------
      case "CREATE": {
        const { tenant_id, business_name, industry_pack, phone, address, city, timezone, enabled } =
          action.payload;

        const newTenantRecord = {
          tenant_id,
          name: business_name.trim(),
          industry_pack_id: industry_pack,
          industry_pack: industry_pack,
          enabled: Boolean(enabled),
          status: enabled ? "active" : "disabled",
          created_at: now,
          updated_at: now,

          location: {
            address: address?.trim() || null,
            city: city?.trim() || null,
            region: null,
            postal_code: null,
            country: "PK",
            timezone: timezone || "Asia/Karachi",
            service_area: city?.trim() ? [city.trim()] : [],
          },

          users: {
            admin: {
              user_id: "admin",
              username: "admin",
              name: `${business_name.trim()} Admin`,
              password: "admin",
              role: "tenant_admin",
              email: null,
              phone: phone?.trim() || null,
              status: "active",
              created_at: now,
            },
          },

          client_config: {
            business_name: business_name.trim(),
            industry_pack: industry_pack,
            enabled: Boolean(enabled),
            phone: phone?.trim() || null,
            address: address?.trim() || null,
            timezone: timezone || "Asia/Karachi",
            email: null,
            website: null,
            services_offered: [
              industry_pack === "saas"
                ? "AI Automation & SaaS Systems"
                : industry_pack === "hvac"
                ? "Heating, AC, Furnace & Heat Pumps"
                : "General Professional Services",
            ],
            pricing: {
              currency: "USD",
              diagnostic_fee: industry_pack === "hvac" ? 99 : null,
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
              supports_24_7_dispatch: industry_pack === "hvac" || industry_pack === "plumbing",
              dispatch_phone: phone?.trim() || null,
            },
            actions: {
              create_service_request: true,
              create_booking: true,
              escalate_to_human: true,
            },
          },

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
        const { tenant_id, business_name, industry_pack, phone, enabled } = action.payload;

        const updates = {
          name: business_name.trim(),
          industry_pack_id: industry_pack,
          industry_pack: industry_pack,
          enabled: Boolean(enabled),
          status: enabled ? "active" : "disabled",
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
      // UPDATE LOCATION
      // ---------------------------------------------------------------------
      case "UPDATE_LOCATION": {
        const { tenant_id, locationData } = action.payload;

        const serviceAreaArray = typeof locationData.service_area === "string"
          ? locationData.service_area.split(",").map((s) => s.trim()).filter(Boolean)
          : locationData.service_area || [];

        const coordinates = {
          lat: locationData.lat ? parseFloat(locationData.lat) : null,
          lng: locationData.lng ? parseFloat(locationData.lng) : null,
        };

        const locationPayload = {
          address: locationData.address?.trim() || null,
          city: locationData.city?.trim() || null,
          region: locationData.region?.trim() || null,
          postal_code: locationData.postal_code?.trim() || null,
          country: locationData.country?.trim() || null,
          timezone: locationData.timezone || "Asia/Karachi",
          coordinates,
          service_area: serviceAreaArray,
          updated_at: now,
        };

        const updates = {};
        updates[`tenants/${tenant_id}/location`] = locationPayload;
        updates[`tenants/${tenant_id}/client_config/address`] = locationPayload.address;
        updates[`tenants/${tenant_id}/client_config/timezone`] = locationPayload.timezone;

        // If primary tenant_aicyro, synchronize live settings/business_profile too
        if (tenant_id === "tenant_aicyro") {
          updates["settings/business_profile/basic_info/address"] = locationPayload.address;
          updates["settings/business_profile/timezone"] = locationPayload.timezone;
        }

        await update(ref(db), updates);
        setIsLocationModalOpen(false);
        showToast(`Location updated for tenant '${tenant_id}'!`, "success");
        break;
      }

      // ---------------------------------------------------------------------
      // ADD / EDIT / DELETE TENANT USER
      // ---------------------------------------------------------------------
      case "SAVE_TENANT_USER": {
        const { tenant_id, userData, isNew } = action.payload;
        const sanitizedUsername = userData.username.trim().toLowerCase();

        const userRecord = {
          user_id: sanitizedUsername,
          username: sanitizedUsername,
          name: userData.name.trim(),
          password: userData.password.trim(),
          role: userData.role || "agent",
          email: userData.email?.trim() || null,
          phone: userData.phone?.trim() || null,
          status: userData.status || "active",
          updated_at: now,
          ...(isNew && { created_at: now }),
        };

        const updates = {};
        updates[`tenants/${tenant_id}/users/${sanitizedUsername}`] = userRecord;

        // If modifying user in tenant_aicyro, synchronize with legacy /login array
        if (tenant_id === "tenant_aicyro") {
          try {
            const loginSnap = await get(ref(db, "login"));
            let loginList = loginSnap.exists() && Array.isArray(loginSnap.val()) ? loginSnap.val() : [null];
            const existingIdx = loginList.findIndex((u) => u && u.name === sanitizedUsername);

            if (existingIdx !== -1) {
              loginList[existingIdx] = { name: sanitizedUsername, password: userRecord.password };
            } else {
              loginList.push({ name: sanitizedUsername, password: userRecord.password });
            }
            updates["login"] = loginList;
          } catch (_) {}
        }

        await update(ref(db), updates);
        setIsAddingUser(false);
        setEditingUserId(null);
        resetUserForm();
        showToast(`User '${sanitizedUsername}' saved for tenant '${tenant_id}'!`, "success");
        break;
      }

      case "DELETE_TENANT_USER": {
        const { tenant_id, username } = action.payload;

        await remove(ref(db, `tenants/${tenant_id}/users/${username}`));

        // If deleting user in tenant_aicyro, synchronize with legacy /login
        if (tenant_id === "tenant_aicyro") {
          try {
            const loginSnap = await get(ref(db, "login"));
            if (loginSnap.exists()) {
              const loginList = loginSnap.val().filter((u) => u && u.name !== username);
              await set(ref(db, "login"), loginList);
            }
          } catch (_) {}
        }

        showToast(`User '${username}' removed from tenant '${tenant_id}'.`, "success");
        break;
      }

      // ---------------------------------------------------------------------
      // TOGGLE ENABLED STATUS
      // ---------------------------------------------------------------------
      case "TOGGLE_STATUS": {
        const { tenant_id, new_status, business_name } = action.payload;

        const updates = {
          enabled: Boolean(new_status),
          status: new_status ? "active" : "disabled",
          updated_at: now,
          "client_config/enabled": Boolean(new_status),
        };

        await update(ref(db, `tenants/${tenant_id}`), updates);
        showToast(`Tenant '${business_name}' is now ${new_status ? "ACTIVE" : "DISABLED"}.`, "info");
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
        showToast(`Tenant '${business_name}' (${tenant_id}) permanently deleted.`, "success");
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      tenant_id: "",
      business_name: "",
      industry_pack: "saas",
      phone: "",
      address: "",
      city: "",
      timezone: "Asia/Karachi",
      enabled: true,
    });
  };

  const resetUserForm = () => {
    setUserForm({
      username: "",
      name: "",
      password: "",
      role: "agent",
      email: "",
      phone: "",
      status: "active",
    });
  };

  // =========================================================================
  // 3. ACTION HANDLERS (STAGE FOR PIN AUTHORIZATION)
  // =========================================================================
  const handleOpenCreateModal = () => {
    resetCreateForm();
    setIsCreateModalOpen(true);
  };

  const handleSubmitCreate = (e) => {
    e.preventDefault();
    const sanitizedId = createForm.tenant_id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    if (!sanitizedId) {
      alert("Please provide a valid Tenant ID.");
      return;
    }
    if (!createForm.business_name.trim()) {
      alert("Please provide a Business Name.");
      return;
    }
    if (tenants.some((t) => t.tenant_id === sanitizedId)) {
      alert(`Tenant ID '${sanitizedId}' already exists. Please choose a unique identifier.`);
      return;
    }

    requestPinAuthorization({
      type: "CREATE",
      title: "Authorize Tenant Creation",
      description: `Create new tenant '${createForm.business_name}' with ID '${sanitizedId}'.`,
      payload: { ...createForm, tenant_id: sanitizedId },
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

    requestPinAuthorization({
      type: "EDIT",
      title: "Authorize Tenant Modification",
      description: `Update configuration for tenant '${editForm.business_name}' (${editForm.tenant_id}).`,
      payload: { ...editForm },
    });
  };

  // Location Modal Handler
  const handleOpenLocationModal = (tenant) => {
    const loc = tenant.location || {};
    setLocationForm({
      tenant_id: tenant.tenant_id,
      business_name: tenant.business_name,
      address: loc.address || "",
      city: loc.city || "",
      region: loc.region || "",
      postal_code: loc.postal_code || "",
      country: loc.country || "PK",
      lat: loc.coordinates?.lat !== null && loc.coordinates?.lat !== undefined ? String(loc.coordinates.lat) : "",
      lng: loc.coordinates?.lng !== null && loc.coordinates?.lng !== undefined ? String(loc.coordinates.lng) : "",
      timezone: loc.timezone || "Asia/Karachi",
      service_area: Array.isArray(loc.service_area) ? loc.service_area.join(", ") : "",
    });
    setIsLocationModalOpen(true);
  };

  const handleSubmitLocation = (e) => {
    e.preventDefault();
    requestPinAuthorization({
      type: "UPDATE_LOCATION",
      title: "Authorize Location Update",
      description: `Update physical location, service area, and timezone for '${locationForm.business_name}' (${locationForm.tenant_id}).`,
      payload: {
        tenant_id: locationForm.tenant_id,
        locationData: { ...locationForm },
      },
    });
  };

  // Users Modal Handler
  const handleOpenUsersModal = (tenant) => {
    setManagingTenant(tenant);
    setTenantUsersList(tenant.users || []);
    setIsAddingUser(false);
    setEditingUserId(null);
    resetUserForm();
    setIsUsersModalOpen(true);
  };

  const handleStartAddUser = () => {
    resetUserForm();
    setIsAddingUser(true);
    setEditingUserId(null);
  };

  const handleStartEditUser = (user) => {
    setUserForm({
      username: user.username,
      name: user.name,
      password: user.password,
      role: user.role || "agent",
      email: user.email || "",
      phone: user.phone || "",
      status: user.status || "active",
    });
    setEditingUserId(user.user_id);
    setIsAddingUser(false);
  };

  const handleSubmitUserForm = (e) => {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password.trim()) {
      alert("Username and Password are required.");
      return;
    }

    const isNew = !editingUserId;
    requestPinAuthorization({
      type: "SAVE_TENANT_USER",
      title: isNew ? "Authorize User Addition" : "Authorize User Update",
      description: `${isNew ? "Add" : "Update"} account '${userForm.username}' for tenant '${managingTenant.tenant_id}'.`,
      payload: {
        tenant_id: managingTenant.tenant_id,
        userData: { ...userForm },
        isNew,
      },
    });
  };

  const handleDeleteUser = (user) => {
    requestPinAuthorization({
      type: "DELETE_TENANT_USER",
      title: "Authorize User Deletion",
      description: `Remove user '${user.username}' from tenant '${managingTenant.tenant_id}'.`,
      payload: {
        tenant_id: managingTenant.tenant_id,
        username: user.username,
      },
    });
  };

  const togglePasswordVisibility = (userId) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleToggleStatus = (tenant) => {
    const nextStatus = !tenant.enabled;
    requestPinAuthorization({
      type: "TOGGLE_STATUS",
      title: `Authorize Status: ${nextStatus ? "ENABLE" : "DISABLE"}`,
      description: `${nextStatus ? "Re-activate" : "Disable"} conversational services for '${tenant.business_name}'.`,
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
      description: `Permanently delete tenant '${tenantToDelete.business_name}' (${tenantToDelete.tenant_id}) from Firebase RTDB.`,
      payload: {
        tenant_id: tenantToDelete.tenant_id,
        business_name: tenantToDelete.business_name,
      },
    });
  };

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
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${found.badgeColor}`}>
        {found.name}
      </span>
    );
  };

  const getUserRoleBadge = (role) => {
    const found = USER_ROLES.find((r) => r.id === role);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${found ? found.color : "bg-zinc-500/10 text-zinc-300 border-zinc-500/20"}`}>
        {found ? found.name : role}
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
          <button onClick={() => setToast(null)} className="ml-2 text-current/60 hover:text-current transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
              Tenant & Client Management
            </h1>
            <p className="text-xs sm:text-sm text-[var(--foreground-muted)]">
              Orchestrate multi-tenant client silos, location coordinates, user credentials, and operational policies.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Create Tenant</span>
        </button>
      </div>

      {/* STATS CHIPS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Total Tenants</p>
            <p className="text-2xl font-black mt-1 text-[var(--foreground)]">{stats.total}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Active Instances</p>
            <p className="text-2xl font-black mt-1 text-emerald-400">{stats.active}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Provisioned Users</p>
            <p className="text-2xl font-black mt-1 text-indigo-400">{stats.totalUsers}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Security Gate</p>
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
            placeholder="Search by ID, name, location..."
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
                <th scope="col" className="px-6 py-4">Business & Location</th>
                <th scope="col" className="px-6 py-4">Industry Pack</th>
                <th scope="col" className="px-6 py-4">Users</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-[var(--foreground-muted)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="text-sm font-medium">Listening to Realtime Database (/tenants)...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-[var(--foreground-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="w-10 h-10 text-[var(--foreground-muted)]/40" />
                      <p className="text-base font-semibold text-[var(--foreground)]">No tenants found</p>
                      <p className="text-xs text-[var(--foreground-muted)] max-w-sm">
                        {searchQuery
                          ? "No tenants matched your search criteria."
                          : "No multi-tenant accounts exist yet. Click 'Create Tenant' to provision one."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.tenant_id} className="hover:bg-[var(--background)]/50 transition-colors">
                    {/* Tenant ID */}
                    <td className="px-6 py-4 font-mono text-xs font-medium text-indigo-400 whitespace-nowrap">
                      <span className="p-1.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        {tenant.tenant_id}
                      </span>
                    </td>

                    {/* Business Name & Location */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--foreground)] text-sm">
                          {tenant.business_name}
                        </span>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--foreground-muted)]">
                          {tenant.location?.address ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-rose-400" />
                              {tenant.location.address}
                            </span>
                          ) : (
                            <span className="italic text-[var(--foreground-muted)]/60">No address set</span>
                          )}
                          {tenant.location?.timezone && (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-indigo-400" />
                              {tenant.location.timezone}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Industry Pack */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPackBadge(tenant.industry_pack)}
                    </td>

                    {/* Users Count & Manage Pill */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenUsersModal(tenant)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{tenant.users?.length || 0} Users</span>
                      </button>
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
                        <span className={`w-2 h-2 rounded-full ${tenant.enabled ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                        <span>{tenant.enabled ? "Active" : "Disabled"}</span>
                        <Power className="w-3 h-3 opacity-60 ml-0.5" />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenLocationModal(tenant)}
                          title="Manage Tenant Location"
                          className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenUsersModal(tenant)}
                          title="Manage Tenant Users"
                          className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
                        >
                          <Users className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(tenant)}
                          title="Edit Details"
                          className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all"
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
      {/* 1. LOCATION MANAGEMENT MODAL */}
      {/* ===================================================================== */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-2xl bg-[var(--card-bg)] border border-emerald-500/30 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">Tenant Location & Geo Policy</h3>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Configure physical headquarters, coordinates, timezone, and service coverage for {locationForm.tenant_id}.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsLocationModalOpen(false)} className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLocation} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Full Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rawalpindi, Pakistan or 400 Industrial Pkwy, Denver, CO"
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">City</label>
                  <input
                    type="text"
                    placeholder="Rawalpindi"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">State / Region</label>
                  <input
                    type="text"
                    placeholder="Punjab / CO"
                    value={locationForm.region}
                    onChange={(e) => setLocationForm({ ...locationForm, region: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Postal Code</label>
                  <input
                    type="text"
                    placeholder="46000 / 80216"
                    value={locationForm.postal_code}
                    onChange={(e) => setLocationForm({ ...locationForm, postal_code: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Country Code</label>
                  <input
                    type="text"
                    placeholder="PK / US / GB"
                    value={locationForm.country}
                    onChange={(e) => setLocationForm({ ...locationForm, country: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Timezone</label>
                  <select
                    value={locationForm.timezone}
                    onChange={(e) => setLocationForm({ ...locationForm, timezone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="33.5973"
                    value={locationForm.lat}
                    onChange={(e) => setLocationForm({ ...locationForm, lat: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="73.0479"
                    value={locationForm.lng}
                    onChange={(e) => setLocationForm({ ...locationForm, lng: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Service Area (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rawalpindi, Islamabad, Punjab, Global Online"
                  value={locationForm.service_area}
                  onChange={(e) => setLocationForm({ ...locationForm, service_area: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Cities or districts this tenant operates within. Used by the AI triage engine to qualify dispatch requests.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsLocationModalOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  Cancel
                </button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 active:scale-95 transition-all">
                  <Lock className="w-4 h-4" />
                  <span>Authorize Location (PIN Required)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. TENANT USERS MANAGEMENT MODAL */}
      {/* ===================================================================== */}
      {isUsersModalOpen && managingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[var(--card-bg)] border border-indigo-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    Manage Users — {managingTenant.business_name}
                  </h3>
                  <p className="text-xs text-[var(--foreground-muted)] font-mono">
                    Node: /tenants/{managingTenant.tenant_id}/users
                  </p>
                </div>
              </div>
              <button onClick={() => setIsUsersModalOpen(false)} className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              {/* Header with Add Button */}
              <div className="flex items-center justify-between pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                  Active Tenant Accounts ({tenantUsersList.length})
                </p>
                {!isAddingUser && !editingUserId && (
                  <button
                    onClick={handleStartAddUser}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Tenant User</span>
                  </button>
                )}
              </div>

              {/* Add / Edit User Form */}
              {(isAddingUser || editingUserId) && (
                <form onSubmit={handleSubmitUserForm} className="p-4 rounded-xl bg-[var(--background)] border border-indigo-500/30 flex flex-col gap-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 mb-1">
                    <p className="text-xs font-bold text-indigo-400 uppercase">
                      {isAddingUser ? "Create New User for this Tenant" : `Edit User: ${userForm.username}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setIsAddingUser(false); setEditingUserId(null); resetUserForm(); }}
                      className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--foreground-muted)] mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        disabled={Boolean(editingUserId)}
                        placeholder="e.g. saad or marcus"
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                        className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--foreground-muted)] mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Saad Khan"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--foreground-muted)] mb-1">Password *</label>
                      <input
                        type="text"
                        required
                        placeholder="Account password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--foreground-muted)] mb-1">Role *</label>
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                      >
                        {USER_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--foreground-muted)] mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="user@aicyro.com"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--foreground-muted)] mb-1">Status</label>
                      <select
                        value={userForm.status}
                        onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm active:scale-95"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isAddingUser ? "Authorize & Add User (PIN)" : "Authorize & Save Changes (PIN)"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--background)] border-b border-[var(--border-color)] text-[var(--foreground-muted)] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Password</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {tenantUsersList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-center text-[var(--foreground-muted)]">
                          No users provisioned for this tenant yet. Click &quot;Add Tenant User&quot; above.
                        </td>
                      </tr>
                    ) : (
                      tenantUsersList.map((user) => (
                        <tr key={user.user_id} className="hover:bg-[var(--background)]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-[var(--foreground)] text-xs">{user.name}</span>
                              <span className="font-mono text-[11px] text-indigo-400">@{user.username}</span>
                              {user.email && <span className="text-[10px] text-[var(--foreground-muted)]">{user.email}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">{getUserRoleBadge(user.role)}</td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span>{revealedPasswords.has(user.user_id) ? user.password : "••••••••"}</span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(user.user_id)}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                              >
                                {revealedPasswords.has(user.user_id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${user.status === "active" ? "text-emerald-400" : "text-zinc-400"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-400" : "bg-zinc-400"}`} />
                              {user.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleStartEditUser(user)}
                                title="Edit user"
                                className="p-1.5 rounded text-[var(--foreground-muted)] hover:text-indigo-400 hover:bg-indigo-500/10"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                title="Delete user"
                                className="p-1.5 rounded text-[var(--foreground-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--background)] flex justify-end">
              <button
                type="button"
                onClick={() => setIsUsersModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
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
                  <p className="text-xs text-[var(--foreground-muted)]">Provision a new instance under /tenants.</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Tenant ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. tenant_apex_air_01"
                  value={createForm.tenant_id}
                  onChange={(e) => setCreateForm({ ...createForm, tenant_id: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  className="w-full px-3.5 py-2.5 rounded-xl font-mono text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Business Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Heating & Air Conditioning"
                  value={createForm.business_name}
                  onChange={(e) => setCreateForm({ ...createForm, business_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Industry Pack *</label>
                  <select
                    value={createForm.industry_pack}
                    onChange={(e) => setCreateForm({ ...createForm, industry_pack: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                  >
                    {INDUSTRY_PACKS.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name} ({pack.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Dispatch / Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. 03472539535"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Headquarters City</label>
                  <input
                    type="text"
                    placeholder="Rawalpindi"
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Timezone</label>
                  <select
                    value={createForm.timezone}
                    onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Address</label>
                <input
                  type="text"
                  placeholder="Rawalpindi, Pakistan"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Enable on Creation</p>
                  <p className="text-xs text-[var(--foreground-muted)]">Allow chat/voice traffic immediately</p>
                </div>
                <input
                  type="checkbox"
                  checked={createForm.enabled}
                  onChange={(e) => setCreateForm({ ...createForm, enabled: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  Cancel
                </button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95 transition-all">
                  <Lock className="w-4 h-4" />
                  <span>Authorize & Create (PIN Required)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
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
                  <p className="text-xs text-[var(--foreground-muted)]">Update client configuration for {editForm.tenant_id}.</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Tenant ID (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editForm.tenant_id}
                  className="w-full px-3.5 py-2.5 rounded-xl font-mono text-sm bg-[var(--background)]/50 border border-[var(--border-color)] text-[var(--foreground-muted)] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">
                  Business Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.business_name}
                  onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Industry Pack</label>
                <select
                  value={editForm.industry_pack}
                  onChange={(e) => setEditForm({ ...editForm, industry_pack: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                >
                  {INDUSTRY_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} ({pack.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--foreground-muted)] mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border-color)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Active Status</p>
                  <p className="text-xs text-[var(--foreground-muted)]">Toggle conversational AI services on or off</p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  Cancel
                </button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95 transition-all">
                  <Lock className="w-4 h-4" />
                  <span>Authorize & Save (PIN Required)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
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
              <strong className="text-[var(--foreground)] font-bold">{tenantToDelete.business_name}</strong>{" "}
              (<span className="font-mono text-xs text-indigo-400">{tenantToDelete.tenant_id}</span>)?
              All tenant configurations, users, location, and records will be purged from Firebase RTDB.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setTenantToDelete(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
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
      {/* 4-DIGIT SECURITY PIN AUTHORIZATION MODAL (STRICT SECURITY GATE) */}
      {/* ===================================================================== */}
      {isPinModalOpen && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-[var(--card-bg)] border border-amber-500/40 shadow-2xl p-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4 shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black tracking-tight text-[var(--foreground)]">
              {pendingAction.title}
            </h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1 mb-2 px-2">
              {pendingAction.description}
            </p>

            <div className="w-full my-3 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 font-medium">
              Enter the 4-digit Superadmin Security PIN stored at <code className="font-mono text-[11px] bg-black/40 px-1 py-0.5 rounded">/superadmins/action_pin</code> to authorize this mutation.
            </div>

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

              <div className="flex justify-center gap-3 mt-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-full transition-all duration-150 ${
                      pinInput.length > idx ? "bg-amber-400 scale-110 shadow-sm shadow-amber-400" : "bg-[var(--border-color)]"
                    }`}
                  />
                ))}
              </div>
            </div>

            {pinError && (
              <div className="w-full p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-3 flex items-center justify-center gap-1.5 animate-in shake">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

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