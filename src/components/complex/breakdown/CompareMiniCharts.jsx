// =============================================================================
// CompareMiniCharts.jsx — right panel while Compare is active (S3 §8.4.4):
// TWO mini charts (side A, side B) over the FOCUSED cycle's window
// (owner-flippable default) with a `2 lines | Ratio` toggle (idea C).
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSectorIndexChart, getStockPriceRange } from '../../../api'
import { apiError, isCanceled } from '../../../utils/format'
import { CARD, LABEL, STITLE, Skeleton } from '../../datalab/shared'
import ViewSwitcher from '../../shared/ViewSwitcher'
import { addDays } from './helpers'
import { PriceChart } from './charts'
import { sideLabel } from './compareMath'

const MODES = [
  { id: 'lines', label: '2 lines' },
  { id: 'ratio', label: 'Ratio' },
]

// Small icon-badge for empty states — same shape as ComingSoon's compact
// variant (badge + centered stroke icon), no new colors.
function EmptyIcon() {
  return (
    <div className="w-8 h-8 flex items-center justify-center shrink-0 mx-auto mb-2">
      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 5-5" />
      </svg>
    </div>
  )
}

// Fetch one side's candles for the focused window (−30d/+120d padding, capped today).
function useSideCandles(side, focused) {
  const [state, setState] = useState({ candles: null, error: '' })
  const sideSig = JSON.stringify(side)
  useEffect(() => {
    if (!side || !focused) { setState({ candles: null, error: '' }); return }
    const ctrl = new AbortController()
    setState({ candles: null, error: '' })
    const from = addDays(focused.start_date, -30)
    const today = new Date().toISOString().slice(0, 10)
    const rawTo = addDays(focused.end_date, 120)
    const to = rawTo < today ? rawTo : today
    const req = side.symbol
      ? getStockPriceRange({ symbol: side.symbol, from, to }, { signal: ctrl.signal })
      : getSectorIndexChart(
          { index_id: side.index_id, peak_date: focused.start_date, trough_date: focused.end_date },
          { signal: ctrl.signal }
        )
    req
      .then((r) => {
        if (!ctrl.signal.aborted) setState({ candles: r.data.candles || [], error: '' })
      })
      .catch((e) => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setState({ candles: [], error: apiError(e, 'Failed to load chart') })
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideSig, focused?.start_date, focused?.end_date])
  return state
}

// Ratio line (simple SVG, indexed to 100 at the first matched date — modeled on
// MiniOverview's line path, no hover needed).
function RatioChart({ aC, bC, startDate, endDate, dark, height = 200 }) {
  const pts = useMemo(() => {
    const bByDate = new Map((bC || []).map((c) => [c.date, parseFloat(c.close)]))
    const raw = (aC || [])
      .map((c) => {
        const bClose = bByDate.get(c.date)
        return bClose > 0 ? { date: c.date, r: parseFloat(c.close) / bClose } : null
      })
      .filter(Boolean)
    if (!raw.length) return []
    const base = raw[0].r
    return raw.map((p) => ({ date: p.date, v: (p.r / base) * 100 }))
  }, [aC, bC])

  if (!pts.length)
    return (
      <div className="flex items-center justify-center text-[11px] text-gray-400" style={{ height }}>
        No overlapping dates
      </div>
    )

  const VW = 400, VH = height, PAD = { top: 12, bottom: 18, left: 36, right: 8 }
  const chartW = VW - PAD.left - PAD.right, chartH = VH - PAD.top - PAD.bottom
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const cx = (i) => PAD.left + (i / Math.max(1, pts.length - 1)) * chartW
  const cy = (v) => PAD.top + (1 - (v - min) / span) * chartH
  const zs = pts.findIndex((p) => p.date >= startDate)
  const ze = pts.findIndex((p) => p.date >= endDate)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${cy(p.v)}`).join(' ')
  const last = pts[pts.length - 1].v
  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display: 'block' }}>
      {[min, (min + max) / 2, max].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={cy(v)} x2={PAD.left + chartW} y2={cy(v)} stroke={dark ? '#1e293b' : '#f1f5f9'} />
          <text x={PAD.left - 4} y={cy(v) + 3} textAnchor="end" fontSize="9" fontFamily="monospace" fill={dark ? '#475569' : '#94a3b8'}>
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      {zs >= 0 && ze >= 0 && (
        <rect x={cx(zs)} y={PAD.top} width={Math.max(0, cx(ze) - cx(zs))} height={chartH} fill={last >= 100 ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)'} />
      )}
      {/* 100-reference line only when 100 is inside the value range — a half-
          clamped line would draw a stray diagonal when all ratios sit one side */}
      {cy(100) >= PAD.top && cy(100) <= PAD.top + chartH && (
        <line x1={PAD.left} y1={cy(100)} x2={PAD.left + chartW} y2={cy(100)} stroke={dark ? '#475569' : '#cbd5e1'} strokeDasharray="4,3" />
      )}
      <path d={path} fill="none" stroke={last >= 100 ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
      <text x={PAD.left + 4} y={PAD.top + 10} fontSize="9" fill={dark ? '#64748b' : '#94a3b8'}>
        100 = start · above 100 → A leads
      </text>
    </svg>
  )
}

// Fills its parent and reports the measured pixel height, so the fixed-height
// SVG charts can split the panel 50/50 with no dead gap below (owner eyeball
// 2026-07-07). Same ResizeObserver pattern as ScreenPage's chart wrappers.
function FillChart({ children }) {
  const ref = useRef(null)
  const [h, setH] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const px = Math.floor(e.contentRect.height)
      if (px > 0) setH(px)
    })
    ro.observe(el)
    const initial = Math.floor(el.clientHeight)
    if (initial > 0) setH(initial)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="flex-1 min-h-0 p-2">
      {h > 8 && children(h - 8)}
    </div>
  )
}

export default function CompareMiniCharts({ focused, a, b, dark }) {
  const [mode, setMode] = useState('lines')
  // Synced crosshair (owner 2026-07-07): hovering either chart drives BOTH by
  // date, so the same trading day lines up across side A and side B.
  const [hoverDate, setHoverDate] = useState(null)
  const aS = useSideCandles(a, focused)
  const bS = useSideCandles(b, focused)

  if (!a || !b)
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className={`${CARD} p-6 text-center`}>
          <EmptyIcon />
          <p className="text-[11px] text-gray-400">Pick both Compare sides</p>
          <p className="text-[11px] text-gray-400">in the center card.</p>
        </div>
      </div>
    )
  if (!focused)
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className={`${CARD} p-6 text-center`}>
          <EmptyIcon />
          <p className="text-[11px] text-gray-400">Click a selected cycle to see</p>
          <p className="text-[11px] text-gray-400">{sideLabel(a)} vs {sideLabel(b)} over its window.</p>
        </div>
      </div>
    )

  const header = (label, s) => (
    <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
      <span className={STITLE}>{label}</span>
      {s.error && <span className="text-[10px] text-red-500">{s.error}</span>}
    </div>
  )

  // 50/50 fill (owner eyeball 2026-07-07): the panel is a non-scrolling flex
  // column; each chart card takes an equal share and the SVG height follows
  // the card via FillChart — no dead gap below the second chart.
  return (
    <div className="flex-1 min-h-0 bg-white/40 dark:bg-gray-950/40 p-3 flex flex-col gap-3">
      <div className="shrink-0 flex items-center justify-between">
        <span className={`${LABEL} normal-case`}>
          {focused.name || focused.start_date} · {focused.start_date} → {focused.end_date}
        </span>
        <ViewSwitcher views={MODES} active={mode} onChange={setMode} ariaLabel="Compare chart mode" />
      </div>
      {mode === 'ratio' ? (
        <div className={`${CARD} overflow-hidden flex-1 min-h-0 flex flex-col`}>
          {header(`${sideLabel(a)} ÷ ${sideLabel(b)}`, { error: aS.error || bS.error })}
          {!aS.candles || !bS.candles ? (
            <Skeleton minH={200} />
          ) : (
            <FillChart>
              {(h) => (
                <RatioChart aC={aS.candles} bC={bS.candles} startDate={focused.start_date} endDate={focused.end_date} dark={dark} height={h} />
              )}
            </FillChart>
          )}
        </div>
      ) : (
        [
          // Key by side SLOT, not label — NEPSE vs NEPSE is a legal pick and
          // duplicate keys would break reconciliation (final whole-branch review).
          ['a', sideLabel(a), aS],
          ['b', sideLabel(b), bS],
        ].map(([slot, label, s]) => (
          <div key={slot} className={`${CARD} overflow-hidden flex-1 min-h-0 flex flex-col`}>
            {header(label, s)}
            {!s.candles ? (
              <Skeleton minH={140} />
            ) : (
              <FillChart>
                {(h) => (
                  <PriceChart
                    candles={s.candles}
                    startDate={focused.start_date}
                    endDate={focused.end_date}
                    type={focused.type}
                    dark={dark}
                    label={label}
                    height={h}
                    hoverDate={hoverDate}
                    onHover={setHoverDate}
                  />
                )}
              </FillChart>
            )}
          </div>
        ))
      )}
    </div>
  )
}
