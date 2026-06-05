import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useTheme } from '../../context/ThemeContext'
import {
  getMarketCycles, runDropAnalysis, getSectorStocks,
  getSectorIndexChart, getStockPriceRange, getSectorCycles,
} from '../../api'
import { apiError, isCanceled } from '../../utils/format'
import { INDEX_OPTIONS } from '../../utils/constants'
import { useToolbarSlot } from '../../pages/DataLabPage'

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const CARD   = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
const LABEL  = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400'
const STITLE = 'text-[11px] font-semibold text-gray-700 dark:text-gray-200'
const SVAL   = 'text-[13px] font-bold tabular-nums'

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON (reserves space — pass minH to avoid layout shift)
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ minH = 60 }) {
  return (
    <div className="space-y-2 px-4 py-4 animate-pulse" style={{ minHeight: minH }}>
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function pctTextCls(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct >= 0)    return 'text-emerald-500'
  if (pct > -12)   return 'text-amber-500'
  if (pct > -25)   return 'text-red-500'
  return 'text-red-700 dark:text-red-400'
}
// Continuous heatmap color — interpolates HSL between red (-25%) and emerald (+25%)
// with neutral mid-tone at 0%. No discrete buckets → no visible color cliffs at
// values like 4.9% vs 5.1%.
//   hue:   0 (red) → 152 (emerald)
//   light: tinted background (light mode 92% → 80%; dark mode 18% → 30%)
function heatColor(pct, dark) {
  if (pct == null) return dark ? '#1f2937' : '#f9fafb'
  // Clamp magnitude at ±25% so extreme values don't all look identical
  const t = Math.max(-1, Math.min(1, pct / 25))
  // t in [-1, +1] maps linearly to hue in [0, 152] (red→amber→emerald)
  const hue = (t + 1) / 2 * 152
  // Magnitude controls saturation/lightness — flat at 0%, more intense at ±25%
  const mag = Math.abs(t)
  if (dark) {
    // Dark mode: from gray-tinted (18% L) up to deep colored bg (28% L)
    const l = 18 + mag * 10
    const s = 30 + mag * 40
    return `hsl(${hue}, ${s}%, ${l}%)`
  }
  // Light mode: from off-white (95% L) down to colored tint (82% L)
  const l = 95 - mag * 13
  const s = 30 + mag * 50
  return `hsl(${hue}, ${s}%, ${l}%)`
}
// Continuous HSL: red(0)→amber(50)→emerald(100). x in [-1,1].
function gradColor(x) {
  if (x == null) return '#9ca3af'
  const t = Math.max(0, Math.min(1, (x + 1) / 2)) // -1→0, 0→0.5, 1→1
  const hue = 0 + t * 152 // 0 red → 152 emerald
  return `hsl(${hue}, 70%, 48%)`
}
function phaseCls(phase) {
  const m = {
    'Crash':       'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
    'Bear Market': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    'Correction':  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
    'Major Bull':  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    'Bull Run':    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800',
    'Rally':       'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  }
  return m[phase] || 'bg-gray-100 dark:bg-gray-800 text-gray-500'
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE CHART — SVG candlestick with hover tooltip, Y-axis, coloured zone
// ─────────────────────────────────────────────────────────────────────────────
function PriceChart({ candles, startDate, endDate, type = 'bear', dark, label = '', height = 260 }) {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [w, setW] = useState(600)

  // Measure container width so the viewBox matches the rendered aspect ratio.
  // Without this the viewBox letterboxes inside narrow cards (e.g. the 420px
  // right panel) and the chart appears tiny.
  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    setW(el.clientWidth || 600)
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const VW = Math.max(280, Math.round(w)), VH = height
  const PAD = { top: 18, bottom: 26, left: 44, right: 10 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  const candleW = Math.max(1, Math.min(8, Math.floor(chartW / Math.max(candles?.length || 1, 1)) - 1))

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx = Math.round(relX / chartW * (candles.length - 1))
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }, [candles, chartW])

  if (!candles?.length) return (
    <div className="flex items-center justify-center text-[11px] text-gray-400" style={{ height: VH }}>
      No chart data
    </div>
  )

  const hasWicks = candles.some(c => c.high != null && c.low != null)
  const allHigh  = candles.map(c => hasWicks ? +c.high  : Math.max(+(c.open ?? c.close), +c.close))
  const allLow   = candles.map(c => hasWicks ? +c.low   : Math.min(+(c.open ?? c.close), +c.close))
  const maxV = Math.max(...allHigh)
  const minV = Math.min(...allLow)
  const span = maxV - minV || 1

  const cx = i => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = v => PAD.top  + (1 - (+v - minV) / span) * chartH

  const si = candles.findIndex(c => c.date >= startDate)
  const ei = candles.findIndex(c => c.date >= endDate)
  const zoneStart = si >= 0 ? si : 0
  const zoneEnd   = ei >= 0 ? ei : candles.length - 1

  const zoneColor = type === 'bull' ? '#10b981' : '#ef4444'
  const zoneBg    = type === 'bull' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'

  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const v = minV + (i / 3) * span
    return { v, y: cy(v) }
  })

  const dateTick = [...new Set([0, zoneStart, zoneEnd, candles.length - 1])]
    .filter(i => i >= 0 && i < candles.length)

  const hoverCandle = hover !== null ? candles[hover] : null
  const hoverX      = hover !== null ? cx(hover) : null
  const zStartClose = +candles[zoneStart]?.close
  const zEndClose   = +candles[zoneEnd]?.close

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: VH }}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}
      >
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH}
          fill={dark ? '#0f172a' : '#fafafa'} rx="2" />

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + chartW} y2={t.y}
              stroke={dark ? '#1e293b' : '#e5e7eb'} strokeWidth="1" />
            <text x={PAD.left - 5} y={t.y + 3} textAnchor="end" fontSize="10" fontFamily="monospace"
              fill={dark ? '#475569' : '#94a3b8'}>
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        <rect x={cx(zoneStart)} y={PAD.top}
          width={Math.max(0, cx(zoneEnd) - cx(zoneStart))} height={chartH} fill={zoneBg} />
        <line x1={cx(zoneStart)} y1={PAD.top} x2={cx(zoneStart)} y2={PAD.top + chartH}
          stroke={zoneColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
        <line x1={cx(zoneEnd)} y1={PAD.top} x2={cx(zoneEnd)} y2={PAD.top + chartH}
          stroke={zoneColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />

        {candles.map((c, i) => {
          const x     = cx(i)
          const open  = +(c.open  ?? c.close)
          const close = +c.close
          const high  = hasWicks ? +c.high  : Math.max(open, close)
          const low   = hasWicks ? +c.low   : Math.min(open, close)
          const isUp  = close >= open
          const inZone = i >= zoneStart && i <= zoneEnd
          let bodyColor, wickColor
          if (inZone) {
            bodyColor = isUp ? '#10b981' : '#ef4444'
            wickColor = bodyColor
          } else {
            bodyColor = isUp ? (dark ? '#1d4a34' : '#bbf7d0') : (dark ? '#4a1d1d' : '#fecaca')
            wickColor = isUp ? (dark ? '#22c55e' : '#16a34a') : (dark ? '#ef4444' : '#dc2626')
          }
          const bodyTop = cy(Math.max(open, close))
          const bodyBot = cy(Math.min(open, close))
          const bodyH   = Math.max(1, bodyBot - bodyTop)
          return (
            <g key={i} opacity={hover === i ? 1 : 0.92}>
              <line x1={x} y1={cy(high)} x2={x} y2={cy(low)} stroke={wickColor} strokeWidth={hover === i ? 1.5 : 1} />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                fill={bodyColor} stroke={hover === i ? (dark ? '#fff' : '#1e293b') : 'none'}
                strokeWidth={0.5} rx="0.5" />
            </g>
          )
        })}

        {!isNaN(zStartClose) && (
          <text x={cx(zoneStart)} y={PAD.top - 7} textAnchor="middle" fontSize="10" fontWeight="700" fill={zoneColor}>
            {zStartClose.toFixed(0)}
          </text>
        )}
        {!isNaN(zEndClose) && (
          <text x={cx(zoneEnd)} y={PAD.top - 7} textAnchor="middle" fontSize="10" fontWeight="700" fill={zoneColor}>
            {zEndClose.toFixed(0)}
          </text>
        )}

        <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
          stroke={dark ? '#1e293b' : '#e5e7eb'} strokeWidth="1" />
        {dateTick.map(idx => (
          <text key={idx} x={cx(idx)} y={VH - 6} textAnchor="middle" fontSize="9"
            fill={dark ? '#64748b' : '#94a3b8'}>
            {candles[idx]?.date?.slice(2, 10)}
          </text>
        ))}

        {hover !== null && hoverCandle && (
          <line x1={hoverX} y1={PAD.top} x2={hoverX} y2={PAD.top + chartH}
            stroke={dark ? '#64748b' : '#94a3b8'} strokeWidth="1" strokeDasharray="4,3" />
        )}

        {label && (
          <text x={PAD.left + 4} y={PAD.top + 12} fontSize="10" fontWeight="700"
            fill={dark ? '#475569' : '#94a3b8'}>{label}</text>
        )}
      </svg>

      {hover !== null && hoverCandle && (
        <div className="pointer-events-none absolute top-2 z-30 text-[10px] rounded-lg px-2.5 py-2 shadow-xl border whitespace-nowrap"
          style={{
            left:  hoverX > VW * 0.6 ? undefined : `calc(${(hoverX / VW) * 100}% + 10px)`,
            right: hoverX > VW * 0.6 ? `calc(${((VW - hoverX) / VW) * 100}% + 10px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}>
          <div className="font-semibold mb-1 text-[10px]" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            {hoverCandle.date}
          </div>
          <div className="flex gap-2.5">
            <span className="text-gray-400">O <span className="font-semibold">{(+(hoverCandle.open ?? hoverCandle.close)).toLocaleString()}</span></span>
            <span className="text-gray-400">C <span className="font-bold text-[11px]">{(+hoverCandle.close).toLocaleString()}</span></span>
          </div>
          {hover >= zoneStart && hover <= zoneEnd && (
            <div style={{ color: zoneColor }} className="text-[10px] mt-0.5 font-medium">
              {type === 'bear' ? 'Drop' : 'Run'} day {hover - zoneStart + 1}
            </div>
          )}
          {hover > zoneEnd && (
            <div className="text-[10px] mt-0.5 text-emerald-500">Recovery day {hover - zoneEnd}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI OVERVIEW — full history, short height, click band to select cycle
// ─────────────────────────────────────────────────────────────────────────────
function MiniOverview({ candles, cycles, activeCycle, onCycleClick, dark }) {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [w, setW] = useState(800)

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    setW(el.clientWidth || 800)
    const ro = new ResizeObserver(() => setW(el.clientWidth || 800))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const VW = Math.max(320, Math.round(w)), VH = 160
  const PAD = { top: 10, bottom: 20, left: 44, right: 8 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx  = Math.round(relX / chartW * (candles.length - 1))
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }, [candles, chartW])

  const handleClick = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const clamped = Math.max(0, Math.min(candles.length - 1, Math.round(relX / chartW * (candles.length - 1))))
    const date = candles[clamped]?.date
    if (!date) return
    // Direct hit
    let hit = cycles.find(c => date >= c.start_date && date <= c.end_date)
    if (hit) { onCycleClick(hit); return }
    // Grace fallback: tiny bands (< ~6px wide) are hard to land on. Pick the
    // nearest cycle whose midpoint is within a 1.5% candle-index radius of the click.
    const grace = Math.max(3, Math.round(candles.length * 0.015))
    let bestDist = Infinity, bestCycle = null
    for (const c of cycles) {
      const si = candles.findIndex(x => x.date >= c.start_date)
      const ei = candles.findIndex(x => x.date >= c.end_date)
      if (si < 0 || ei < 0) continue
      const mid = (si + ei) / 2
      const dist = Math.abs(clamped - mid)
      if (dist <= grace && dist < bestDist) {
        bestDist = dist
        bestCycle = c
      }
    }
    if (bestCycle) onCycleClick(bestCycle)
  }, [candles, cycles, chartW, onCycleClick])

  if (!candles?.length) return <div style={{ height: VH }} />

  const allVals = candles.flatMap(c => [+(c.open ?? c.close), +c.close])
  const minV    = Math.min(...allVals)
  const maxV    = Math.max(...allVals)
  const span    = maxV - minV || 1

  const cx = i => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = v => PAD.top  + (1 - (+v - minV) / span) * chartH

  // Line path
  const linePath = candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${cy(+c.close)}`).join(' ')

  // Cursor: pointer when hovering inside a clickable cycle band, default otherwise
  const hoverDate = hover != null ? candles[hover]?.date : null
  const inBand = hoverDate ? cycles.some(c => hoverDate >= c.start_date && hoverDate <= c.end_date) : false

  const yTicks = [0, 0.5, 1].map(f => ({ v: minV + f * span, y: cy(minV + f * span) }))
  const xLabels = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * (candles.length - 1)))

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: VH }}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', cursor: inBand ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)} onClick={handleClick}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + chartW} y2={t.y}
              stroke={dark ? '#1e293b' : '#f1f5f9'} strokeWidth="1" />
            <text x={PAD.left - 4} y={t.y + 3} textAnchor="end" fontSize="9" fontFamily="monospace"
              fill={dark ? '#475569' : '#94a3b8'}>
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        {cycles.map((cyc, i) => {
          const si = candles.findIndex(c => c.date >= cyc.start_date)
          const ei = candles.findIndex(c => c.date >= cyc.end_date)
          if (si < 0 || ei < 0) return null
          const isActive = activeCycle?.start_date === cyc.start_date
          const base = cyc.type === 'bull' ? 'rgba(16,185,129,' : 'rgba(239,68,68,'
          const fill = `${base}${isActive ? '0.32' : '0.1'})`
          const stroke = isActive ? (cyc.type === 'bull' ? '#10b981' : '#ef4444') : 'none'
          return (
            <rect key={i} x={cx(si)} y={PAD.top}
              width={Math.max(2, cx(ei) - cx(si))} height={chartH}
              fill={fill} stroke={stroke} strokeWidth={isActive ? 1.5 : 0} />
          )
        })}

        <path d={linePath} fill="none" stroke={dark ? '#94a3b8' : '#475569'} strokeWidth="1.2" />

        {hover !== null && (
          <line x1={cx(hover)} y1={PAD.top} x2={cx(hover)} y2={PAD.top + chartH}
            stroke={dark ? '#64748b' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3,2" />
        )}

        {xLabels.map((idx, i) => (
          <text key={i} x={cx(idx)} y={VH - 4} textAnchor="middle" fontSize="9"
            fill={dark ? '#64748b' : '#94a3b8'}>
            {candles[idx]?.date?.slice(0, 7)}
          </text>
        ))}
      </svg>

      {hover !== null && candles[hover] && (
        <div className="pointer-events-none absolute top-1 z-20 text-[10px] rounded-lg px-2 py-1 shadow border whitespace-nowrap"
          style={{
            left:  cx(hover) / VW * 100 > 60 ? undefined : `calc(${cx(hover) / VW * 100}% + 8px)`,
            right: cx(hover) / VW * 100 > 60 ? `calc(${(VW - cx(hover)) / VW * 100}% + 8px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}>
          <span className="text-gray-400">{candles[hover].date}</span>
          <span className="font-bold ml-2">{(+candles[hover].close).toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR × CYCLE MATRIX — rows = sectors, cols = bull/bear cycles
// Replaces the year-based monthly heatmap. Active cycle column highlighted.
// ─────────────────────────────────────────────────────────────────────────────
function SectorCycleMatrix({ cycles, activeCycle, onCycleSelect, dark }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Stable hash of cycles (date pairs) so we don't refetch on object identity churn
  const cyclesKey = useMemo(
    () => (cycles || []).map(c => `${c.start_date}|${c.end_date}|${c.type}`).join(','),
    [cycles]
  )

  useEffect(() => {
    if (!cycles?.length) { setData(null); return }
    const ctrl = new AbortController()
    setLoading(true); setError(''); setData(null)
    // Send minimal cycle info — only what backend needs
    const payload = {
      cycles: cycles.map(c => ({ start_date: c.start_date, end_date: c.end_date, type: c.type })),
    }
    getSectorCycles(payload, { signal: ctrl.signal })
      .then(r => { if (!ctrl.signal.aborted) setData(r.data) })
      .catch(e => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        // Backend caps at 100 cycles — give the user an actionable suggestion.
        const status = e?.response?.status
        const raw    = (e?.response?.data?.error || '').toLowerCase()
        if (status === 400 && raw.includes('too many cycles')) {
          setError(`${cycles.length} cycles is too many to compare at once — raise the swing threshold to detect fewer, larger cycles.`)
        } else {
          setError(apiError(e, 'Failed to load matrix'))
        }
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [cyclesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit states (no ambiguity between "loading", "no cycles yet", "fetch returned empty"):
  if (!cycles?.length) return (
    <div className="flex items-center justify-center py-6 text-[11px] text-gray-400">No cycles detected — adjust threshold</div>
  )
  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-6">
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-[11px] text-gray-500 dark:text-gray-400">Computing sector × cycle returns…</span>
    </div>
  )
  if (error) return (
    <div className="px-3 py-2 text-[11px] text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg">{error}</div>
  )
  if (!data?.sectors?.length) return (
    <div className="flex items-center justify-center py-6 text-[11px] text-gray-400">Sector index data unavailable for this date range</div>
  )

  const activeIdx = activeCycle ? cycles.findIndex(c => c.start_date === activeCycle.start_date) : -1

  // Compute per-sector total compounded return across all cycles for the right summary column
  const totalReturn = (returns) => {
    let c = 1, any = false
    for (const r of returns) {
      if (r != null) { c *= (1 + r / 100); any = true }
    }
    return any ? +((c - 1) * 100).toFixed(1) : null
  }

  return (
    // overscroll-x-contain stops the swipe from chaining to page scroll.
    // Thin styled scrollbar makes horizontal scroll affordance visible without dominating.
    // pb-1 reserves space inside the rounded card so the scrollbar isn't clipped.
    <div className="overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            {/* Sticky left: Sector name column. z-30 so it covers both the regular cycle cells AND the active-cycle inset rings. */}
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900 z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.04)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.04)]">Sector</th>
            {cycles.map((c, ci) => {
              const isBull   = c.type === 'bull'
              const isActive = ci === activeIdx
              const num      = c.name?.match(/\d+/)?.[0] || ''
              return (
                <th
                  key={ci}
                  onClick={() => onCycleSelect?.(c)}
                  title={`${c.name || (isBull ? '▲' : '▼')} · ${c.start_date} → ${c.end_date} (${c.pct >= 0 ? '+' : ''}${c.pct?.toFixed(1)}%)`}
                  className={`px-1.5 py-1 text-center text-[10px] font-bold tabular-nums cursor-pointer transition-colors min-w-[52px]
                    ${isActive
                      ? isBull
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : isBull
                        ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        : 'text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                    }`}>
                  <div className="whitespace-nowrap">{isBull ? '▲' : '▼'} {isBull ? 'Bull' : 'Bear'} {num}</div>
                  <div className="text-[9px] font-normal opacity-70">{c.start_date?.slice(0, 7)}</div>
                </th>
              )
            })}
            {/* Sticky right: Total column. Same z-30 so it stays above active rings. */}
            <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 whitespace-nowrap sticky right-0 bg-white dark:bg-gray-900 z-30 border-l border-gray-200 dark:border-gray-700 shadow-[-1px_0_0_0_rgba(0,0,0,0.04)] dark:shadow-[-1px_0_0_0_rgba(255,255,255,0.04)]">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.sectors.map(s => {
            const total = totalReturn(s.returns)
            const shortName = s.name.replace(' Sub-Index','').replace(' Index','')
            const isNepse = s.index_id === 12
            return (
              <tr key={s.index_id} className="border-t border-gray-50 dark:border-gray-900">
                <td className={`px-2 py-1 text-[10px] whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900 z-20 max-w-[110px] truncate shadow-[1px_0_0_0_rgba(0,0,0,0.04)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.04)] ${isNepse ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                  {isNepse ? 'NEPSE' : shortName}
                </td>
                {s.returns.map((pct, ci) => {
                  const isActive = ci === activeIdx
                  return (
                    <td key={ci} className="px-0.5 py-0.5 text-center">
                      <div className="rounded text-[10px] font-semibold tabular-nums py-0.5 mx-0.5"
                        style={{
                          background: heatColor(pct, dark),
                          color: pct == null ? (dark ? '#4b5563' : '#d1d5db') : (dark ? '#f1f5f9' : '#1e293b'),
                          minWidth: 36,
                          boxShadow: isActive ? `inset 0 0 0 1.5px ${cycles[ci]?.type === 'bull' ? '#10b981' : '#ef4444'}` : 'none',
                        }}
                      >
                        {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}` : '—'}
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-1 text-center sticky right-0 bg-white dark:bg-gray-900 z-20 border-l border-gray-200 dark:border-gray-700 shadow-[-1px_0_0_0_rgba(0,0,0,0.04)] dark:shadow-[-1px_0_0_0_rgba(255,255,255,0.04)]">
                  <span className={`text-[10px] font-bold tabular-nums ${pctTextCls(total)}`}>
                    {total != null ? `${total >= 0 ? '+' : ''}${total.toFixed(0)}%` : '—'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR MATRIX — visual replacement of the old sector table
// ─────────────────────────────────────────────────────────────────────────────
function SectorMatrix({ rows, activeSectorName, onRowClick, cycleType, sortBy, sortAsc, onSort, maxMoveAbs }) {
  const isBull = cycleType === 'bull'

  const Glyph = ({ col, label, w }) => (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 ${LABEL} normal-case hover:text-gray-600 dark:hover:text-gray-300`}
      style={{ width: w }}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-60">
        {sortBy === col ? (sortAsc ? '▲' : '▼') : '·'}
      </span>
    </button>
  )

  return (
    <div className={`${CARD} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
        <Glyph col="index_name" label="Sector" w={150} />
        <Glyph col="drop_pct" label={isBull ? 'Gain' : 'Drop'} w={170} />
        <Glyph col="vs_nepse" label="vs Index" w={70} />
        {!isBull && <Glyph col="recovery_progress" label="Recovery" w={120} />}
        {!isBull && <Glyph col="recovery_days" label="Days" w={50} />}
        <Glyph col="stock_count" label="#" w={36} />
      </div>

      {/* Rows */}
      <div>
        {rows.map((s, i) => {
          const isActive = activeSectorName === s.index_name
          const isNepse  = s.index_name === 'NEPSE'
          const moveAbs  = Math.abs(s.drop_pct || 0)
          const barW     = maxMoveAbs > 0 ? (moveAbs / maxMoveAbs) * 100 : 0
          // x in [-1,1] for continuous gradient: clip at ±50% magnitude
          const x = Math.max(-1, Math.min(1, (s.drop_pct || 0) / 50))
          const barColor = gradColor(x)
          return (
            <div key={s.index_name}
              onClick={() => onRowClick(s)}
              className={`flex items-center px-3 py-2 border-b border-gray-50 dark:border-gray-800/60 cursor-pointer transition-colors last:border-b-0
                ${isActive
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : i % 2 === 1
                    ? 'bg-gray-50/60 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40'
                    : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                }`}
            >
              {/* Sector */}
              <div className="flex items-center gap-2" style={{ width: 150 }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: barColor }} />
                <span className={`text-[11px] ${isNepse ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-100'} truncate`}>
                  {isNepse ? 'NEPSE' : s.index_name.replace(' Sub-Index','').replace(' Index','')}
                </span>
              </div>

              {/* Move bar */}
              <div className="flex items-center gap-2" style={{ width: 170 }}>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0" style={{ width: 90 }}>
                  <div className="h-full rounded-full" style={{ width: `${barW}%`, background: barColor }} />
                </div>
                <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(s.drop_pct)}`}>
                  {s.drop_pct != null ? `${s.drop_pct >= 0 ? '+' : ''}${s.drop_pct.toFixed(1)}%` : '—'}
                </span>
              </div>

              {/* vs Index */}
              <div style={{ width: 70 }}>
                {s.vs_nepse != null ? (
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums
                    ${s.vs_nepse >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400'
                    }`}>
                    {s.vs_nepse >= 0 ? '+' : ''}{s.vs_nepse.toFixed(1)}%
                  </span>
                ) : <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>}
              </div>

              {/* Recovery (bear only): horizontal progress bar — matches the move-bar style above
                  for visual consistency. Fully recovered = emerald solid; partial = amber. */}
              {!isBull && (
                <div className="flex items-center gap-2" style={{ width: 120 }}>
                  {s.recovery_progress != null ? (
                    <>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0" style={{ width: 70 }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, s.recovery_progress)}%`,
                            background: s.fully_recovered ? '#10b981' : '#f59e0b',
                          }} />
                      </div>
                      <span className={`text-[10px] font-semibold tabular-nums ${s.fully_recovered ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {(s.recovery_progress || 0).toFixed(0)}%
                      </span>
                    </>
                  ) : <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>}
                </div>
              )}

              {/* Recovery days */}
              {!isBull && (
                <div style={{ width: 50 }}>
                  {s.fully_recovered && s.recovery_days != null
                    ? <span className="text-[10px] text-emerald-500 font-semibold tabular-nums">{s.recovery_days}d</span>
                    : <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                  }
                </div>
              )}

              {/* Stock count */}
              <div style={{ width: 36 }}>
                {s.stock_count == null ? null
                  : <span className="text-[10px] text-gray-400 tabular-nums">{s.stock_count}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK LIST — used inline inside the right panel (sector zoom)
// ─────────────────────────────────────────────────────────────────────────────
function StockList({ stocks, loading, onSelect, selected }) {
  const [sortBy,  setSortBy]  = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  const toggleSort = col => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(true) }
  }

  if (loading) return <Skeleton minH={140} />
  if (stocks === undefined) return null
  const valid = (stocks || []).filter(s => s.drop_pct != null)
  if (!stocks?.length) return (
    <div className="flex flex-col items-center justify-center py-5 gap-1 text-center px-4">
      <span className="text-[11px] text-gray-400">No stocks found for this sector.</span>
    </div>
  )
  if (!valid.length) return (
    <div className="flex items-center justify-center py-5 text-[11px] text-gray-400">
      {stocks.length} stocks · no price data for this period
    </div>
  )

  const sorted = [...valid].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const SortTh = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {label}{sortBy === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-10">
          <tr>
            <SortTh col="symbol" label="Symbol" />
            <SortTh col="drop_pct" label="Move" right />
            <SortTh col="recovery_progress" label="Rec" right />
            <SortTh col="recovery_days" label="Days" right />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.symbol}
              onClick={() => onSelect(selected?.symbol === s.symbol ? null : s)}
              className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors
                ${selected?.symbol === s.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : i % 2 === 1
                    ? 'bg-gray-50/80 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                    : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/60'
                }`}
            >
              <td className="px-2 py-1.5">
                <span className={STITLE}>{s.symbol}</span>
                <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{s.company_name}</div>
              </td>
              <td className="px-2 py-1.5 text-right">
                <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(s.drop_pct)}`}>
                  {s.drop_pct >= 0 ? '+' : ''}{s.drop_pct?.toFixed(1)}%
                </span>
              </td>
              <td className="px-2 py-1.5 text-right">
                <span className="text-[10px] text-gray-500 tabular-nums">
                  {(s.recovery_progress || 0).toFixed(0)}%
                </span>
              </td>
              <td className="px-2 py-1.5 text-right">
                {s.fully_recovered
                  ? <span className="text-[10px] text-emerald-500 font-semibold tabular-nums">{s.recovery_days}d</span>
                  : <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR INDEX CHART (fetches its own data)
// ─────────────────────────────────────────────────────────────────────────────
function SectorIndexChart({ sector, cycle, dark }) {
  const [candles, setCandles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!sector || !cycle) return
    const ctrl = new AbortController()
    setCandles(null); setLoading(true); setError('')
    getSectorIndexChart(
      { index_name: sector.index_name, peak_date: cycle.start_date, trough_date: cycle.end_date },
      { signal: ctrl.signal }
    )
      .then(r => { if (!ctrl.signal.aborted) setCandles(r.data.candles || []) })
      .catch(e => { if (ctrl.signal.aborted || isCanceled(e)) return; setError(apiError(e, 'Failed to load chart')); setCandles([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [sector?.index_name, cycle?.start_date, cycle?.end_date])

  if (error) return (
    <div className="text-[11px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded">{error}</div>
  )
  return loading
    ? <Skeleton minH={260} />
    : <PriceChart candles={candles} startDate={cycle.start_date} endDate={cycle.end_date}
        type={cycle.type} dark={dark} label={sector.index_name.replace(' Sub-Index','').replace(' Index','')} height={260} />
}

// ─────────────────────────────────────────────────────────────────────────────
// RESILIENT TILE — compact, in right panel
// ─────────────────────────────────────────────────────────────────────────────
function ResilientTile({ sectors }) {
  const recovered = sectors.filter(s => s.fully_recovered && s.recovery_days != null)
    .sort((a, b) => a.recovery_days - b.recovery_days).slice(0, 3)
  const hardest = sectors.filter(s => s.drop_pct != null)
    .sort((a, b) => a.drop_pct - b.drop_pct).slice(0, 3)
  if (!recovered.length && !hardest.length) return null

  return (
    <div className={`${CARD} p-3`}>
      {recovered.length > 0 && (
        <div className="mb-2">
          <p className={`${LABEL} mb-1`}>Fastest recovery</p>
          <div className="flex flex-wrap gap-1.5">
            {recovered.map(s => (
              <span key={s.index_name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {s.index_name.replace(' Sub-Index','').replace(' Index','')} · {s.recovery_days}d
              </span>
            ))}
          </div>
        </div>
      )}
      {hardest.length > 0 && (
        <div>
          <p className={`${LABEL} mb-1`}>Hardest hit</p>
          <div className="flex flex-wrap gap-1.5">
            {hardest.map(s => (
              <span key={s.index_name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-[10px] font-semibold text-red-500 dark:text-red-400">
                {s.index_name.replace(' Sub-Index','').replace(' Index','')} · {s.drop_pct?.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE STATS TILE — fills right panel when no cycle is selected
// ─────────────────────────────────────────────────────────────────────────────
function AggregateStats({ bearCycles, bullCycles }) {
  const bear = bearCycles.length > 0 && (() => {
    const drops = bearCycles.map(c => c.pct)
    const avgDrop = drops.reduce((s, v) => s + v, 0) / drops.length
    const worst = Math.min(...drops)
    const avgDur = bearCycles.reduce((s, c) => s + c.duration_days, 0) / bearCycles.length
    const withRecov = bearCycles.filter(c => c.recovery_days)
    const avgRecov = withRecov.length
      ? Math.round(withRecov.reduce((s, c) => s + c.recovery_days, 0) / withRecov.length)
      : null
    return [
      { l: 'Avg drop',     v: `${avgDrop.toFixed(1)}%`,                                       red: true },
      { l: 'Worst',        v: `${worst.toFixed(1)}%`,                                         red: true },
      { l: 'Avg duration', v: `${Math.round(avgDur)}d` },
      { l: 'Avg recovery', v: avgRecov ? `${avgRecov}d` : '—',                                green: true },
      { l: 'Recovery rate',v: `${Math.round(withRecov.length / bearCycles.length * 100)}%`,   green: true },
    ]
  })()

  const bull = bullCycles.length > 0 && (() => {
    const gains = bullCycles.map(c => c.pct)
    const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length
    const best = Math.max(...gains)
    const avgDur = bullCycles.reduce((s, c) => s + c.duration_days, 0) / bullCycles.length
    return [
      { l: 'Avg gain',     v: `+${avgGain.toFixed(1)}%`, green: true },
      { l: 'Best',         v: `+${best.toFixed(1)}%`,    green: true },
      { l: 'Avg duration', v: `${Math.round(avgDur)}d` },
    ]
  })()

  const bullPhases = bullCycles.length > 0 ? {
    rally:  bullCycles.filter(c => c.phase === 'Rally').length,
    run:    bullCycles.filter(c => c.phase === 'Bull Run').length,
    major:  bullCycles.filter(c => c.phase === 'Major Bull').length,
  } : null

  const bearPhases = bearCycles.length > 0 ? {
    correction: bearCycles.filter(c => c.phase === 'Correction').length,
    bear:       bearCycles.filter(c => c.phase === 'Bear Market').length,
    crash:      bearCycles.filter(c => c.phase === 'Crash').length,
  } : null

  return (
    <div className="space-y-3">
      <div className={`${CARD} p-3`}>
        <p className={`${LABEL} text-gray-400 mb-1.5`}>Select a cycle</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          Click a pill on the left or a shaded band on the overview chart to see sector-level breakdown.
        </p>
      </div>

      {bear && (
        <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`${LABEL} text-red-400`}>Bear Cycles</p>
            <p className="text-xl font-black text-red-500 tabular-nums leading-none">{bearCycles.length}</p>
          </div>
          <div className="space-y-1 mb-2">
            {bear.map(({ l, v, red, green }) => (
              <div key={l} className="flex justify-between text-[10px]">
                <span className="text-gray-400">{l}</span>
                <span className={`font-semibold ${red ? 'text-red-500' : green ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}>{v}</span>
              </div>
            ))}
          </div>
          {bearPhases && (
            <div className="flex gap-1 pt-2 border-t border-red-200/50 dark:border-red-900/40">
              <PhaseChip label="Correction" n={bearPhases.correction} cls="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" />
              <PhaseChip label="Bear"       n={bearPhases.bear}       cls="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" />
              <PhaseChip label="Crash"      n={bearPhases.crash}      cls="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" />
            </div>
          )}
        </div>
      )}

      {bull && (
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`${LABEL} text-emerald-400`}>Bull Cycles</p>
            <p className="text-xl font-black text-emerald-500 tabular-nums leading-none">{bullCycles.length}</p>
          </div>
          <div className="space-y-1 mb-2">
            {bull.map(({ l, v, green }) => (
              <div key={l} className="flex justify-between text-[10px]">
                <span className="text-gray-400">{l}</span>
                <span className={`font-semibold ${green ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}>{v}</span>
              </div>
            ))}
          </div>
          {bullPhases && (
            <div className="flex gap-1 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/40">
              <PhaseChip label="Rally"   n={bullPhases.rally} cls="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" />
              <PhaseChip label="Bull"    n={bullPhases.run}   cls="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" />
              <PhaseChip label="Major"   n={bullPhases.major} cls="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE RAIL — compact 2-line pills
// ─────────────────────────────────────────────────────────────────────────────
function CyclePill({ cycle, active, onClick }) {
  const isBear = cycle.type === 'bear'
  const phaseTone = phaseCls(cycle.phase)
  return (
    <button onClick={onClick}
      title={`${cycle.phase} · ${cycle.start_date} → ${cycle.end_date} · ${cycle.duration_days}d`}
      className={`w-full text-left px-3 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 transition-colors
        ${active
          ? isBear ? 'bg-red-50 dark:bg-red-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
        }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[10px] font-bold ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
          {isBear ? '▼' : '▲'} {cycle.name || (isBear ? 'Bear' : 'Bull')}
        </span>
        <span className={`text-[10px] font-black tabular-nums ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
          {cycle.pct >= 0 ? '+' : ''}{cycle.pct?.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-500 dark:text-gray-400">
          <span className="font-mono text-gray-400">{cycle.start_date?.slice(0, 4)}</span> · {cycle.duration_days}d
          {isBear && (
            cycle.recovery_date
              ? <span className="text-emerald-500"> · Rec {cycle.recovery_days}d</span>
              : <span className="text-amber-500"> · Open</span>
          )}
        </span>
        <span className={`px-1 rounded-sm text-[10px] font-semibold ${phaseTone}`}>{cycle.phase}</span>
      </div>
    </button>
  )
}

// Memoized index selector
const IndexSelector = memo(function IndexSelector({ options, activeId, onSelect }) {
  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {options.map(opt => (
        <button key={opt.id} onClick={() => onSelect(opt.id)}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
            opt.id === activeId
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}>
          {opt.short}
        </button>
      ))}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function BreakdownPage() {
  const { isDark } = useTheme()

  // Core state
  const [indexId,     setIndexId]     = useState(12)
  const [threshold,   setThreshold]   = useState(10)
  const [cycles,      setCycles]      = useState([])
  const [allCandles,  setAllCandles]  = useState([])
  const [detecting,   setDetecting]   = useState(false)
  const [detectError, setDetectError] = useState('')

  const [activeCycle,  setActiveCycle]  = useState(null)
  const [analysis,     setAnalysis]     = useState(null)
  const [analyzing,    setAnalyzing]    = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  const [activeSector,  setActiveSector]  = useState(null)
  const [sectorStocks,  setSectorStocks]  = useState({})
  const [sectorLoading, setSectorLoading] = useState({})
  const sectorStocksRef = useRef({})

  const [selectedStock, setSelectedStock] = useState(null)
  const [stockCandles,  setStockCandles]  = useState(null)
  const [stockLoading,  setStockLoading]  = useState(false)
  const [stockError,    setStockError]    = useState('')

  const [sortBy,  setSortBy]  = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  const [cycleFilter, setCycleFilter] = useState('all')
  const [mobileCycles, setMobileCycles] = useState(false)


  // Detect cycles (Rule 45 — abort superseded)
  const detectCtrlRef = useRef(null)
  const detectCycles = useCallback(async (thresh, idxId) => {
    if (detectCtrlRef.current) detectCtrlRef.current.abort()
    const ctrl = new AbortController()
    detectCtrlRef.current = ctrl
    setDetecting(true); setDetectError('')
    try {
      const { data } = await getMarketCycles({ threshold: thresh, index_id: idxId }, { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      // Inject canonical names: Bull 1, Bear 1, Bull 2... in chronological order.
      // Backend already sorts by start_date ascending.
      let b = 0, be = 0
      const named = (data.cycles || []).map(c => ({
        ...c,
        name: c.type === 'bull' ? `Bull ${++b}` : `Bear ${++be}`,
      }))
      setCycles(named)
      setAllCandles(data.candles || [])
      setActiveCycle(null); setAnalysis(null)
      setActiveSector(null); setSelectedStock(null); setStockCandles(null)
      sectorStocksRef.current = {}
      setSectorStocks({}); setSectorLoading({})
    } catch (e) {
      if (ctrl.signal.aborted || isCanceled(e)) return
      setDetectError(apiError(e, 'Failed to detect cycles'))
    }
    if (!ctrl.signal.aborted) setDetecting(false)
  }, [])

  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    detectCycles(threshold, indexId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndexSelect = useCallback((id) => {
    if (id === indexId) return
    setIndexId(id)
    detectCycles(threshold, id)
  }, [indexId, threshold, detectCycles])

  // AbortController refs hoisted together so runAnalysis can cancel sibling
  // requests (sector-stocks, stock-chart) when the user switches cycles.
  const analysisCtrlRef     = useRef(null)
  const stockChartCtrlRef   = useRef(null)

  // Run analysis for a selected cycle (Rule 45)
  const runAnalysis = useCallback(async (cycle) => {
    if (analysisCtrlRef.current) analysisCtrlRef.current.abort()
    // Also abort any in-flight sector-stocks or stock-chart fetches from the
    // previous cycle so their stale data can't write into state for the new cycle.
    if (sectorStocksCtrlRef.current) sectorStocksCtrlRef.current.abort()
    if (stockChartCtrlRef.current)   stockChartCtrlRef.current.abort()
    const ctrl = new AbortController()
    analysisCtrlRef.current = ctrl
    setActiveCycle(cycle); setAnalysis(null); setAnalyzeError('')
    setActiveSector(null)
    sectorStocksRef.current = {}
    setSectorStocks({}); setSectorLoading({})
    setSelectedStock(null); setStockCandles(null); setStockError('')
    setAnalyzing(true)
    try {
      const { data } = await runDropAnalysis(
        { peak_date: cycle.start_date, trough_date: cycle.end_date },
        { signal: ctrl.signal }
      )
      if (ctrl.signal.aborted) return
      setAnalysis(data)
    } catch (e) {
      if (ctrl.signal.aborted || isCanceled(e)) return
      setAnalyzeError(apiError(e, 'Failed to run analysis'))
    }
    if (!ctrl.signal.aborted) setAnalyzing(false)
  }, [])

  // Load sector stocks lazily (Rule 45 — abort last superseded sector fetch)
  const sectorStocksCtrlRef = useRef(null)
  const loadSectorStocks = useCallback(async (indexName, peakDate, troughDate) => {
    if (sectorStocksRef.current[indexName] !== undefined) return
    if (sectorStocksCtrlRef.current) sectorStocksCtrlRef.current.abort()
    const ctrl = new AbortController()
    sectorStocksCtrlRef.current = ctrl
    sectorStocksRef.current[indexName] = null
    setSectorLoading(prev => ({ ...prev, [indexName]: true }))
    try {
      const { data } = await getSectorStocks(
        { sector_index: indexName, peak_date: peakDate, trough_date: troughDate },
        { signal: ctrl.signal }
      )
      if (ctrl.signal.aborted) return
      const stocks = data.stocks || []
      sectorStocksRef.current[indexName] = stocks
      setSectorStocks(prev => ({ ...prev, [indexName]: stocks }))
    } catch (e) {
      if (ctrl.signal.aborted || isCanceled(e)) return
      sectorStocksRef.current[indexName] = []
      setSectorStocks(prev => ({ ...prev, [indexName]: [] }))
    }
    if (!ctrl.signal.aborted) setSectorLoading(prev => ({ ...prev, [indexName]: false }))
  }, [])

  const handleSectorClick = useCallback((sector) => {
    if (!activeCycle) return
    const isNepse = sector.index_name === 'NEPSE'
    const next    = activeSector?.index_name === sector.index_name ? null : sector
    setActiveSector(next)
    setSelectedStock(null); setStockCandles(null); setStockError('')
    if (next && !isNepse) {
      loadSectorStocks(next.index_name, activeCycle.start_date, activeCycle.end_date)
    }
  }, [activeCycle, activeSector, loadSectorStocks])

  // Stock chart (ctrl ref hoisted above with the others)
  const loadStockChart = useCallback(async (stock) => {
    if (!activeCycle) return
    if (stockChartCtrlRef.current) stockChartCtrlRef.current.abort()
    const ctrl = new AbortController()
    stockChartCtrlRef.current = ctrl
    setSelectedStock(stock); setStockCandles(null); setStockLoading(true); setStockError('')
    try {
      const addDays = (iso, n) => {
        const d = new Date(iso + 'T00:00:00Z')
        d.setUTCDate(d.getUTCDate() + n)
        return d.toISOString().slice(0, 10)
      }
      const fromStr = addDays(activeCycle.start_date, -20)
      const today   = new Date().toISOString().slice(0, 10)
      const rawTo   = addDays(activeCycle.end_date, 120)
      const toStr   = rawTo < today ? rawTo : today
      const { data } = await getStockPriceRange(
        { symbol: stock.symbol, from: fromStr, to: toStr },
        { signal: ctrl.signal }
      )
      if (!ctrl.signal.aborted) setStockCandles(data.candles || [])
    } catch (e) {
      if (!ctrl.signal.aborted) { setStockError(apiError(e, 'Failed to load stock chart')); setStockCandles([]) }
    }
    if (!ctrl.signal.aborted) setStockLoading(false)
  }, [activeCycle])

  const handleStockSelect = useCallback((stock) => {
    if (!stock || selectedStock?.symbol === stock.symbol) {
      setSelectedStock(null); setStockCandles(null); setStockError('')
    } else {
      loadStockChart(stock)
    }
  }, [selectedStock, loadStockChart])

  const toggleSort = useCallback(col => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(false) }
  }, [sortBy])

  // Derived values (memoized — Rule 37)
  const sectors    = useMemo(() => analysis?.sectors || [], [analysis])
  const summary    = analysis?.summary
  const maxMoveAbs = useMemo(
    () => Math.max(...sectors.map(s => Math.abs(s.drop_pct || 0)), 1),
    [sectors]
  )

  const nepseRow = useMemo(() => summary ? {
    index_name:        'NEPSE',
    drop_pct:          summary.drop_pct,
    drop_pts:          summary.drop_pts,
    vs_nepse:          null,
    recovery_pct:      summary.recovery_pct,
    recovery_progress: summary.recovery_progress,
    recovery_days:     summary.recovery_days,
    fully_recovered:   summary.fully_recovered,
    stock_count:       null,
    trading_days:      summary.duration_days,
  } : null, [summary])

  const sortedSectors = useMemo(() => [...sectors].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
    const diff = sortAsc ? av - bv : bv - av
    return diff !== 0 ? diff : (a.index_name ?? '').localeCompare(b.index_name ?? '')
  }), [sectors, sortBy, sortAsc])

  const matrixRows = useMemo(() => (
    nepseRow ? [nepseRow, ...sortedSectors] : sortedSectors
  ), [nepseRow, sortedSectors])

  const bearCycles = useMemo(() => cycles.filter(c => c.type === 'bear'), [cycles])
  const bullCycles = useMemo(() => cycles.filter(c => c.type === 'bull'), [cycles])
  const filteredCycles = useMemo(() => (
    cycleFilter === 'all' ? cycles : cycles.filter(c => c.type === cycleFilter)
  ), [cycles, cycleFilter])

  const selectedIndexLabel = INDEX_OPTIONS.find(o => o.id === indexId)?.label || 'NEPSE'

  const cycleCandles = useMemo(() => {
    if (!activeCycle || !allCandles.length) return []
    const from = new Date(activeCycle.start_date); from.setDate(from.getDate() - 30)
    const to   = new Date(activeCycle.end_date);   to.setDate(to.getDate() + 200)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr   = to.toISOString().slice(0, 10)
    return allCandles.filter(c => c.date >= fromStr && c.date <= toStr)
  }, [activeCycle, allCandles])

  // Toolbar (no view tabs)
  const toolbar = useToolbarSlot(
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
      <IndexSelector options={INDEX_OPTIONS} activeId={indexId} onSelect={handleIndexSelect} />

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <span className={`${LABEL} normal-case`}>Swing ≥</span>
        <input type="number" value={threshold} min={5} max={50} step={1}
          onChange={e => setThreshold(parseFloat(e.target.value) || 10)}
          onKeyDown={e => { if (e.key === 'Enter') detectCycles(threshold, indexId) }}
          className="w-10 text-[10px] font-semibold text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
        <span className={`${LABEL} normal-case`}>%</span>
        <button onClick={() => detectCycles(threshold, indexId)} disabled={detecting}
          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-80 disabled:opacity-40 transition-opacity">
          {detecting ? '…' : 'Detect'}
        </button>
      </div>

      {cycles.length > 0 && (
        <span className={`${LABEL} normal-case hidden sm:inline`}>
          {bearCycles.length}▼ {bullCycles.length}▲ · {selectedIndexLabel}
        </span>
      )}

      {cycles.length > 0 && (
        <button className="lg:hidden flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
          onClick={() => setMobileCycles(true)}>
          {activeCycle ? `${activeCycle.type === 'bear' ? '▼' : '▲'} ${activeCycle.name || activeCycle.start_date?.slice(0,7)}` : `Cycles (${cycles.length})`}
        </button>
      )}
    </div>
  )

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 overflow-hidden">
      {toolbar}

      {detectError && (
        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/40 text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{detectError}</span>
          <button onClick={() => setDetectError('')} className="text-red-400 hover:text-red-600 font-bold ml-4">×</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── CYCLE RAIL (desktop ≥ lg) ── */}
        <div className="hidden lg:flex w-[200px] shrink-0 border-r border-gray-100 dark:border-gray-800 flex-col overflow-hidden bg-white dark:bg-gray-950">
          <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
            {[['all','All'], ['bear','Bear'], ['bull','Bull']].map(([v, l]) => (
              <button key={v} onClick={() => setCycleFilter(v)}
                className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors
                  ${cycleFilter === v
                    ? v === 'bear' ? 'text-red-500 border-b-2 border-red-500'
                    : v === 'bull' ? 'text-emerald-500 border-b-2 border-emerald-500'
                    : 'text-gray-700 dark:text-gray-200 border-b-2 border-gray-700 dark:border-gray-200'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                {l} {v === 'bear' ? bearCycles.length : v === 'bull' ? bullCycles.length : cycles.length}
              </button>
            ))}
          </div>

          {detecting && <Skeleton minH={120} />}

          <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-950 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            {filteredCycles.map((c, i) => (
              <CyclePill key={i} cycle={c}
                active={activeCycle?.start_date === c.start_date}
                onClick={() => runAnalysis(c)} />
            ))}
            {!detecting && filteredCycles.length === 0 && (
              <div className="flex items-center justify-center py-6 text-[10px] text-gray-400">
                No {cycleFilter !== 'all' ? cycleFilter : ''} cycles detected
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER ── */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-gray-50/50 dark:bg-gray-950/40 px-4 py-3 space-y-3">
          {/* Mini overview — explicit detecting/empty/ready states (no ambiguous blank box) */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className={STITLE}>{selectedIndexLabel} — Full History</span>
              <span className={`${LABEL} normal-case`}>
                {detecting ? 'Detecting…' : allCandles.length === 0 ? 'No data' : 'Click a shaded zone'}
              </span>
            </div>
            {detecting && allCandles.length === 0 ? (
              <div className="h-[160px] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Loading {selectedIndexLabel} history…</span>
              </div>
            ) : allCandles.length === 0 ? (
              <div className="h-[160px] flex items-center justify-center text-[11px] text-gray-400">No price data available</div>
            ) : (
              <MiniOverview candles={allCandles} cycles={cycles}
                activeCycle={activeCycle} onCycleClick={runAnalysis} dark={isDark} />
            )}
          </div>

          {/* Sector matrix */}
          {activeCycle && (
            <>
              {analyzeError && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
                  <span>{analyzeError}</span>
                  <button onClick={() => setAnalyzeError('')} className="font-bold ml-4">×</button>
                </div>
              )}

              {analyzing ? (
                <div className={`${CARD}`}><Skeleton minH={260} /></div>
              ) : sectors.length === 0 ? (
                <div className={`${CARD} flex items-center justify-center py-6 text-[11px] text-gray-400`}>
                  No sector data for this cycle
                </div>
              ) : (
                <SectorMatrix rows={matrixRows}
                  activeSectorName={activeSector?.index_name}
                  onRowClick={handleSectorClick}
                  cycleType={activeCycle.type}
                  sortBy={sortBy} sortAsc={sortAsc} onSort={toggleSort}
                  maxMoveAbs={maxMoveAbs} />
              )}
            </>
          )}

          {/* Mobile-only detail card (no right panel below md) */}
          {activeCycle && (
            <div className="md:hidden space-y-3">
              <div className={`${CARD} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-black ${activeCycle.type === 'bull' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {activeCycle.type === 'bull' ? '▲' : '▼'} {activeCycle.name || (activeCycle.type === 'bull' ? 'Bull' : 'Bear')}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${phaseCls(activeCycle.phase)}`}>{activeCycle.phase}</span>
                  <span className={`text-[15px] font-black tabular-nums ml-auto
                    ${activeCycle.type === 'bull' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {activeCycle.pct >= 0 ? '+' : ''}{activeCycle.pct?.toFixed(1)}%
                  </span>
                </div>
                {selectedStock ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => handleStockSelect(selectedStock)}
                        className="text-[10px] text-gray-400">← back</button>
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{selectedStock.symbol}</span>
                    </div>
                    {stockLoading
                      ? <Skeleton minH={220} />
                      : <PriceChart candles={stockCandles} startDate={activeCycle.start_date}
                          endDate={activeCycle.end_date} type={activeCycle.type} dark={isDark}
                          label={selectedStock.symbol} height={220} />}
                  </>
                ) : activeSector && activeSector.index_name !== 'NEPSE' ? (
                  <SectorIndexChart sector={activeSector} cycle={activeCycle} dark={isDark} />
                ) : (
                  <PriceChart candles={cycleCandles} startDate={activeCycle.start_date}
                    endDate={activeCycle.end_date} type={activeCycle.type} dark={isDark}
                    label={selectedIndexLabel} height={220} />
                )}
              </div>

              {activeSector && activeSector.index_name !== 'NEPSE' && (
                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                    <span className={STITLE}>{activeSector.index_name.replace(' Sub-Index','').replace(' Index','')}</span>
                    <button onClick={() => handleSectorClick(activeSector)}
                      className="text-gray-300 hover:text-gray-500 text-[14px] leading-none ml-auto">×</button>
                  </div>
                  <div className="max-h-[260px] overflow-auto">
                    <StockList stocks={sectorStocks[activeSector.index_name]}
                      loading={!!sectorLoading[activeSector.index_name]}
                      onSelect={handleStockSelect} selected={selectedStock} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sector × Cycle Matrix */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className={STITLE}>Sector × Cycle Returns</span>
              <span className={`${LABEL} normal-case ml-2 hidden sm:inline`}>compounded % per bull/bear cycle</span>
              {activeCycle && (
                <span className={`${LABEL} normal-case ml-auto`}>
                  Active: <span className={activeCycle.type === 'bull' ? 'text-emerald-500' : 'text-red-400'}>
                    {activeCycle.type === 'bull' ? '▲' : '▼'} {activeCycle.name || activeCycle.start_date?.slice(0,7)}
                  </span>
                </span>
              )}
            </div>
            <SectorCycleMatrix
              cycles={cycles}
              activeCycle={activeCycle}
              onCycleSelect={runAnalysis}
              dark={isDark}
            />
          </div>
        </div>

        {/* ── RIGHT PANEL (≥ md) ── */}
        <div className="hidden md:flex w-[360px] lg:w-[420px] shrink-0 border-l border-gray-100 dark:border-gray-800 flex-col min-h-0 bg-white dark:bg-gray-950">
          {!activeCycle ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-950 p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
              <AggregateStats bearCycles={bearCycles} bullCycles={bullCycles} />
            </div>
          ) : (
            <>
              {/* Header — text colors bumped to -700/-300 for AA contrast on tinted bg */}
              <div className={`shrink-0 px-3 py-2 border-b
                ${activeCycle.type === 'bull'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'
                  : 'bg-red-50/70 dark:bg-red-950/20 border-red-100 dark:border-red-900/40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-black ${activeCycle.type === 'bull' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                    {activeCycle.type === 'bull' ? '▲' : '▼'} {activeCycle.name || (activeCycle.type === 'bull' ? 'Bull' : 'Bear')}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${phaseCls(activeCycle.phase)}`}>
                    {activeCycle.phase}
                  </span>
                  <span className={`text-[18px] font-black tabular-nums ml-auto
                    ${activeCycle.type === 'bull' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                    {activeCycle.pct >= 0 ? '+' : ''}{activeCycle.pct?.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mb-1">
                  {activeCycle.start_date} → {activeCycle.end_date} · {activeCycle.duration_days}d
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                  {activeCycle.start_close != null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>From </span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                        {(+activeCycle.start_close).toLocaleString()}
                      </span>
                    </span>
                  )}
                  {activeCycle.end_close != null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>To </span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                        {(+activeCycle.end_close).toLocaleString()}
                      </span>
                    </span>
                  )}
                  {activeCycle.type === 'bear' && activeCycle.recovery_needed_pct != null && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>Need </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{activeCycle.recovery_needed_pct.toFixed(1)}%
                      </span>
                    </span>
                  )}
                  {activeCycle.type === 'bear' && activeCycle.recovery_date && (
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className={LABEL}>Recovered </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {activeCycle.recovery_date}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-950 p-3 space-y-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                {/* Chart: cycle / sector / stock */}
                <div className={`${CARD} p-2`}>
                  {selectedStock ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => handleStockSelect(selectedStock)}
                          className="text-[10px] text-gray-400 hover:text-gray-600">← back</button>
                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{selectedStock.symbol}</span>
                        <span className={`text-[10px] font-bold ml-auto ${pctTextCls(selectedStock.drop_pct)}`}>
                          {selectedStock.drop_pct != null ? `${selectedStock.drop_pct >= 0 ? '+' : ''}${selectedStock.drop_pct.toFixed(1)}%` : ''}
                        </span>
                      </div>
                      {stockError && (
                        <div className="text-[10px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded mb-1">{stockError}</div>
                      )}
                      {stockLoading
                        ? <Skeleton minH={260} />
                        : <PriceChart candles={stockCandles}
                            startDate={activeCycle.start_date} endDate={activeCycle.end_date}
                            type={activeCycle.type} dark={isDark}
                            label={selectedStock.symbol} height={260} />
                      }
                    </div>
                  ) : activeSector && activeSector.index_name !== 'NEPSE' ? (
                    <SectorIndexChart sector={activeSector} cycle={activeCycle} dark={isDark} />
                  ) : (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 font-mono">
                        {selectedIndexLabel}
                      </p>
                      <PriceChart candles={cycleCandles}
                        startDate={activeCycle.start_date} endDate={activeCycle.end_date}
                        type={activeCycle.type} dark={isDark}
                        label={selectedIndexLabel} height={260} />
                    </div>
                  )}
                </div>

                {/* Stat strip */}
                {summary && (
                  <div className={`${CARD} px-3 py-2 flex divide-x divide-gray-100 dark:divide-gray-800`}>
                    <Stat l="Move"   v={`${activeCycle.pct >= 0 ? '+' : ''}${activeCycle.pct?.toFixed(1)}%`}
                      tone={activeCycle.type === 'bull' ? 'green' : 'red'} />
                    <Stat l="Days"   v={`${activeCycle.duration_days}`} />
                    {activeCycle.type === 'bear' && (
                      <>
                        <Stat l="Rec %" v={summary.recovery_pct != null ? `${summary.recovery_pct >= 0 ? '+' : ''}${summary.recovery_pct.toFixed(1)}%` : '—'}
                          tone={summary.recovery_pct > 0 ? 'green' : 'gray'} />
                        <Stat l="Rec d" v={activeCycle.recovery_days != null ? `${activeCycle.recovery_days}` : '—'}
                          tone={activeCycle.recovery_date ? 'green' : 'amber'} />
                      </>
                    )}
                  </div>
                )}

                {/* Sector zoom: stocks inline */}
                {activeSector && activeSector.index_name !== 'NEPSE' && (
                  <div className={`${CARD} overflow-hidden`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                      <span className={STITLE}>
                        {activeSector.index_name.replace(' Sub-Index','').replace(' Index','')}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">click to chart</span>
                      <button onClick={() => handleSectorClick(activeSector)}
                        className="text-gray-300 hover:text-gray-500 text-[14px] leading-none">×</button>
                    </div>
                    <div className="max-h-[320px] overflow-auto">
                      <StockList stocks={sectorStocks[activeSector.index_name]}
                        loading={!!sectorLoading[activeSector.index_name]}
                        onSelect={handleStockSelect} selected={selectedStock} />
                    </div>
                  </div>
                )}

                {/* Resilience tile (bear only, after analysis) */}
                {activeCycle.type === 'bear' && !analyzing && sectors.length > 0 && (
                  <ResilientTile sectors={[...(nepseRow ? [nepseRow] : []), ...sectors]} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile cycles sheet */}
      {mobileCycles && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
               onClick={() => setMobileCycles(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                          bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t
                          border-gray-200 dark:border-gray-800"
               style={{ height: '72vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                {cycles.length} Cycles · {selectedIndexLabel}
              </span>
              <button onClick={() => setMobileCycles(false)}
                aria-label="Close cycles sheet"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[14px]">✕</button>
            </div>
            <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
              {[['all','All'], ['bear','Bear'], ['bull','Bull']].map(([v, l]) => (
                <button key={v} onClick={() => setCycleFilter(v)}
                  className={`flex-1 py-2 text-[10px] font-semibold transition-colors
                    ${cycleFilter === v
                      ? v === 'bear' ? 'text-red-500 border-b-2 border-red-500'
                      : v === 'bull' ? 'text-emerald-500 border-b-2 border-emerald-500'
                      : 'text-gray-700 dark:text-gray-200 border-b-2 border-gray-700 dark:border-gray-200'
                      : 'text-gray-400'}`}>
                  {l} {v === 'bear' ? bearCycles.length : v === 'bull' ? bullCycles.length : cycles.length}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-900">
              {filteredCycles.map((c, i) => (
                <CyclePill key={i} cycle={c}
                  active={activeCycle?.start_date === c.start_date}
                  onClick={() => { runAnalysis(c); setMobileCycles(false) }} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small phase-count chip used by AggregateStats
// ─────────────────────────────────────────────────────────────────────────────
function PhaseChip({ label, n, cls }) {
  return (
    <span className={`flex-1 inline-flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      <span>{label}</span>
      <span className="tabular-nums">{n}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small stat cell
// ─────────────────────────────────────────────────────────────────────────────
function Stat({ l, v, tone = 'gray' }) {
  const toneCls = tone === 'green' ? 'text-emerald-500'
    : tone === 'red'   ? 'text-red-500'
    : tone === 'amber' ? 'text-amber-500'
    : 'text-gray-700 dark:text-gray-200'
  return (
    <div className="flex-1 px-2 first:pl-0 last:pr-0">
      <p className={`${LABEL} mb-0.5`}>{l}</p>
      <p className={`${SVAL} ${toneCls}`}>{v}</p>
    </div>
  )
}
