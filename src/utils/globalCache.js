// ── Global client-side cache ───────────────────────────────────────────────────
// Singleton module — one import = one shared store across all components.
// Prevents N components each fetching the same data independently.
//
// Usage:
//   import { gCache } from '../utils/globalCache'
//   const hit = gCache.get('symbols')
//   if (hit) return hit
//   const data = await getMarketSymbols()
//   gCache.set('symbols', data, 60 * 60_000)

const _store = new Map()

export const gCache = {
  // Get a cached value. Returns undefined if missing or expired.
  get(key) {
    const entry = _store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.exp) { _store.delete(key); return undefined }
    return entry.val
  },

  // Set a value with a TTL in milliseconds.
  set(key, val, ttlMs = 60 * 60_000) {
    _store.set(key, { val, exp: Date.now() + ttlMs })
  },

  // Check if a key exists and is fresh.
  has(key) {
    const entry = _store.get(key)
    if (!entry) return false
    if (Date.now() > entry.exp) { _store.delete(key); return false }
    return true
  },

  // Invalidate a key (e.g. after a write).
  del(key) { _store.delete(key) },

  // Invalidate all keys matching a prefix.
  delPrefix(prefix) {
    for (const k of _store.keys()) {
      if (k.startsWith(prefix)) _store.delete(k)
    }
  },

  // Clear everything (e.g. on logout).
  clear() { _store.clear() },
}

// ── Pre-defined TTLs ───────────────────────────────────────────────────────────
export const TTL = {
  SYMBOLS:      60 * 60_000,  // 1 hour — symbol list is stable
  PROFILE:      10 * 60_000,  // 10 min — profile rarely changes
  PRICES:        5 * 60_000,  // 5 min  — prices update intraday
  CHART:        60 * 60_000,  // 1 hour — daily OHLCV doesn't change
  MOVERS:        5 * 60_000,  // 5 min  — today's movers
  MOVERS_PAST:  60 * 60_000,  // 1 hour — past date movers never change
  DASHBOARD:    60 * 1_000,   // 1 min  — dashboard data
  ELIGIBILITY:  60 * 60_000,  // 1 hour — trade stats change rarely
}

// ── Cached wrappers for the most-fetched endpoints ────────────────────────────
// Drop-in replacements — same return shape as the raw API functions.

import { getMarketSymbols as _getMarketSymbols } from '../api'
import { getProfile       as _getProfile       } from '../api'
import { getResearchEligibility as _getResearchEligibility } from '../api'
import { getBatchPrices   as _getBatchPrices   } from '../api'

export async function getMarketSymbols() {
  const cached = gCache.get('symbols')
  if (cached !== undefined) return cached
  const result = await _getMarketSymbols()
  gCache.set('symbols', result, TTL.SYMBOLS)
  return result
}

export async function getProfile() {
  const cached = gCache.get('profile')
  if (cached !== undefined) return cached
  const result = await _getProfile()
  gCache.set('profile', result, TTL.PROFILE)
  return result
}

// Research eligibility is expensive (full trade scan). Cache 1 hr client-side.
// Invalidate when a trade is closed (call clearEligibilityCache() from LogsPage).
export async function getResearchEligibility() {
  const cached = gCache.get('eligibility')
  if (cached !== undefined) return cached
  const result = await _getResearchEligibility()
  gCache.set('eligibility', result, TTL.ELIGIBILITY)
  return result
}

// Batch prices — keyed by sorted symbol list so different symbol sets get independent cache entries.
// 5-min TTL — prices are end-of-day on NEPSE; stale within a session is acceptable.
// Invalidate on logout via clearUserCache() (delPrefix 'prices:').
export async function getBatchPrices(symbols) {
  const key = 'prices:' + [...symbols].sort().join(',')
  const cached = gCache.get(key)
  if (cached !== undefined) return cached
  const result = await _getBatchPrices(symbols)
  gCache.set(key, result, TTL.PRICES)
  return result
}

// Dashboard init — cached 1 min client-side so navigating back to / is instant.
// Backend also has 60s initCache, so double-caching is intentional (saves the RTT).
// Pass force=true to bypass cache (e.g. after a trade write).
export async function getDashboardInit(fetchFn, force = false) {
  if (!force) {
    const cached = gCache.get('dashboard')
    if (cached !== undefined) return cached
  }
  const result = await fetchFn()
  gCache.set('dashboard', result, TTL.DASHBOARD)
  return result
}

// Registry for module-local caches that want to be flushed on login/logout
// without globalCache having to import those modules (avoids pulling lazy
// chunks like PerformanceChart into the auth code path).
const _cleaners = new Set()
export function registerCacheCleaner(fn) {
  if (typeof fn === 'function') _cleaners.add(fn)
}
export function unregisterCacheCleaner(fn) {
  _cleaners.delete(fn)
}

// Call this on login/logout to reset user-specific caches
export function clearUserCache() {
  gCache.del('profile')
  gCache.del('dashboard')
  gCache.del('eligibility')
  gCache.delPrefix('tradelog')
  gCache.delPrefix('prices:')
  // Drain any registered module-local caches
  for (const fn of _cleaners) { try { fn() } catch {} }
}

// Call after closing a trade so the eligibility re-check picks up the new stats
export function clearEligibilityCache() {
  gCache.del('eligibility')
}
