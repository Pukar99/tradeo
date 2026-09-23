// =============================================================================
// adminCache.js — TTL cache layer for the admin panel's read endpoints
// =============================================================================
// Sections:
//   1. TTL Constants   — named TTLs per admin endpoint
//   2. Cached Wrappers — drop-in replacements for the read fns in api/admin.js
//   3. Invalidators    — called after writes so the next read is fresh
//   4. Cleaner         — drains every admin: key on login/logout
// =============================================================================
// WHY THIS EXISTS
//
// AdminPage renders its tabs conditionally (`{tab === 'system' && <SystemTab/>}`),
// so switching tabs UNMOUNTS the previous one and remounting refetches
// everything from scratch. Measured before this layer: bouncing between the
// System and Content tabs three times fired 21 admin requests — all six System
// endpoints plus /posts, once per visit.
//
// Those responses come back 304 Not Modified, which is misleading: the ETag
// still has to be computed, so the server does the full query either way.
// /system/db-counts runs 22 parallel COUNT(*) queries and was measured at
// 1535ms *as a 304*. A client-side TTL cache removes the round trip entirely,
// which is the only thing that actually saves that work.
//
// This reuses the app's existing gCache singleton rather than introducing a
// second caching mechanism — same get/set/TTL semantics, same optional
// sessionStorage tier, same invalidation helpers as globalCache.js.
//
// It lives in its own module (not inside globalCache.js) on purpose: globalCache
// is imported app-wide, and adding `api/admin.js` imports there would pull admin
// code into the main bundle for every user. AdminPage is the only consumer, so
// the admin API surface stays in the admin chunk, and the cleaner registry —
// which globalCache built for exactly this case — handles logout draining
// without globalCache needing to import this module.
// =============================================================================

import { gCache, registerCacheCleaner } from './globalCache'
import {
  getAdminUsers as _getAdminUsers,
  getAdminPosts as _getAdminPosts,
  getSystemStats as _getSystemStats,
  getSystemDbCounts as _getSystemDbCounts,
  getSystemConfig as _getSystemConfig,
  getSystemSymbolHealth as _getSystemSymbolHealth,
  getSystemJournalHealth as _getSystemJournalHealth,
  getAllAdminFlags as _getAllAdminFlags,
  getAdminAnnouncements as _getAdminAnnouncements,
  getAdminAuditLog as _getAdminAuditLog,
  getAiUsage as _getAiUsage,
  getAdminAnalyticsOverview as _getAdminAnalyticsOverview,
  getAdminUserAnalytics as _getAdminUserAnalytics,
} from '../api/admin'

// =============================================================================
// 1. TTL CONSTANTS
// =============================================================================
// Chosen against how fast each thing can actually change, and how expensive it
// is to recompute. Anything an admin can mutate from this panel is additionally
// invalidated on write (section 3), so a TTL is the ceiling on staleness from
// *someone else's* change, not from your own.
export const ADMIN_TTL = {
  // 15s. Deliberately short: the Users tab polls this every 25s to keep the
  // presence dots live, and that poll bypasses the cache entirely (force).
  // This TTL only covers a remount inside 15s — well under the 90s window
  // UserListRow uses to call someone online, so a dot can never go wrong.
  USERS: 15 * 1_000,
  POSTS: 60 * 1_000,
  SYSTEM_STATS: 60 * 1_000,
  // 5 min — 22 parallel COUNT(*) queries, the slowest call in the panel.
  DB_COUNTS: 5 * 60 * 1_000,
  CONFIG: 5 * 60 * 1_000,
  // Health checks read whole tables to diff them; they change only when the
  // scraper or a user edits a watchlist.
  HEALTH: 5 * 60 * 1_000,
  FLAGS: 60 * 1_000,
  ANNOUNCEMENTS: 60 * 1_000,
  ANALYTICS: 2 * 60 * 1_000,
  AI_USAGE: 60 * 1_000,
  AUDIT: 30 * 1_000,
}

// Stable cache key from a params object — sorted so { page, tier } and
// { tier, page } can't produce two entries for one request.
function keyOf(prefix, params) {
  const p = params || {}
  const parts = Object.keys(p)
    .filter((k) => p[k] !== undefined && p[k] !== null && p[k] !== '')
    .sort()
    .map((k) => `${k}=${p[k]}`)
  return parts.length ? `${prefix}:${parts.join('&')}` : prefix
}

async function cached(key, ttl, fetcher, force = false) {
  if (!force) {
    const hit = gCache.get(key)
    if (hit !== undefined) return hit
  }
  const result = await fetcher()
  gCache.set(key, result, ttl)
  return result
}

// =============================================================================
// 2. CACHED WRAPPERS
// =============================================================================
// Same return shape as the raw functions, so call sites only change their import.

// force=true skips the cache — used by the Users tab's 25s presence poll, which
// must always hit the network or the online dots would freeze.
export function getAdminUsers(params = {}, force = false) {
  return cached(
    keyOf('admin:users', params),
    ADMIN_TTL.USERS,
    () => _getAdminUsers(params),
    force
  )
}

export function getAdminPosts(params = {}) {
  return cached(keyOf('admin:posts', params), ADMIN_TTL.POSTS, () => _getAdminPosts(params))
}

export function getSystemStats() {
  return cached('admin:system:stats', ADMIN_TTL.SYSTEM_STATS, _getSystemStats)
}

export function getSystemDbCounts() {
  return cached('admin:system:db-counts', ADMIN_TTL.DB_COUNTS, _getSystemDbCounts)
}

export function getSystemConfig() {
  return cached('admin:system:config', ADMIN_TTL.CONFIG, _getSystemConfig)
}

export function getSystemSymbolHealth() {
  return cached('admin:system:symbol-health', ADMIN_TTL.HEALTH, _getSystemSymbolHealth)
}

export function getSystemJournalHealth() {
  return cached('admin:system:journal-health', ADMIN_TTL.HEALTH, _getSystemJournalHealth)
}

export function getAllAdminFlags() {
  return cached('admin:flags', ADMIN_TTL.FLAGS, _getAllAdminFlags)
}

export function getAdminAnnouncements(params = {}) {
  return cached(
    keyOf('admin:announcements', params),
    ADMIN_TTL.ANNOUNCEMENTS,
    () => _getAdminAnnouncements(params)
  )
}

export function getAdminAuditLog(params = {}) {
  return cached(keyOf('admin:audit', params), ADMIN_TTL.AUDIT, () => _getAdminAuditLog(params))
}

export function getAiUsage(params = {}) {
  return cached(keyOf('admin:ai-usage', params), ADMIN_TTL.AI_USAGE, () => _getAiUsage(params))
}

export function getAdminAnalyticsOverview() {
  return cached('admin:analytics:overview', ADMIN_TTL.ANALYTICS, _getAdminAnalyticsOverview)
}

export function getAdminUserAnalytics(id) {
  return cached(`admin:analytics:user:${id}`, ADMIN_TTL.ANALYTICS, () => _getAdminUserAnalytics(id))
}

// NOTE — /system/scraper is deliberately NOT wrapped. SystemTab polls it every
// 3s while a scrape is running; a TTL cache would freeze the progress readout.
// It stays a direct call from api/admin.js.

// =============================================================================
// 3. INVALIDATORS
// =============================================================================
// Every admin write also writes an admin_audit_log row, so each of these drops
// the audit cache too — otherwise the Audit Log tab would show a stale list
// right after you did the thing it's supposed to record.

function dropAudit() {
  gCache.delPrefix('admin:audit')
}

// Tier change / suspend / force-logout.
export function clearAdminUsersCache() {
  gCache.delPrefix('admin:users')
  // A tier change moves someone between tier buckets, which is what the
  // analytics tier distribution and the flags tab's audience sizes are built
  // from. Both read the same overview payload.
  gCache.delPrefix('admin:analytics')
  dropAudit()
}

// Post delete / pin toggle.
export function clearAdminPostsCache() {
  gCache.delPrefix('admin:posts')
  dropAudit()
}

export function clearAdminConfigCache() {
  gCache.del('admin:system:config')
  dropAudit()
}

export function clearAdminFlagsCache() {
  gCache.del('admin:flags')
  dropAudit()
}

export function clearAdminAnnouncementsCache() {
  gCache.delPrefix('admin:announcements')
  dropAudit()
}

// Triggering a scrape changes row counts and both health checks once it
// finishes. Drop them so the next System visit reflects the new data instead
// of serving a pre-scrape snapshot for up to five minutes.
export function clearAdminSystemCache() {
  gCache.delPrefix('admin:system:')
  gCache.del('admin:system:stats')
  dropAudit()
}

// Nuclear option — everything admin. Used by the cleaner below.
export function clearAdminCache() {
  gCache.delPrefix('admin:')
}

// =============================================================================
// 4. CLEANER
// =============================================================================
// globalCache's clearUserCache() runs every registered cleaner on login and
// logout. Registering here means admin data is dropped when the session changes
// without globalCache having to import this module (which would defeat the
// bundle-splitting reason this file exists).
registerCacheCleaner(clearAdminCache)
