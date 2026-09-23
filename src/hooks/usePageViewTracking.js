// =============================================================================
// usePageViewTracking.js — queues a pageview on every route change, flushes
// the queue in ONE batched request instead of one request per navigation.
// =============================================================================
// Mounted once in AppContent. session_id lives in sessionStorage (not
// localStorage) so it naturally resets per browser tab/session — that's what
// defines a "session" for the admin analytics duration math (see backend
// utils/pageAnalytics.js).
//
// Batching (not one API call per click) is deliberate — fewer round trips
// against the Supabase free tier for the same data: navigations queue
// in-memory and flush together every FLUSH_INTERVAL_MS, or immediately when
// the tab hides/closes (visibilitychange + pagehide, via sendBeacon — fetch
// is unreliable once a page is unloading). Fire-and-forget throughout:
// analytics must never break the app, so failures are swallowed silently.

import { useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { postPageViewBatch, sendPageViewBeacon } from '@api/analytics'

const SESSION_KEY = 'tradeo.analyticsSessionId'
const FLUSH_INTERVAL_MS = 15 * 1000
const MAX_QUEUE = 20 // flush early on a rapid-navigation burst instead of growing unbounded

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    // sessionStorage unavailable (private mode) — fall back to an in-memory
    // id for the life of this page load only.
    return crypto.randomUUID()
  }
}

export function usePageViewTracking() {
  const location = useLocation()
  const sessionIdRef = useRef(null)
  if (sessionIdRef.current === null) sessionIdRef.current = getSessionId()
  const queueRef = useRef([])

  const flush = useCallback((useBeacon = false) => {
    if (queueRef.current.length === 0) return
    const events = queueRef.current
    queueRef.current = []
    if (useBeacon) {
      sendPageViewBeacon(sessionIdRef.current, events)
    } else {
      postPageViewBatch(sessionIdRef.current, events).catch(() => {})
    }
  }, [])

  // Queue on every route change — no network call here.
  useEffect(() => {
    queueRef.current.push({ path: location.pathname, ts: Date.now() })
    if (queueRef.current.length >= MAX_QUEUE) flush()
  }, [location.pathname, flush])

  // Periodic flush while the tab is open.
  useEffect(() => {
    const id = setInterval(() => flush(), FLUSH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [flush])

  // Flush on tab hide / close — the moments a periodic timer could miss.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush(true)
    }
    const handlePageHide = () => flush(true)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [flush])
}
