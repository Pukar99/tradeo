import { useEffect, useRef, useCallback } from 'react'
import { checkPriceAlerts } from '../api'

// NEPSE market hours: 11:00–15:00 NPT = 05:15–09:15 UTC
// Poll every 60s during market hours, every 5min outside
const MARKET_OPEN_UTC_H  = 5
const MARKET_OPEN_UTC_M  = 15
const MARKET_CLOSE_UTC_H = 9
const MARKET_CLOSE_UTC_M = 15

function isMarketHours() {
  const now  = new Date()
  const h    = now.getUTCHours()
  const m    = now.getUTCMinutes()
  const mins = h * 60 + m
  const open  = MARKET_OPEN_UTC_H  * 60 + MARKET_OPEN_UTC_M
  const close = MARKET_CLOSE_UTC_H * 60 + MARKET_CLOSE_UTC_M
  // Mon(1)–Fri(5) only — NEPSE trades Sun–Thu (0=Sun,4=Thu)
  const day = now.getUTCDay()
  const isWeekday = day >= 0 && day <= 4  // Sun–Thu
  return isWeekday && mins >= open && mins < close
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
  const timerRef    = useRef(null)
  const onAlertRef  = useRef(onAlert)
  onAlertRef.current = onAlert

  const poll = useCallback(async () => {
    if (!user) return
    try {
      const res = await checkPriceAlerts()
      const { triggered = [] } = res.data
      if (!triggered.length) return

      const notified = getNotified()
      const fresh = triggered.filter(a => !notified.has(String(a.id)))
      if (!fresh.length) return

      // Request browser notification permission once
      if (Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {})
      }

      for (const alert of fresh) {
        markNotified(alert.id)

        // Browser push notification
        if (Notification.permission === 'granted') {
          new Notification(`Tradeo Alert — ${alert.symbol}`, {
            body: `LTP Rs.${alert.ltp.toLocaleString()} is ${alert.direction} your alert Rs.${alert.price_alert.toLocaleString()} (${alert.dist_pct}% away)`,
            icon: '/favicon.ico',
            tag:  `tradeo_alert_${alert.id}`,
          })
        }

        // In-app toast callback
        onAlertRef.current?.(alert)
      }
    } catch {
      // Silent — network errors don't break the app
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const schedule = () => {
      poll()
      const interval = isMarketHours() ? 60_000 : 5 * 60_000
      timerRef.current = setTimeout(schedule, interval)
    }

    schedule()
    return () => clearTimeout(timerRef.current)
  }, [user, poll])
}
