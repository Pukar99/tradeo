// =============================================================================
// globalCache.js — Singleton client-side cache
// =============================================================================
// Sections:
//   1. Cache Core       — gCache object (get/set/has/del/delPrefix/clear)
//   2. TTL Constants    — named TTLs for every cached endpoint
//   3. Cached Wrappers  — drop-in replacements for raw API functions
//   4. Invalidators     — clearPositionsCache, clearWatchlistCache, clearUserCache, clearEligibilityCache
//   5. Cleaner Registry — registerCacheCleaner / unregisterCacheCleaner
// =============================================================================
// Singleton: one import = one shared store. Prevents N components each fetching
// the same data independently on mount.
// =============================================================================

// =============================================================================
// 1. CACHE CORE
// =============================================================================

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

// =============================================================================
// 2. TTL CONSTANTS
// =============================================================================
export const TTL = {
  SYMBOLS:      60 * 60_000,  // 1 hour — symbol list is stable
  PROFILE:      10 * 60_000,  // 10 min — profile rarely changes
  PRICES:        5 * 60_000,  // 5 min  — prices update intraday
  CHART:        60 * 60_000,  // 1 hour — daily OHLCV doesn't change
  MOVERS:        5 * 60_000,  // 5 min  — today's movers
  MOVERS_PAST:  60 * 60_000,  // 1 hour — past date movers never change
  DASHBOARD:    60 * 1_000,   // 1 min  — dashboard data
  ELIGIBILITY:  60 * 60_000,  // 1 hour — trade stats change rarely
  NEPSE_CHART:  10 * 60_000,  // 10 min — EOD data, stable within session
  SUGGESTIONS:  10 * 60_000,  // 10 min — chat suggestions are static per session
  POSITIONS:    30 * 1_000,   // 30s    — trade data, invalidated on any write
  WATCHLIST:     2 * 60_000,  // 2 min  — matches backend _watchlistCache TTL
  MARKET_DATES: 60 * 60_000,  // 1 hour — trading dates never change once set
  DAY_FULL:     10 * 60_000,  // 10 min — EOD day data is stable
  FEED:         30 * 60_000,  // 30 min — IPOs and news change infrequently
}

// =============================================================================
// 3. CACHED WRAPPERS
// =============================================================================
// Drop-in replacements — same return shape as the raw API functions.

import {
  getMarketSymbols      as _getMarketSymbols,
  getProfile            as _getProfile,
  getResearchEligibility as _getResearchEligibility,
  getBatchPrices        as _getBatchPrices,
  getNepseChart         as _getNepseChart,
  getChatSuggestions    as _getChatSuggestions,
  getPositions          as _getPositions,
  getTradeActions       as _getTradeActions,
  getWatchlist          as _getWatchlist,
  getMarketDates        as _getMarketDates,
  getDayFull            as _getDayFull,
  getIPOs               as _getIPOs,
  getMarketNews         as _getMarketNews,
} from '../api'

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

// NEPSE chart — keyed by range so each range gets its own 10-min cache entry.
// EOD data doesn't change intraday; re-fetch is wasteful on every mount.
export async function getNepseChart(range = '1y') {
  const key = `nepse-chart:${range}`
  const cached = gCache.get(key)
  if (cached !== undefined) return cached
  const result = await _getNepseChart(range)
  gCache.set(key, result, TTL.NEPSE_CHART)
  return result
}

// Chat suggestions — static per session, no need to re-fetch on every mount.
export async function getChatSuggestions() {
  const cached = gCache.get('suggestions')
  if (cached !== undefined) return cached
  const result = await _getChatSuggestions()
  gCache.set('suggestions', result, TTL.SUGGESTIONS)
  return result
}

// Positions — 30s TTL. Invalidated on any trade write via clearPositionsCache().
// LogsPage and PortfolioPage both call this; the cache ensures only one network
// request fires even if both mount simultaneously.
export async function getPositions(status) {
  const key = status ? `positions:${status}` : 'positions'
  const cached = gCache.get(key)
  if (cached !== undefined) return cached
  const result = await _getPositions(status)
  gCache.set(key, result, TTL.POSITIONS)
  return result
}

// =============================================================================
// 4. INVALIDATORS
// =============================================================================

// Call after any trade write (new/close/partial-exit) so next read is fresh.
export function clearPositionsCache() {
  gCache.delPrefix('positions')
  gCache.del('trade-actions')
}

// Trade actions — all action rows, 30s TTL, same invalidation as positions.
export async function getTradeActions() {
  const cached = gCache.get('trade-actions')
  if (cached !== undefined) return cached
  const result = await _getTradeActions()
  gCache.set('trade-actions', result, TTL.POSITIONS)
  return result
}

// Watchlist — 2 min TTL matches backend cache. Invalidated after any watchlist write.
export async function getWatchlist() {
  const cached = gCache.get('watchlist')
  if (cached !== undefined) return cached
  const result = await _getWatchlist()
  gCache.set('watchlist', result, TTL.WATCHLIST)
  return result
}
export function clearWatchlistCache() { gCache.del('watchlist') }

// Market dates — stable once set, cache 1 hour.
export async function getMarketDates() {
  const cached = gCache.get('market-dates')
  if (cached !== undefined) return cached
  const result = await _getMarketDates()
  gCache.set('market-dates', result, TTL.MARKET_DATES)
  return result
}

// Day-full — EOD data keyed by date (or 'latest' when no date given).
export async function getDayFull(date) {
  const key = `day-full:${date ?? 'latest'}`
  const cached = gCache.get(key)
  if (cached !== undefined) return cached
  const result = await _getDayFull(date)
  // Use past-date TTL (1hr) if date given, else 10min for 'latest'
  gCache.set(key, result, date ? TTL.CHART : TTL.DAY_FULL)
  return result
}

// IPO + news feed — changes infrequently, cache 30 min.
let _feedPromise = null
export async function getMarketFeed() {
  const cachedIpos = gCache.get('feed-ipos')
  const cachedNews = gCache.get('feed-news')
  if (cachedIpos !== undefined && cachedNews !== undefined) {
    return [cachedIpos, cachedNews]
  }
  // Single in-flight promise — prevents parallel mounts from doubling the request
  if (!_feedPromise) {
    _feedPromise = Promise.all([_getIPOs(), _getMarketNews()])
      .then(([ir, nr]) => {
        gCache.set('feed-ipos', ir, TTL.FEED)
        gCache.set('feed-news', nr, TTL.FEED)
        _feedPromise = null
        return [ir, nr]
      })
      .catch(e => { _feedPromise = null; throw e })
  }
  return _feedPromise
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

// =============================================================================
// 5. CLEANER REGISTRY
// =============================================================================

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
  gCache.del('suggestions')
  gCache.del('watchlist')
  gCache.delPrefix('tradelog')
  gCache.delPrefix('prices:')
  gCache.delPrefix('positions')
  // Drain any registered module-local caches
  for (const fn of _cleaners) { try { fn() } catch {} }
}

// Call after closing a trade so the eligibility re-check picks up the new stats
export function clearEligibilityCache() {
  gCache.del('eligibility')
}
