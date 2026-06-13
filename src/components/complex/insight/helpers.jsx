// === insight/helpers.js — pure helpers, design tokens, tiny shared hooks ===
import { useState, useEffect } from 'react'
import { INDEX_BY_ID, RECENT_N } from '../../../utils/constants'

// When a sector sub-index (Banking, Hydro, …) is the selected index, the detail
// panels scope to that one sector and auto-expand its stocks. NEPSE/Sensitive/N20
// have no sector_index → show all sectors.
export function scopeSectors(sectors, indexId) {
  const si = INDEX_BY_ID.get(indexId)?.sector_index
  if (!sectors || !si) return sectors
  return sectors.filter(s => s.name === si)
}

// Sector to pre-select on cell selection: the sub-index's own sector (so its
// stocks are expanded immediately), or null for market-wide indices.
export function defaultSectorFor(indexId) {
  const opt = INDEX_BY_ID.get(indexId)
  return opt?.sector_index ? { name: opt.sector_index, label: opt.label } : null
}

export async function loadLC() { return import('lightweight-charts') }

// Tailwind `lg` breakpoint as state — used to mount only ONE of the desktop
// right panel / mobile bottom sheet. CSS alone (`hidden lg:flex` / `lg:hidden`)
// hides the other but leaves it MOUNTED, doubling useMonthDetail work and
// building a second chart inside a display:none host on every cell click.
export function useIsLg() {
  const [isLg, setIsLg] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = e => setIsLg(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isLg
}

// ─── Shared design tokens + Skeleton ──────────────────────────────────────────
// Single source for all three DataLab tabs — see components/datalab/shared.jsx.
// NOTE: fmtPct below stays local: it renders 0 as '0.0%' (no plus sign) while
// the shared one renders '+0.0%'; re-pointing it would change visible labels.
export { LABEL, SVAL, Skeleton } from '../../datalab/shared'

// ─── Colour helpers ───────────────────────────────────────────────────────────
export function cellBg(val, dark) {
  if (val == null) return dark ? '#1f2937' : '#f8fafc'   // matches gray-800 surface
  if (val >= 15)   return dark ? '#064e20' : '#86efac'
  if (val >= 8)    return dark ? '#14532d' : '#bbf7d0'
  if (val >= 3)    return dark ? '#166534' : '#dcfce7'
  if (val >= 0)    return dark ? '#1e3a2a' : '#f0fdf4'
  if (val >= -3)   return dark ? '#3b1a1a' : '#fff1f2'
  if (val >= -8)   return dark ? '#7f1d1d' : '#fecaca'
  return dark ? '#5c0a0a' : '#fca5a5'
}
export function cellFg(val, dark) {
  if (val == null) return dark ? '#2d3f52' : '#cbd5e1'
  if (val >= 8)    return dark ? '#4ade80' : '#15803d'
  if (val >= 0)    return dark ? '#86efac' : '#166534'
  if (val >= -8)   return dark ? '#fca5a5' : '#b91c1c'
  return dark ? '#f87171' : '#991b1b'
}
export function sectorCol(val) {
  if (val == null) return '#6b7280'
  if (val >= 10)   return '#22c55e'
  if (val >= 3)    return '#4ade80'
  if (val >= 0)    return '#86efac'
  if (val >= -3)   return '#f87171'
  if (val >= -10)  return '#ef4444'
  return '#dc2626'
}
export function fmtPct(v, dp = 1) {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(dp) + '%'
}

// ─── Weighted stats ───────────────────────────────────────────────────────────
export function weightedAvg(years) {
  const maxYear = Math.max(...years.map(y => y.year))
  return Array.from({ length: 12 }, (_, mi) => {
    let sw = 0, sv = 0
    years.forEach(row => {
      const v = row.months[mi]
      if (v == null) return
      const w = row.year > maxYear - RECENT_N ? 2 : 1
      sv += v * w; sw += w
    })
    return sw > 0 ? +(sv / sw).toFixed(2) : null
  })
}
export function weightedWinRate(years) {
  const maxYear = Math.max(...years.map(y => y.year))
  return Array.from({ length: 12 }, (_, mi) => {
    let pos = 0, tot = 0
    years.forEach(row => {
      const v = row.months[mi]
      if (v == null) return
      const w = row.year > maxYear - RECENT_N ? 2 : 1
      if (v > 0) pos += w
      tot += w
    })
    return tot > 0 ? +(pos / tot * 100).toFixed(1) : null
  })
}
export function monthStdDev(years) {
  return Array.from({ length: 12 }, (_, mi) => {
    const vals = years.map(y => y.months[mi]).filter(v => v != null)
    if (vals.length < 2) return null
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    return +Math.sqrt(variance).toFixed(1)
  })
}
