// === format.js — shared backtest-family number formatters ===
// Backtest displays use en-IN (lakh) grouping, unlike the global utils/format.js
// (en-NP / plain toLocaleString) — so these live here, not in the global file.
// Bodies moved verbatim from the component-local copies (identical output).

// Whole-number en-IN grouping — the family default. fmt(125000) → '1,25,000'
export function fmt(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// 2-decimal en-IN grouping — chart price labels. fmt2(1250.5) → '1,250.5'
export function fmt2(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// Signed percent, 2dp. fmtPct(12.3) → '+12.30%'
export function fmtPct(n) {
  return n == null ? '—' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%'
}
