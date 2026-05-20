// ── Shared number / string formatting utilities ────────────────────────────────
// Used by: BacktestReport, BacktestActivePanel, BacktestControls, InsightPage, BreakdownPage, AuditTab, PortfolioPage, RiskLabPage

// ── NEPSE Equity broker commission (SEBON-regulated, effective 2024) ──────────
// Source: SEBON official fee schedule
// Tiers apply per transaction side (buy or sell separately)
export function nepseCommission(amount) {
  if (amount <= 0)          return 0
  if (amount <= 2500)       return 10                 // flat Rs.10
  if (amount <= 50000)      return amount * 0.0036    // 0.36%
  if (amount <= 500000)     return amount * 0.0033    // 0.33%
  if (amount <= 2000000)    return amount * 0.0031    // 0.31%
  if (amount <= 10000000)   return amount * 0.0027    // 0.27%
  return                           amount * 0.0024    // 0.24%
}

// SEBON transaction fee (separate from broker commission)
export const sebonFee = (amount) => amount * 0.00015  // 0.015%

// DP charge per stock per transaction day (flat)
export const dpCharge = () => 25

// Total charges for one side of a trade (buy or sell)
export function nepseCharges(amount) {
  return nepseCommission(amount) + sebonFee(amount) + dpCharge()
}

// CGT on net capital gain (individual investor rates)
// Nepal: CGT is on net gain AFTER all transaction charges
export function nepseCGT(netGain, entryDateStr, exitDateStr) {
  if (netGain <= 0) return 0
  const days = Math.max(0, Math.floor((new Date(exitDateStr) - new Date(entryDateStr)) / 86400000))
  return netGain * (days >= 365 ? 0.05 : 0.075)
}

/**
 * Format a number as Nepali Rupees (rounded integer, no decimals).
 * fmtRs(12345.6) → 'Rs.12,346'  |  fmtRs(-500) → 'Rs.500' (absolute)
 * Use signCls() separately for color.
 */
export const fmtRs = (n) => `Rs.${Math.abs(Math.round(parseFloat(n) || 0)).toLocaleString()}`

/**
 * Format with explicit sign prefix.
 * fmtRsSigned(1200) → '+Rs.1,200'  |  fmtRsSigned(-800) → '-Rs.800'
 */
export const fmtRsSigned = (n) => {
  const v = parseFloat(n) || 0
  return `${v >= 0 ? '+' : '-'}Rs.${Math.abs(Math.round(v)).toLocaleString()}`
}

/**
 * Format a number as compact Nepali Rupees with 2 decimal places.
 * Returns '—' for null/undefined/NaN.
 */
export const fmt = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Format a number as a percentage string.
 * fmtPct(12.345) → '+12.35%'  |  fmtPct(-3.1) → '−3.10%'
 */
export const fmtPct = (v, dec = 2) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(dec)}%`
}

/**
 * Format a number with a fixed number of decimal places.
 * fmtDec(1234.5, 1) → '1,234.5'
 */
export const fmtDec = (v, dec = 2) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-NP', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

/**
 * Format a large number in crores (1 Cr = 1e7).
 * fmtCr(1_500_000_000) → '150.00 Cr'
 */
export const fmtCr = (v, dec = 2) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `${(n / 1e7).toFixed(dec)} Cr`
}

/**
 * Safely parse a Supabase NUMERIC string to float. Returns 0 on failure.
 * Supabase returns NUMERIC columns as strings — always use this before arithmetic.
 */
export const safeFloat = (v, fallback = 0) => {
  const n = parseFloat(v)
  return isNaN(n) ? fallback : n
}

/**
 * Detects request cancellation across:
 *  - Fetch `AbortError`
 *  - Axios 1.x `CanceledError` (err.code === 'ERR_CANCELED')
 *  - Axios legacy `Cancel` (err.__CANCEL__)
 *  - String messages like 'canceled' / 'aborted'
 * Use this before showing an error to the user — cancellations are intentional, not errors.
 */
export const isCanceled = (err) => {
  if (!err) return false
  if (err.name === 'AbortError' || err.name === 'CanceledError') return true
  if (err.code === 'ERR_CANCELED' || err.__CANCEL__) return true
  const msg = (err.message || '').toLowerCase()
  if (msg === 'canceled' || msg === 'cancelled' || msg === 'aborted') return true
  return false
}

export const apiError = (err, fallback = 'Something went wrong. Please try again.') => {
  if (isCanceled(err)) return ''
  const msg = err?.response?.data?.message
           || err?.response?.data?.error
           || err?.message
           || ''
  if (!msg || typeof msg !== 'string') return fallback
  // Block known internal leak patterns
  const leak = /supabase|pgrst|sql|column|relation|syntax error|stack|at Object\.|\.js:\d/i
  if (leak.test(msg)) return fallback
  // Truncate very long messages
  return msg.length > 200 ? msg.slice(0, 200) + '…' : msg
}

/**
 * Safe URL — returns the URL only if it uses http/https protocol.
 * Prevents javascript: and data: injection in anchor hrefs.
 */
export const safeUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : null
  } catch {
    return null
  }
}
