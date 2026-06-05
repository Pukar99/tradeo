// =============================================================================
// format.js — Shared formatting & utility functions
// =============================================================================
// Sections:
//   1. NEPSE Fee Utilities      — commission, SEBON fee, DP charge, CGT
//   2. Number Formatters        — Rs, signed Rs, %, decimal, crore
//   3. Safe Parsers             — safeFloat, isCanceled, apiError, safeUrl
// =============================================================================


// =============================================================================
// 1. NEPSE FEE UTILITIES
// =============================================================================

// SEBON-regulated broker commission tiers (effective 2024, per transaction side)
// Source: SEBON official fee schedule — do NOT change without verifying new schedule
const COMMISSION_TIERS = [
  { max: 0,         flat: 0,   rate: 0      },
  { max: 2500,      flat: 10,  rate: 0      }, // flat Rs.10
  { max: 50000,     flat: 0,   rate: 0.0036 }, // 0.36%
  { max: 500000,    flat: 0,   rate: 0.0033 }, // 0.33%
  { max: 2000000,   flat: 0,   rate: 0.0031 }, // 0.31%
  { max: 10000000,  flat: 0,   rate: 0.0027 }, // 0.27%
  { max: Infinity,  flat: 0,   rate: 0.0024 }, // 0.24%
]

// Broker commission for one side of a trade (buy or sell separately)
export function nepseCommission(amount) {
  if (!amount || amount <= 0) return 0
  const tier = COMMISSION_TIERS.find(t => amount <= t.max)
  return tier.flat || amount * tier.rate
}

// SEBON transaction fee — 0.015% per side
export const sebonFee = (amount) => (!amount || amount <= 0 ? 0 : amount * 0.00015)

// DP charge — flat Rs.25 per stock per transaction day
export const dpCharge = () => 25

// All three charges combined for one side of a trade
export function nepseCharges(amount) {
  return nepseCommission(amount) + sebonFee(amount) + dpCharge()
}

// Capital Gains Tax on net gain after all transaction charges
// Rates: 7.5% if held < 365 days, 5% if held >= 365 days
export function nepseCGT(netGain, entryDateStr, exitDateStr) {
  if (!netGain || netGain <= 0) return 0

  const entry = new Date(entryDateStr)
  const exit  = new Date(exitDateStr)

  // Guard: invalid dates return NaN from subtraction — return 0 instead of NaN
  if (isNaN(entry.getTime()) || isNaN(exit.getTime())) return 0

  const days = Math.max(0, Math.floor((exit - entry) / 86400000))
  return netGain * (days >= 365 ? 0.05 : 0.075)
}


// =============================================================================
// 2. NUMBER FORMATTERS
// =============================================================================

// Today's date as YYYY-MM-DD string — used for date input defaults and max caps
export const today = () => new Date().toISOString().split('T')[0]

// Absolute Rupees — no sign, rounded integer. e.g. fmtRs(-500) → 'Rs.500'
// forex=true switches to USD display: fmtRs(12.5, true) → '$12.50'
export const fmtRs = (n, forex = false) => forex
  ? `$${Math.abs(parseFloat(n) || 0).toFixed(2)}`
  : `Rs.${Math.abs(Math.round(parseFloat(n) || 0)).toLocaleString()}`

// Signed Rupees — explicit +/− prefix. e.g. fmtRsSigned(-800) → '−Rs.800'
export const fmtRsSigned = (n) => {
  const v = parseFloat(n) || 0
  return `${v >= 0 ? '+' : '−'}Rs.${Math.abs(Math.round(v)).toLocaleString()}`
}

// Decimal number with 2dp — returns '—' for null/undefined/NaN
export const fmt = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Percentage with explicit sign — e.g. fmtPct(12.3) → '+12.30%'
export const fmtPct = (v, dec = 2) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(dec)}%`
}

// Fixed decimal places with locale grouping — e.g. fmtDec(1234.5, 1) → '1,234.5'
export const fmtDec = (v, dec = 2) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-NP', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// Crore formatter — e.g. fmtCr(1_500_000_000) → '150.00 Cr'
export const fmtCr = (v, dec = 2) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `${(n / 1e7).toFixed(dec)} Cr`
}


// =============================================================================
// 3. SAFE PARSERS
// =============================================================================

// Parse Supabase NUMERIC string to float — Supabase returns NUMERIC as strings.
// Always use this before arithmetic on DB values. Returns fallback (default 0) on failure.
export const safeFloat = (v, fallback = 0) => {
  const n = parseFloat(v)
  return isNaN(n) ? fallback : n
}

// Detect request cancellation across all axios + fetch cancel variants.
// Use this in every .catch() before showing an error — cancellations are intentional.
export const isCanceled = (err) => {
  if (!err) return false
  if (err.name === 'AbortError' || err.name === 'CanceledError') return true
  if (err.code === 'ERR_CANCELED' || err.__CANCEL__) return true
  const msg = (err.message || '').toLowerCase()
  return msg === 'canceled' || msg === 'cancelled' || msg === 'aborted'
}

// Extract a safe, user-facing error message from an axios/fetch error.
// Returns '' for cancellations. Returns fallback if message leaks internals.
export const apiError = (err, fallback = 'Something went wrong. Please try again.') => {
  if (isCanceled(err)) return ''

  const msg = err?.response?.data?.message
           || err?.response?.data?.error
           || err?.message
           || ''

  if (!msg || typeof msg !== 'string') return fallback

  // Block Supabase/SQL internals from leaking to the UI
  const INTERNAL_LEAK = /supabase|pgrst|sql|column|relation|syntax error|stack|at Object\.|\.js:\d/i
  if (INTERNAL_LEAK.test(msg)) return fallback

  return msg.length > 200 ? msg.slice(0, 200) + '…' : msg
}

// Validate a URL — returns the URL only if it uses http/https.
// Prevents javascript: and data: injection in anchor hrefs.
export const safeUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : null
  } catch {
    return null
  }
}
