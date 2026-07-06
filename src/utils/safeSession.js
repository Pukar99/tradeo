// =============================================================================
// safeSession.js — safe sessionStorage access (moved out of DataLabPage in S1
// so shared contexts can use it without an import cycle).
// Incognito / iframe / strict CSP throws SecurityError — wrap in try/catch so
// a single denial doesn't crash the tree. Degrades to no persistence.
// =============================================================================

export function safeSessionGet(key, fallback) {
  try {
    return sessionStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function safeSessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* fail silently — feature degrades to no persistence */
  }
}
