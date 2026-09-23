// === nepseCalendar.js — single source of truth for NEPSE trading-day / market-hours logic ===
// Used by MarketStatusBadge (open/closed) and StockChart (gap-detection backfill).
// NEPSE switched its weekend from Fri+Sat to Sat+Sun at the start of Nepali year 2082
// (2025-04-13). The cutoff is a fixed historical date — it must NOT be derived from
// the candidate date's own year, or Jan–Apr of every later year regresses to the old rule.

const WEEKEND_RULE_CUTOFF = '2025-04-13'

// Current time shifted to NPT (UTC+5:45) — read components with getUTC* methods.
export function nptNow() {
  return new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
}

export function nptToday() {
  return nptNow().toISOString().slice(0, 10)
}

// isoDate: 'YYYY-MM-DD'; dow: getUTCDay() of that date in NPT-shifted time
export function isNepseWeekend(isoDate, dow) {
  return isoDate >= WEEKEND_RULE_CUTOFF
    ? dow === 0 || dow === 6 // Sat + Sun off (Nepali year 2082 onwards)
    : dow === 5 || dow === 6 // Fri + Sat off (before 2082)
}

// Most recent date (today or earlier, NPT) that is a NEPSE trading day.
export function expectedLatestTradingDate() {
  const d = nptNow()
  for (let i = 0; i < 7; i++) {
    const s = d.toISOString().slice(0, 10)
    if (!isNepseWeekend(s, d.getUTCDay())) return s
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return null
}

// NEPSE trading hours — default 11:00–15:00 NPT, overridable at runtime from the
// admin-editable app_config key `market_hours` ({"open":"11:00","close":"15:00"}).
// The override arrives with the /api/market/symbols payload (see globalCache
// getMarketSymbols); pages that never load symbols simply keep the defaults.
let _marketHours = { open: 11 * 60, close: 15 * 60 }

export function setMarketHours(cfg) {
  const parse = (s) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim())
    if (!m) return null
    const mins = Number(m[1]) * 60 + Number(m[2])
    return mins >= 0 && mins < 24 * 60 ? mins : null
  }
  const open = parse(cfg?.open)
  const close = parse(cfg?.close)
  if (open != null && close != null && open < close) _marketHours = { open, close }
}

export function isMarketOpenNow() {
  const npt = nptNow()
  const iso = npt.toISOString().slice(0, 10)
  if (isNepseWeekend(iso, npt.getUTCDay())) return false
  const mins = npt.getUTCHours() * 60 + npt.getUTCMinutes()
  return mins >= _marketHours.open && mins < _marketHours.close
}
