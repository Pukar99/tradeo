import { useEffect, useRef } from 'react'
import { checkPriceAlerts } from '../api'

// NEPSE market close: 15:00 NPT = 09:15 UTC
// We fetch once on startup, then once at 15:10 NPT (09:25 UTC) — after EOD data lands
const EOD_UTC_H = 9
const EOD_UTC_M = 25

// How many ms until the next 15:10 NPT (09:25 UTC) today or tomorrow
function msUntilEOD() {
  const now = new Date()
  const target = new Date(now)
  target.setUTCHours(EOD_UTC_H, EOD_UTC_M, 0, 0)
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1)
  return target - now
}

// Track which alerts we've already notified this session so we don't spam
const NOTIFIED_KEY = 'tradeo_alerted_ids'
function getNotified() {
  try { return new Set(JSON.parse(sessionStorage.getItem(NOTIFIED_KEY) || '[]')) } catch { return new Set() }
}
function markNotified(id) {
  const set = getNotified()
  set.add(String(id))
  try { sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set])) } catch {}
}

export function usePriceAlerts({ user, onAlert }) {
  const timerRef   = useRef(null)
  const onAlertRef = useRef(onAlert)
  const userRef    = useRef(user)
  onAlertRef.current = onAlert
  userRef.current    = user

  // pollRef holds the latest poll function — never changes identity, so safe in useEffect deps
  const pollRef = useRef(null)
  pollRef.current = async () => {
    if (!userRef.current) return
    try {
      const res = await checkPriceAlerts()
      const { triggered = [] } = res.data
      if (!triggered.length) return

      const notified = getNotified()
      const fresh = triggered.filter(a => !notified.has(String(a.id)))
      if (!fresh.length) return

      if (Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {})
      }

      for (const alert of fresh) {
        markNotified(alert.id)
        if (Notification.permission === 'granted') {
          new Notification(`Tradeo Alert — ${alert.symbol}`, {
            body: `LTP Rs.${alert.ltp.toLocaleString()} is ${alert.direction} your alert Rs.${alert.price_alert.toLocaleString()} (${alert.dist_pct}% away)`,
            icon: '/favicon.ico',
            tag:  `tradeo_alert_${alert.id}`,
          })
        }
        onAlertRef.current?.(alert)
      }
    } catch { /* silent */ }
  }

  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) return

    pollRef.current()

    const scheduleEOD = () => {
      timerRef.current = setTimeout(() => {
        pollRef.current()
        scheduleEOD()
      }, msUntilEOD())
    }
    scheduleEOD()

    return () => clearTimeout(timerRef.current)
  }, [userId]) // only re-run when user logs in/out — not on every render
}
