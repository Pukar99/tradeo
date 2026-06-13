// === api/admin.js ===
// Admin API wrappers — all admin panel calls.
// Uses the shared API instance from api/index.js.

import { API } from './index'

// ── Users ─────────────────────────────────────────────────────────────────────
export const getAdminUsers = (params = {}) => API.get('/api/admin/users', { params })
export const getAdminUser = (id) => API.get(`/api/admin/users/${id}`)
export const patchUserTier = (id, tier) => API.patch(`/api/admin/users/${id}/tier`, { tier })
export const patchUserSuspend = (id, data) => API.patch(`/api/admin/users/${id}/suspend`, data)
export const patchUserForceLogout = (id) => API.patch(`/api/admin/users/${id}/force-logout`)

// ── Posts ─────────────────────────────────────────────────────────────────────
export const getAdminPosts = (params = {}) => API.get('/api/admin/posts', { params })
export const deleteAdminPost = (id) => API.delete(`/api/admin/posts/${id}`)
export const patchPostPin = (id) => API.patch(`/api/admin/posts/${id}/pin`)

// ── System ────────────────────────────────────────────────────────────────────
export const getSystemStats = () => API.get('/api/admin/system/stats')
export const getSystemScraper = () => API.get('/api/admin/system/scraper')
export const runSystemScraper = () => API.post('/api/admin/system/scraper/run')
export const getSystemDbCounts = () => API.get('/api/admin/system/db-counts')
export const getSystemSymbolHealth = () => API.get('/api/admin/system/symbol-health')
export const getSystemJournalHealth = () => API.get('/api/admin/system/market-journal-health')
export const getSystemConfig = () => API.get('/api/admin/system/config')
export const patchSystemConfig = (key, val) =>
  API.patch(`/api/admin/system/config/${encodeURIComponent(key)}`, { value: val })

// ── Feature Flags ─────────────────────────────────────────────────────────────
export const getAllAdminFlags = () => API.get('/api/admin/flags')
export const patchAdminFlag = (name, data) =>
  API.patch(`/api/admin/flags/${encodeURIComponent(name)}`, data)
export const postAdminFlag = (data) => API.post('/api/admin/flags', data)

// ── Broadcast ─────────────────────────────────────────────────────────────────
export const getAdminAnnouncements = (params = {}) =>
  API.get('/api/admin/announcements', { params })
export const postAdminAnnouncement = (data) => API.post('/api/admin/announcements', data)
export const patchAdminAnnouncement = (id, data) =>
  API.patch(`/api/admin/announcements/${id}`, data)
export const deleteAdminAnnouncement = (id) => API.delete(`/api/admin/announcements/${id}`)

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const getAdminAuditLog = (params = {}) => API.get('/api/admin/audit-log', { params })
