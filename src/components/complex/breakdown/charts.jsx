// === charts — extracted verbatim from BreakdownPage.jsx (S2b Task 1, zero behavior change) ===
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getSectorIndexChart } from '../../../api'
import { apiError, isCanceled } from '../../../utils/format'
import { Skeleton } from '../../datalab/shared'
import { stripIndexName } from './helpers'
import { cycleKey } from './useCycleSelection'

// ─────────────────────────────────────────────────────────────────────────────
// PRICE CHART — SVG candlestick with hover tooltip, Y-axis, coloured zone
// ─────────────────────────────────────────────────────────────────────────────
export function PriceChart({
  candles,
  startDate,
  endDate,
  type = 'bear',
  dark,
  label = '',
  height = 260,
  // Optional synced crosshair (Compare mini charts, owner 2026-07-07): pass
  // hoverDate (ISO string | null) to control the crosshair by DATE, and onHover
  // to broadcast this chart's hover. Omit both → self-contained as before.
  hoverDate,
  onHover,
}) {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const [localHover, setLocalHover] = useState(null)
  const [w, setW] = useState(600)
  const controlled = hoverDate !== undefined
  // Controlled mode maps the shared date to this chart's own candle index —
  // exact match when the sides share trading days, else the next trading day.
  let hover = localHover
  if (controlled) {
    if (hoverDate == null || !candles?.length) hover = null
    else {
      const i = candles.findIndex((c) => c.date >= hoverDate)
      hover = i >= 0 ? i : null
    }
  }

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

  const VW = Math.max(280, Math.round(w)),
    VH = height
  const PAD = { top: 18, bottom: 26, left: 44, right: 10 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  const candleW = Math.max(
    1,
    Math.min(8, Math.floor(chartW / Math.max(candles?.length || 1, 1)) - 1)
  )

  const handleMouseMove = useCallback(
    (e) => {
      if (!svgRef.current || !candles?.length) return
      const rect = svgRef.current.getBoundingClientRect()
      const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
      const idx = Math.round((relX / chartW) * (candles.length - 1))
      const clamped = Math.max(0, Math.min(candles.length - 1, idx))
      onHover?.(candles[clamped]?.date ?? null)
      if (!controlled) setLocalHover(clamped)
    },
    [candles, chartW, onHover, controlled]
  )

  const handleMouseLeave = useCallback(() => {
    onHover?.(null)
    if (!controlled) setLocalHover(null)
  }, [onHover, controlled])

  if (!candles?.length)
    return (
      <div
        className="flex items-center justify-center text-[11px] text-gray-400"
        style={{ height: VH }}
      >
        No chart data
      </div>
    )

  const hasWicks = candles.some((c) => c.high != null && c.low != null)
  const allHigh = candles.map((c) =>
    hasWicks ? +c.high : Math.max(+(c.open ?? c.close), +c.close)
  )
  const allLow = candles.map((c) => (hasWicks ? +c.low : Math.min(+(c.open ?? c.close), +c.close)))
  const maxV = Math.max(...allHigh)
  const minV = Math.min(...allLow)
  const span = maxV - minV || 1

  const cx = (i) => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = (v) => PAD.top + (1 - (+v - minV) / span) * chartH

  const si = candles.findIndex((c) => c.date >= startDate)
  const ei = candles.findIndex((c) => c.date >= endDate)
  const zoneStart = si >= 0 ? si : 0
  const zoneEnd = ei >= 0 ? ei : candles.length - 1

  const zoneColor = type === 'bull' ? '#10b981' : '#ef4444'
  const zoneBg = type === 'bull' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'

  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const v = minV + (i / 3) * span
    return { v, y: cy(v) }
  })

  const dateTick = [...new Set([0, zoneStart, zoneEnd, candles.length - 1])].filter(
    (i) => i >= 0 && i < candles.length
  )

  const hoverCandle = hover !== null ? candles[hover] : null
  const hoverX = hover !== null ? cx(hover) : null
  const zStartClose = +candles[zoneStart]?.close
  const zEndClose = +candles[zoneEnd]?.close

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: VH }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <rect
          x={PAD.left}
          y={PAD.top}
          width={chartW}
          height={chartH}
          fill={dark ? '#0f172a' : '#fafafa'}
          rx="2"
        />

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={t.y}
              x2={PAD.left + chartW}
              y2={t.y}
              stroke={dark ? '#1e293b' : '#e5e7eb'}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 5}
              y={t.y + 3}
              textAnchor="end"
              fontSize="10"
              fontFamily="monospace"
              fill={dark ? '#475569' : '#94a3b8'}
            >
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        <rect
          x={cx(zoneStart)}
          y={PAD.top}
          width={Math.max(0, cx(zoneEnd) - cx(zoneStart))}
          height={chartH}
          fill={zoneBg}
        />
        <line
          x1={cx(zoneStart)}
          y1={PAD.top}
          x2={cx(zoneStart)}
          y2={PAD.top + chartH}
          stroke={zoneColor}
          strokeWidth="1.5"
          strokeDasharray="5,3"
          opacity="0.7"
        />
        <line
          x1={cx(zoneEnd)}
          y1={PAD.top}
          x2={cx(zoneEnd)}
          y2={PAD.top + chartH}
          stroke={zoneColor}
          strokeWidth="1.5"
          strokeDasharray="5,3"
          opacity="0.7"
        />

        {candles.map((c, i) => {
          const x = cx(i)
          const open = +(c.open ?? c.close)
          const close = +c.close
          const high = hasWicks ? +c.high : Math.max(open, close)
          const low = hasWicks ? +c.low : Math.min(open, close)
          const isUp = close >= open
          const inZone = i >= zoneStart && i <= zoneEnd
          let bodyColor, wickColor
          if (inZone) {
            bodyColor = isUp ? '#10b981' : '#ef4444'
            wickColor = bodyColor
          } else {
            bodyColor = isUp ? (dark ? '#1d4a34' : '#bbf7d0') : dark ? '#4a1d1d' : '#fecaca'
            wickColor = isUp ? (dark ? '#22c55e' : '#16a34a') : dark ? '#ef4444' : '#dc2626'
          }
          const bodyTop = cy(Math.max(open, close))
          const bodyBot = cy(Math.min(open, close))
          const bodyH = Math.max(1, bodyBot - bodyTop)
          return (
            <g key={i} opacity={hover === i ? 1 : 0.92}>
              <line
                x1={x}
                y1={cy(high)}
                x2={x}
                y2={cy(low)}
                stroke={wickColor}
                strokeWidth={hover === i ? 1.5 : 1}
              />
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={bodyColor}
                stroke={hover === i ? (dark ? '#fff' : '#1e293b') : 'none'}
                strokeWidth={0.5}
                rx="0.5"
              />
            </g>
          )
        })}

        {!isNaN(zStartClose) && (
          <text
            x={cx(zoneStart)}
            y={PAD.top - 7}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill={zoneColor}
          >
            {zStartClose.toFixed(0)}
          </text>
        )}
        {!isNaN(zEndClose) && (
          <text
            x={cx(zoneEnd)}
            y={PAD.top - 7}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill={zoneColor}
          >
            {zEndClose.toFixed(0)}
          </text>
        )}

        <line
          x1={PAD.left}
          y1={PAD.top + chartH}
          x2={PAD.left + chartW}
          y2={PAD.top + chartH}
          stroke={dark ? '#1e293b' : '#e5e7eb'}
          strokeWidth="1"
        />
        {dateTick.map((idx) => (
          <text
            key={idx}
            x={cx(idx)}
            y={VH - 6}
            textAnchor="middle"
            fontSize="9"
            fill={dark ? '#64748b' : '#94a3b8'}
          >
            {candles[idx]?.date?.slice(2, 10)}
          </text>
        ))}

        {hover !== null && hoverCandle && (
          <line
            x1={hoverX}
            y1={PAD.top}
            x2={hoverX}
            y2={PAD.top + chartH}
            stroke={dark ? '#64748b' : '#94a3b8'}
            strokeWidth="1"
            strokeDasharray="4,3"
          />
        )}

        {label && (
          <text
            x={PAD.left + 4}
            y={PAD.top + 12}
            fontSize="10"
            fontWeight="700"
            fill={dark ? '#475569' : '#94a3b8'}
          >
            {label}
          </text>
        )}
      </svg>

      {hover !== null && hoverCandle && (
        <div
          className="pointer-events-none absolute top-2 z-30 text-[10px] rounded-lg px-2.5 py-2 shadow-xl border whitespace-nowrap"
          style={{
            left: hoverX > VW * 0.6 ? undefined : `calc(${(hoverX / VW) * 100}% + 10px)`,
            right: hoverX > VW * 0.6 ? `calc(${((VW - hoverX) / VW) * 100}% + 10px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}
        >
          <div
            className="font-semibold mb-1 text-[10px]"
            style={{ color: dark ? '#94a3b8' : '#64748b' }}
          >
            {hoverCandle.date}
          </div>
          <div className="flex gap-2.5">
            <span className="text-gray-400">
              O{' '}
              <span className="font-semibold">
                {(+(hoverCandle.open ?? hoverCandle.close)).toLocaleString()}
              </span>
            </span>
            <span className="text-gray-400">
              C{' '}
              <span className="font-bold text-[11px]">{(+hoverCandle.close).toLocaleString()}</span>
            </span>
          </div>
          {hover >= zoneStart && hover <= zoneEnd && (
            <div style={{ color: zoneColor }} className="text-[10px] mt-0.5 font-medium">
              {type === 'bear' ? 'Drop' : 'Run'} day {hover - zoneStart + 1}
            </div>
          )}
          {type === 'bear' && hover > zoneEnd && (
            <div className="text-[10px] mt-0.5 text-emerald-500">
              Recovery day {hover - zoneEnd}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI OVERVIEW — full history, short height, click band to select cycle
// ─────────────────────────────────────────────────────────────────────────────
// Breakdown redesign Wave 1: the overview SHOWS the chosen date range; the
// From/To date boxes in the toolbar are the only way to set it (owner: one
// way to pick dates, no drag-zoom). `candles` is the full history and `view`
// ({ from, to } ISO dates, either may be null) picks the visible slice.
function sliceIdx(candles, view) {
  const n = candles?.length || 0
  if (!n || !view) return [0, Math.max(0, n - 1)]
  let a = view.from ? candles.findIndex((c) => c.date >= view.from) : 0
  if (a < 0) a = n - 1
  let b = n - 1
  if (view.to) {
    const j = candles.findIndex((c) => c.date > view.to)
    b = j < 0 ? n - 1 : Math.max(a, j - 1)
  }
  return [a, b]
}

export function MiniOverview({
  candles,
  cycles,
  selectedKeys = new Set(),
  focusedKey = null,
  onCycleClick,
  dark,
  view = null,
}) {
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

  const VW = Math.max(320, Math.round(w)),
    VH = 160
  const PAD = { top: 10, bottom: 20, left: 44, right: 8 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom
  const all = useMemo(() => candles || [], [candles])

  const [a, b] = useMemo(() => sliceIdx(all, view), [all, view])
  const visibleCandles = useMemo(() => all.slice(a, b + 1), [all, a, b])
  const visibleCycles = useMemo(
    () => (cycles || []).filter((c) => c.end_date >= all[a]?.date && c.start_date <= all[b]?.date),
    [cycles, all, a, b]
  )

  const idxAt = useCallback(
    (e) => {
      const rect = svgRef.current.getBoundingClientRect()
      const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
      return Math.max(
        0,
        Math.min(
          visibleCandles.length - 1,
          Math.round((relX / chartW) * (visibleCandles.length - 1))
        )
      )
    },
    [visibleCandles.length, VW, chartW, PAD.left]
  )

  const handleMouseMove = useCallback(
    (e) => {
      if (!svgRef.current || !visibleCandles.length) return
      setHover(idxAt(e))
    },
    [visibleCandles.length, idxAt]
  )

  // Band candle-indices are O(cycles × candles) to compute — memoized so hover
  // re-renders (every mousemove) don't rescan ~7k candles per cycle.
  const bands = useMemo(
    () =>
      visibleCycles
        .map((cyc) => {
          // A cycle cut by the range edge clamps to it (start → 0, end → last)
          const si = visibleCandles.findIndex((c) => c.date >= cyc.start_date)
          let ei = visibleCandles.findIndex((c) => c.date >= cyc.end_date)
          if (si < 0) return null
          if (ei < 0) ei = visibleCandles.length - 1
          return { cyc, si, ei }
        })
        .filter(Boolean),
    [visibleCandles, visibleCycles]
  )

  const handleClick = useCallback(
    (e) => {
      if (!svgRef.current || !visibleCandles.length) return
      const clamped = idxAt(e)
      // Direct hit
      const hit = bands.find((bd) => clamped >= bd.si && clamped <= bd.ei)
      if (hit) {
        onCycleClick(hit.cyc)
        return
      }
      // Grace fallback: tiny bands (< ~6px wide) are hard to land on. Pick the
      // nearest cycle whose midpoint is within a 1.5% candle-index radius of the click.
      const grace = Math.max(3, Math.round(visibleCandles.length * 0.015))
      let bestDist = Infinity,
        bestCycle = null
      for (const bd of bands) {
        const dist = Math.abs(clamped - (bd.si + bd.ei) / 2)
        if (dist <= grace && dist < bestDist) {
          bestDist = dist
          bestCycle = bd.cyc
        }
      }
      if (bestCycle) onCycleClick(bestCycle)
    },
    [visibleCandles.length, bands, idxAt, onCycleClick]
  )

  if (!visibleCandles.length) return <div style={{ height: VH }} />

  const allVals = visibleCandles.flatMap((c) => [+(c.open ?? c.close), +c.close])
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const span = maxV - minV || 1

  const cx = (i) => PAD.left + (i / Math.max(1, visibleCandles.length - 1)) * chartW
  const cy = (v) => PAD.top + (1 - (+v - minV) / span) * chartH

  // Line path
  const linePath = visibleCandles
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${cy(+c.close)}`)
    .join(' ')

  // Cursor: pointer when hovering inside a clickable cycle band, default otherwise
  const inBand = hover != null && bands.some((bd) => hover >= bd.si && hover <= bd.ei)

  const yTicks = [0, 0.5, 1].map((f) => ({ v: minV + f * span, y: cy(minV + f * span) }))
  const xLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (visibleCandles.length - 1)))

  // Readout under the chart: what the chosen range spans
  const first = visibleCandles[0],
    last = visibleCandles[visibleCandles.length - 1]
  const spanPct = +first.close ? (+last.close / +first.close - 1) * 100 : 0

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <div className="relative" style={{ height: VH }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ display: 'block', cursor: inBand ? 'pointer' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
        >
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={t.y}
                x2={PAD.left + chartW}
                y2={t.y}
                stroke={dark ? '#1e293b' : '#f1f5f9'}
                strokeWidth="1"
              />
              <text
                x={PAD.left - 4}
                y={t.y + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="monospace"
                fill={dark ? '#475569' : '#94a3b8'}
              >
                {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
              </text>
            </g>
          ))}

          {bands.map(({ cyc, si, ei }, i) => {
            const isSelected = selectedKeys.has(cycleKey(cyc))
            const isFocused = cycleKey(cyc) === focusedKey
            const hue = cyc.type === 'bull' ? '#10b981' : '#ef4444'
            const base = cyc.type === 'bull' ? 'rgba(16,185,129,' : 'rgba(239,68,68,'
            // S3 §8.4.1a — selection must be unmistakable: unselected bands are
            // near-invisible (0.03), selected are strong (0.22), focused adds a
            // bold 2.5px outline in the band's own hue (focus implies selected).
            return (
              <rect
                key={i}
                x={cx(si)}
                y={PAD.top}
                width={Math.max(2, cx(ei) - cx(si))}
                height={chartH}
                fill={`${base}${isSelected ? '0.22' : '0.03'})`}
                stroke={isFocused ? hue : 'none'}
                strokeWidth={isFocused ? 2.5 : 0}
              />
            )
          })}

          <path d={linePath} fill="none" stroke={dark ? '#94a3b8' : '#475569'} strokeWidth="1.2" />

          {hover !== null && (
            <line
              x1={cx(hover)}
              y1={PAD.top}
              x2={cx(hover)}
              y2={PAD.top + chartH}
              stroke={dark ? '#64748b' : '#cbd5e1'}
              strokeWidth="1"
              strokeDasharray="3,2"
            />
          )}

          {xLabels.map((idx, i) => (
            <text
              key={i}
              x={cx(idx)}
              y={VH - 4}
              textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
              fontSize="9"
              fill={dark ? '#64748b' : '#94a3b8'}
            >
              {visibleCandles[idx]?.date?.slice(0, 7)}
            </text>
          ))}
        </svg>

        {hover !== null && visibleCandles[hover] && (
          <div
            className="pointer-events-none absolute top-1 z-20 text-[10px] rounded-lg px-2 py-1 shadow border whitespace-nowrap"
            style={{
              left:
                (cx(hover) / VW) * 100 > 60 ? undefined : `calc(${(cx(hover) / VW) * 100}% + 8px)`,
              right:
                (cx(hover) / VW) * 100 > 60
                  ? `calc(${((VW - cx(hover)) / VW) * 100}% + 8px)`
                  : undefined,
              background: dark ? '#1e293b' : 'white',
              borderColor: dark ? '#334155' : '#e5e7eb',
              color: dark ? '#f1f5f9' : '#1e293b',
            }}
          >
            <span className="text-gray-400">{visibleCandles[hover].date}</span>
            <span className="font-bold ml-2">
              {(+visibleCandles[hover].close).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-3 py-1 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
        <span>
          <b className="text-gray-700 dark:text-gray-200">{first.date}</b> →{' '}
          <b className="text-gray-700 dark:text-gray-200">{last.date}</b>
        </span>
        <span>
          <b className="text-gray-700 dark:text-gray-200">{visibleCandles.length - 1}</b> trading
          days
        </span>
        <span>
          Change{' '}
          <b
            className={
              spanPct >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {spanPct >= 0 ? '+' : ''}
            {spanPct.toFixed(1)}%
          </b>
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR INDEX CHART (fetches its own data)
// ─────────────────────────────────────────────────────────────────────────────
export function SectorIndexChart({ sector, cycle, dark }) {
  const [candles, setCandles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sector || !cycle) return
    const ctrl = new AbortController()
    setCandles(null)
    setLoading(true)
    setError('')
    getSectorIndexChart(
      { index_name: sector.index_name, peak_date: cycle.start_date, trough_date: cycle.end_date },
      { signal: ctrl.signal }
    )
      .then((r) => {
        if (!ctrl.signal.aborted) setCandles(r.data.candles || [])
      })
      .catch((e) => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setError(apiError(e, 'Failed to load chart'))
        setCandles([])
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [sector?.index_name, cycle?.start_date, cycle?.end_date])

  if (error)
    return (
      <div className="text-[11px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded">
        {error}
      </div>
    )
  return loading ? (
    <Skeleton minH={260} />
  ) : (
    <PriceChart
      candles={candles}
      startDate={cycle.start_date}
      endDate={cycle.end_date}
      type={cycle.type}
      dark={dark}
      label={stripIndexName(sector.index_name)}
      height={260}
    />
  )
}
