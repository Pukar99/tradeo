// ── Shared number / string formatting utilities ────────────────────────────────
// Used by: BacktestReport, BacktestActivePanel, BacktestControls, InsightPage, BreakdownPage

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
