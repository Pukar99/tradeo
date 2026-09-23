// =============================================================================
// usePriceAlerts.js — Price alert poller + browser notification dispatcher
// =============================================================================
// Sections:
//   1. Refresh Timing   — msUntilNextCheck helper
//   2. Notification Dedup — session-scoped notified-IDs set
//   3. Hook             — usePriceAlerts({ user, onAlert })
// =============================================================================

import { useEffect, useRef } from 'react'
import { checkPriceAlerts } from '../api'

// Check ten minutes after each scheduled backend market-data refresh.
const CHECK_TIMES_UTC = [[5, 25], [6, 25], [7, 25], [8, 25], [9, 50]]

// =============================================================================
// 1. REFRESH TIMING
// =============================================================================

// How many ms until the next scheduled post-refresh check.
function msUntilNextCheck() {
  const now = new Date()
  for (const [hour, minute] of CHECK_TIMES_UTC) {
    const target = new Date(now)
    target.setUTCHours(hour, minute, 0, 0)
    if (target > now) return target - now
  }
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(CHECK_TIMES_UTC[0][0], CHECK_TIMES_UTC[0][1], 0, 0)
  return tomorrow - now
}

// =============================================================================
// 2. NOTIFICATION DEDUP
// =============================================================================

// Session-scoped set of already-notified alert IDs — prevents repeat notifications
function notifiedKey(userId) {
  return `tradeo_alerted_ids:${userId}`
}
function alertFingerprint(alert) {
  return `${alert.id}:${alert.price_alert ?? alert.alert_date ?? ''}`
}
function getNotified(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(notifiedKey(userId)) || '[]'))
  } catch {
    return new Set()
  }
}
function markNotified(userId, alert) {
  const set = getNotified(userId)
  set.add(alertFingerprint(alert))
  try {
    localStorage.setItem(notifiedKey(userId), JSON.stringify([...set]))
  } catch {}
}

// =============================================================================
// 3. HOOK
// =============================================================================

export function usePriceAlerts({ user, onAlert }) {
  const timerRef = useRef(null)
  const onAlertRef = useRef(onAlert)
  const userRef = useRef(user)
  onAlertRef.current = onAlert
  userRef.current = user

  // pollRef holds the latest poll function — never changes identity, so safe in useEffect deps
  const pollRef = useRef(null)
  pollRef.current = async () => {
    if (!userRef.current) return
    try {
      const res = await checkPriceAlerts()
      const { triggered = [] } = res.data
      if (!triggered.length) return

      const userId = userRef.current?.id
      const notified = getNotified(userId)
      const fresh = triggered.filter((a) => !notified.has(alertFingerprint(a)))
      if (!fresh.length) return

      const notificationsSupported = typeof Notification !== 'undefined'
      if (notificationsSupported && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {})
      }

      for (const alert of fresh) {
        markNotified(userId, alert)
        if (notificationsSupported && Notification.permission === 'granted') {
          new Notification(`Tradeo Alert — ${alert.symbol}`, {
            body: alert.type === 'date'
              ? alert.notes || `Reminder due for ${alert.symbol}`
              : `LTP Rs.${parseFloat(alert.ltp).toLocaleString()} is ${alert.direction} your alert Rs.${parseFloat(alert.price_alert).toLocaleString()} (${alert.dist_pct}% away)`,
            icon: '/favicon.ico',
            tag: `tradeo_alert_${alert.id}`,
          })
        }
        onAlertRef.current?.(alert)
      }
    } catch {
      /* silent */
    }
  }

  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) return

    pollRef.current()

    const scheduleNextCheck = () => {
      timerRef.current = setTimeout(() => {
        pollRef.current()
        scheduleNextCheck()
      }, msUntilNextCheck())
    }
    scheduleNextCheck()

    return () => clearTimeout(timerRef.current)
  }, [userId]) // only re-run when user logs in/out — not on every render
}
