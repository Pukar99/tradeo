// === api/analytics.js ===
// Public page-view tracking — no auth required (guests count too).
import { API, BASE_URL } from './index'

export const postPageViewBatch = (sessionId, events) =>
  API.post('/api/analytics/pageview', { session_id: sessionId, events })

// navigator.sendBeacon for the unload/hide path — fetch is unreliable once
// the page is closing, sendBeacon is designed for exactly this. No response
// to read (fire-and-forget by design), so it's a separate helper from the
// axios-based postPageViewBatch used for the periodic in-app flush.
export function sendPageViewBeacon(sessionId, events) {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false
  const blob = new Blob([JSON.stringify({ session_id: sessionId, events })], {
    type: 'application/json',
  })
  return navigator.sendBeacon(`${BASE_URL}/api/analytics/pageview`, blob)
}
