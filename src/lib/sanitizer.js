// src/lib/sanitizer.js

/**
 * Sanitizes a string to be safely used as a Firebase Realtime Database path segment or key.
 * Strictly prevents path traversal attacks (e.g. "../../superAdmin") and strips invalid RTDB characters (. # $ [ ] / \).
 *
 * @param {string|any} key
 * @param {string} fallbackPrefix
 * @returns {string} Safe database key
 */
export function sanitizeFirebaseKey(key, fallbackPrefix = "id") {
  if (!key || typeof key !== "string") {
    return `${fallbackPrefix}_${Date.now()}`;
  }

  // Remove path traversal sequences, slashes, and characters prohibited in Firebase keys
  const safe = key.replace(/(\.\.|\/|\\|[.#$\[\]])/g, "").trim();

  // If sanitized key is empty, return generated fallback
  if (!safe || safe.length === 0) {
    return `${fallbackPrefix}_${Date.now()}`;
  }

  // Truncate to reasonable maximum length (128 chars) to avoid key bloat
  return safe.slice(0, 128);
}

/**
 * Sanitizes an object to ensure no keys contain path traversal characters.
 * Replaces undefined with null to prevent Firebase SDK set() / update() crashes.
 *
 * @param {object} obj
 * @returns {object} Safe plain object
 */
export function sanitizeFirebasePayload(obj) {
  if (!obj || typeof obj !== "object") return {};

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const safeKey = key.replace(/(\.\.|\/|\\|[.#$\[\]])/g, "").trim();
    if (!safeKey) continue;

    if (value === undefined) {
      clean[safeKey] = null;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      clean[safeKey] = sanitizeFirebasePayload(value);
    } else {
      clean[safeKey] = value;
    }
  }
  return clean;
}
