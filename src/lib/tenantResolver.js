// src/lib/tenantResolver.js
/**
 * ============================================================================
 * CloseDesk Multi-Tenant Platform — Tenant Resolution & Configuration Service
 * ============================================================================
 * Phase 1: Multi-Tenant Foundation
 * 
 * Responsibilities:
 * 1. Resolves tenant profile from Firebase Realtime Database `/tenants/{tenant_id}`.
 * 2. Enforces active tenant status (rejects disabled, suspended, or nonexistent tenants).
 * 3. Fetches and composes the tenant's assigned `industry_pack` (/industry_packs/{pack_id}).
 * 4. Deep-merges industry defaults with tenant-specific `client_config` overrides.
 * 5. In-memory TTL caching layer to minimize Firebase RTDB read latencies.
 * 6. Strict secrets isolation: ensures sensitive credentials are never leaked.
 */

import { db } from "./firebase.js";
import { ref, get } from "firebase/database";

// --- CUSTOM ERROR DEFINITIONS ---

export class TenantNotFoundError extends Error {
  constructor(tenantId) {
    super(`Tenant not found: '${tenantId}' does not exist in the database.`);
    this.name = "TenantNotFoundError";
    this.code = "TENANT_NOT_FOUND";
    this.statusCode = 404;
    this.tenantId = tenantId;
  }
}

export class TenantDisabledError extends Error {
  constructor(tenantId, status) {
    super(`Tenant '${tenantId}' is currently inactive (status: '${status}').`);
    this.name = "TenantDisabledError";
    this.code = "TENANT_DISABLED";
    this.statusCode = 403;
    this.tenantId = tenantId;
    this.status = status;
  }
}

export class TenantResolutionError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "TenantResolutionError";
    this.code = "TENANT_RESOLUTION_ERROR";
    this.statusCode = 500;
    if (cause) this.cause = cause;
  }
}

// --- IN-MEMORY CACHE CONFIGURATION ---

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const tenantCache = new Map();
const industryPackCache = new Map();

/**
 * Deep merges two objects where source properties override target properties.
 * Arrays in source replace target arrays to respect tenant-configured lists.
 */
function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return { ...source };

  const output = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (Array.isArray(sourceValue)) {
      output[key] = [...sourceValue];
    } else if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue)
    ) {
      output[key] = deepMerge(targetValue || {}, sourceValue);
    } else if (sourceValue !== undefined) {
      output[key] = sourceValue;
    }
  }

  return output;
}

/**
 * Fetches an industry pack by its pack_id with in-memory caching.
 * @param {string} packId - Identifier of the industry pack (e.g., "hvac")
 * @param {Object} options - Resolution options
 * @returns {Promise<Object>} The industry pack configuration
 */
export async function getIndustryPack(packId, options = {}) {
  const { forceRefresh = false } = options;

  if (!packId || typeof packId !== "string") {
    return null;
  }

  const now = Date.now();
  const cached = industryPackCache.get(packId);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const packRef = ref(db, `industry_packs/${packId}`);
    const snapshot = await get(packRef);

    if (!snapshot.exists()) {
      console.warn(`[tenantResolver] Industry pack '${packId}' not found in database.`);
      return null;
    }

    const packData = snapshot.val();
    industryPackCache.set(packId, {
      data: packData,
      expiresAt: now + DEFAULT_CACHE_TTL_MS,
    });

    return packData;
  } catch (error) {
    console.error(`[tenantResolver] Failed to fetch industry pack '${packId}':`, error);
    throw new TenantResolutionError(
      `Database error loading industry pack '${packId}': ${error.message}`,
      error
    );
  }
}

/**
 * Resolves a tenant by tenant_id, loads its client_config and industry_pack,
 * validates operational status, and caches the composed configuration.
 *
 * @param {string} tenantId - Unique identifier of the tenant (e.g., "tenant_apex_air_01")
 * @param {Object} [options={}] - Optional control parameters
 * @param {boolean} [options.forceRefresh=false] - Force cache invalidation and query RTDB fresh
 * @param {boolean} [options.includeSecrets=false] - Whether to include `/tenants/{id}/secrets` (strictly for secure backend workers)
 * @param {number} [options.ttlMs=300000] - Custom cache TTL in milliseconds
 * @returns {Promise<Object>} Fully resolved tenant context
 */
export async function resolveTenant(tenantId, options = {}) {
  const {
    forceRefresh = false,
    includeSecrets = false,
    ttlMs = DEFAULT_CACHE_TTL_MS,
  } = options;

  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new TenantResolutionError("Invalid tenant_id provided: must be a non-empty string.");
  }

  const sanitizedTenantId = tenantId.trim();
  const now = Date.now();
  const cacheKey = `${sanitizedTenantId}:${includeSecrets ? "sec" : "pub"}`;
  const cached = tenantCache.get(cacheKey);

  // Return from in-memory cache if fresh
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  let tenantSnap;
  try {
    const tenantRef = ref(db, `tenants/${sanitizedTenantId}`);
    tenantSnap = await get(tenantRef);
  } catch (dbError) {
    console.error(`[tenantResolver] RTDB read error for tenant '${sanitizedTenantId}':`, dbError);
    throw new TenantResolutionError(
      `Failed to read tenant '${sanitizedTenantId}' from database: ${dbError.message}`,
      dbError
    );
  }

  // 1. Check Existence
  if (!tenantSnap.exists()) {
    throw new TenantNotFoundError(sanitizedTenantId);
  }

  const tenantRecord = tenantSnap.val() || {};

  // 2. Enforce Active Status
  const status = (tenantRecord.status || "disabled").toLowerCase();
  if (status !== "active") {
    throw new TenantDisabledError(sanitizedTenantId, status);
  }

  // 3. Extract Client Configuration
  const clientConfig = tenantRecord.client_config || {};
  const industryPackId = tenantRecord.industry_pack_id || clientConfig.industry_pack_id || null;

  // 4. Resolve Associated Industry Pack
  let industryPack = null;
  if (industryPackId) {
    industryPack = await getIndustryPack(industryPackId, { forceRefresh });
  }

  // 5. Compose Merged Configuration (Industry Defaults merged with Tenant Overrides)
  // Tenant-specific configurations take absolute precedence
  const effectiveConfig = deepMerge(industryPack || {}, clientConfig);

  // 6. Security Isolation: Handle Secrets
  const secrets = includeSecrets ? (tenantRecord.secrets || {}) : undefined;

  const resolvedTenant = {
    tenant_id: sanitizedTenantId,
    name: tenantRecord.name || clientConfig.business_name || sanitizedTenantId,
    status: tenantRecord.status,
    industry_pack_id: industryPackId,
    tier: tenantRecord.tier || "standard",
    created_at: tenantRecord.created_at || null,
    updated_at: tenantRecord.updated_at || null,
    
    // Config layers
    client_config: clientConfig,
    industry_pack: industryPack,
    effective_config: effectiveConfig,

    // Secrets (only populated when explicitly requested in privileged backend contexts)
    ...(includeSecrets ? { secrets } : {}),

    resolved_at: now,
  };

  // 7. Store in Cache
  tenantCache.set(cacheKey, {
    data: resolvedTenant,
    expiresAt: now + ttlMs,
  });

  return resolvedTenant;
}

/**
 * Manually invalidates the in-memory cache for a given tenant or all tenants.
 * @param {string} [tenantId] - Specific tenant ID to clear. If omitted, clears all cache.
 */
export function invalidateTenantCache(tenantId) {
  if (tenantId) {
    tenantCache.delete(`${tenantId}:pub`);
    tenantCache.delete(`${tenantId}:sec`);
  } else {
    tenantCache.clear();
    industryPackCache.clear();
  }
}

/**
 * Returns cache diagnostics for observability and health checks.
 */
export function getTenantCacheStats() {
  return {
    tenantCacheSize: tenantCache.size,
    industryPackCacheSize: industryPackCache.size,
  };
}
