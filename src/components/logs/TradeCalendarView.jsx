/**
 * TradeCalendarView — Gann Price-Time Chart
 *
 * X axis (bottom): continuous timeline, months labels
 * Y axis (left):   day-of-month, 1 at bottom → 31 at top
 * Zoom:  ctrl+wheel or pinch scales both axes independently
 * Pan:   drag anywhere on the chart
 * Collision: same-day dots spread horizontally, never overlap
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getTradeActions } from '../../api'

// ─── Palette & action config ──────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#14b8a6','#a3e635',
]

const ACTION_CFG = {
  'New Position':   { label: 'Buy',     shape: 'circle',   filled: true  },
  'Add Position':   { label: 'Add',     shape: 'circle',   filled: false },
  'Partial Exit':   { label: 'Partial', shape: 'triangle', filled: true  },
  'Close Position': { label: 'Close',   shape: 'cross',    filled: true  },
  'Reversal':       { label: 'Rev',     shape: 'diamond',  filled: true  },
}

// ─── Coordinate math ──────────────────────────────────────────────────────────
// Each month occupies [monthStart, monthEnd) on the X timeline.
// We map month index → pixel X using colW (pixels per month, zoomed).
// Y: day 1 at BOTTOM, day 31 at TOP.
//   pixelY = plotH - ((day - 0.5) / 31) * plotH  (within plot area)

const Y_AXIS_W  = 40   // left gutter
const X_AXIS_H  = 36   // bottom gutter
const DOT_R     = 6    // dot radius px
const MIN_COL_W = 80   // minimum px per month column
const DEF_COL_W = 200  // default px per month column
const MIN_ROW_H = 10   // minimum px per day row
const DEF_ROW_H = 18   // default px per day row

function dayToY(day, rowH, plotH) {
  // day 1 → near bottom, day 31 → near top
  return plotH - ((day - 0.5) / 31) * plotH
}

function yToDay(y, rowH, plotH) {
  return Math.round(31 * (1 - y / plotH) + 0.5)
}

// ─── Collision detection ──────────────────────────────────────────────────────
// Group dots by (monthIdx, day). Within each group spread horizontally.
function assignPositions(dots, colW, rowH, plotH) {
  // key = `${monthIdx}-${day}`
  const groups = {}
  dots.forEach(d => {
    const k = `${d.monthIdx}-${d.day}`
    if (!groups[k]) groups[k] = []
    groups[k].push(d)
  })

  const result = []
  Object.values(groups).forEach(grp => {
    const n      = grp.length
    const baseX  = Y_AXIS_W + grp[0].monthIdx * colW + colW / 2
    const baseY  = dayToY(grp[0].day, rowH, plotH)
    const spread = Math.min(DOT_R * 3, colW * 0.35)  // max spread per dot

    grp.forEach((d, i) => {
      const offset = n > 1 ? (i - (n - 1) / 2) * spread : 0
      result.push({ ...d, px: baseX + offset, py: baseY })
    })
  })
  return result
}

// ─── SVG dot ─────────────────────────────────────────────────────────────────
function DotMark({ shape, filled, color, r, selected }) {
  const sw   = 1.8
  const ring = selected
    ? <circle r={r + 6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
    : null

  let el
  if (shape === 'triangle') {
    el = <polygon points={`0,${-r} ${-r},${r * 0.72} ${r},${r * 0.72}`}
           fill={filled ? color : 'none'} stroke={color} strokeWidth={sw} />
  } else if (shape === 'cross') {
    const s = r * 0.68
    el = <>
      <circle r={r + 1} fill={color} opacity={0.15} />
      <line x1={-s} y1={-s} x2={s} y2={s} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <line x1={s}  y1={-s} x2={-s} y2={s} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </>
  } else if (shape === 'diamond') {
    el = <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`}
           fill={filled ? color : 'none'} stroke={color} strokeWidth={sw} />
  } else {
    el = <circle r={r} fill={filled ? color : 'none'} stroke={color} strokeWidth={sw} />
  }
  return <g>{ring}{el}</g>
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ dot, containerRect }) {
  if (!dot || !containerRect) return null
  const cfg    = ACTION_CFG[dot.action_type] || ACTION_CFG['New Position']
  const isExit = dot.action_type === 'Partial Exit' || dot.action_type === 'Close Position'
  const price  = Number(isExit ? dot.exit_price : dot.entry_price) || 0

  // Position relative to viewport, flip if near right edge
  const TW  = 190
  const raw = dot._clientX + 14
  const tx  = raw + TW > window.innerWidth ? dot._clientX - TW - 10 : raw
  const ty  = dot._clientY - 60

  return (
    <div className="fixed z-[9999] pointer-events-none"
      style={{ left: tx, top: ty }}>
      <div className="rounded-xl px-3.5 py-3 text-[11px] min-w-[170px]"
        style={{
          background: 'rgba(2,6,23,0.97)',
          border: `1px solid ${dot.color}50`,
          boxShadow: `0 0 0 1px ${dot.color}15, 0 12px 40px rgba(0,0,0,0.7)`,
        }}>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-2 h-2 rounded-full" style={{ background: dot.color }} />
          <span className="font-bold text-white text-[13px]">{dot.symbol}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
            style={{ background: dot.color + '22', color: dot.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px]">
          <span className="text-gray-600">Date</span>
          <span className="text-gray-300 text-right">{dot.dateLabel}</span>
          <span className="text-gray-600">Price</span>
          <span className="text-white font-semibold text-right">
            {price > 0 ? `Rs.${price.toFixed(2)}` : '—'}
          </span>
          <span className="text-gray-600">Units</span>
          <span className="text-gray-300 text-right">{dot.quantity ?? '—'}</span>
          {dot.realized_pnl != null && <>
            <span className="text-gray-600">P&L</span>
            <span className="font-semibold text-right"
              style={{ color: dot.realized_pnl >= 0 ? '#34d399' : '#f87171' }}>
              {dot.realized_pnl >= 0 ? '+' : ''}Rs.{Number(dot.realized_pnl).toFixed(0)}
            </span>
          </>}
        </div>
        {dot.why_taking_trade && (
          <div className="mt-2 pt-2 border-t border-gray-800 text-[10px] text-gray-500 italic">
            "{dot.why_taking_trade}"
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ dot, onClose }) {
  const cfg    = ACTION_CFG[dot.action_type] || ACTION_CFG['New Position']
  const isExit = dot.action_type === 'Partial Exit' || dot.action_type === 'Close Position'
  const price  = Number(isExit ? dot.exit_price : dot.entry_price) || 0
  const qty    = Number(dot.quantity) || 0

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900"
      style={{ borderLeft: `3px solid ${dot.color}` }}>
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-800">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
              style={{ background: dot.color + '20', color: dot.color }}>
              {cfg.label}
            </span>
            <span className="text-sm font-bold text-gray-100">{dot.symbol}</span>
            {qty > 0 && price > 0 && (
              <span className="text-sm font-mono text-gray-400">
                {qty} @ Rs.{price.toFixed(2)}
              </span>
            )}
            {dot.emotional_state && (
              <span className="text-xs text-gray-500">({dot.emotional_state})</span>
            )}
          </div>
          <p className="text-[11px] font-mono text-gray-500 mt-0.5">{dot.dateLabel}</p>
        </div>
        <button onClick={onClose}
          className="text-gray-600 hover:text-gray-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-sm flex-shrink-0 ml-3">
          ✕
        </button>
      </div>

      {dot.why_taking_trade && (
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Why Trade</p>
          <p className="text-xs text-gray-300 italic leading-relaxed">"{dot.why_taking_trade}"</p>
        </div>
      )}

      <div className="px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">Stats</p>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <SC label="Total Units" value={qty > 0 ? qty : '—'} />
          <SC label="Total Cost"  value={qty > 0 && price > 0 ? `Rs.${(qty*price).toLocaleString()}` : '—'} />
          <SC label={isExit ? 'Exit Price' : 'Entry Price'} value={price > 0 ? `Rs.${price.toFixed(2)}` : '—'} />
          {dot.sl && <SC label="SL" value={`Rs.${Number(dot.sl).toFixed(2)}`} red />}
          {dot.tp && <SC label="TP" value={`Rs.${Number(dot.tp).toFixed(2)}`} green />}
          {dot.realized_pnl != null && (
            <SC label="P&L"
              value={`${dot.realized_pnl >= 0 ? '+' : ''}Rs.${Number(dot.realized_pnl).toFixed(2)}`}
              green={dot.realized_pnl >= 0} red={dot.realized_pnl < 0} />
          )}
        </div>
        {dot.market_condition && (
          <p className="mt-3 text-[11px] text-gray-500">
            <span className="text-[10px] uppercase tracking-wide mr-2 text-gray-600">Market</span>
            {dot.market_condition}
          </p>
        )}
      </div>
    </div>
  )
}

function SC({ label, value, red, green }) {
  const cls = green ? 'text-emerald-400' : red ? 'text-red-400' : 'text-gray-200'
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono ${cls}`}>{value}</p>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {Object.values(ACTION_CFG).map(cfg => (
        <span key={cfg.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <svg width={12} height={12} viewBox="-7 -7 14 14" overflow="visible">
            <DotMark shape={cfg.shape} filled={cfg.filled} color="#6b7280" r={4} />
          </svg>
          {cfg.label}
        </span>
      ))}
    </div>
  )
}

// ─── Main chart canvas ────────────────────────────────────────────────────────
function GannCanvas({ dots, months, activeSymbol, selectedId, onDotClick }) {
  const containerRef = useRef(null)
  const [size,      setSize]      = useState({ w: 800, h: 480 })
  const [colW,      setColW]      = useState(DEF_COL_W)   // px per month
  const [rowH,      setRowH]      = useState(DEF_ROW_H)   // px per day
  const [panX,      setPanX]      = useState(0)            // horizontal scroll offset
  const [panY,      setPanY]      = useState(null)         // null = auto-fit to data on first render
  const [hovered,   setHovered]   = useState(null)
  const dragging    = useRef(false)
  const dragStart   = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Responsive container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    setSize({ w: el.offsetWidth, h: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  const plotW = size.w - Y_AXIS_W
  const plotH = size.h - X_AXIS_H

  // Total canvas width (scrollable)
  const totalW = Math.max(plotW, months.length * colW)

  // Clamp pan so user can't scroll past content
  const maxPanX = Math.max(0, totalW - plotW)
  const clampedPanX = Math.min(Math.max(panX, 0), maxPanX)

  // Y: 31 days * rowH total. Allow panning if content taller than plotH
  const totalH  = 31 * rowH
  const maxPanY = Math.max(0, totalH - plotH)

  // Auto-fit: on first render center the chart on the data's day range
  const autoFitPanY = useMemo(() => {
    if (!dots.length) return 0
    const days   = dots.map(d => d.day)
    const minDay = Math.min(...days)
    const maxDay = Math.max(...days)
    // midpoint of data in canvas space (day 1=bottom, 31=top)
    const midCanvasY = (31 - (minDay + maxDay) / 2) / 31 * totalH
    // center it in the plot
    return Math.min(Math.max(midCanvasY - plotH / 2, 0), maxPanY)
  }, [dots, totalH, plotH, maxPanY])

  const resolvedPanY   = panY === null ? autoFitPanY : panY
  const clampedPanY    = Math.min(Math.max(resolvedPanY, 0), maxPanY)

  // ── Wheel: ctrl = zoom, plain = pan ────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
      if (e.shiftKey) {
        // Shift+ctrl+wheel = zoom Y (row height)
        setRowH(h => Math.max(MIN_ROW_H, Math.min(60, h * zoomFactor)))
      } else {
        // ctrl+wheel = zoom X (col width)
        setColW(w => Math.max(MIN_COL_W, Math.min(500, w * zoomFactor)))
      }
    } else if (e.shiftKey) {
      // Shift+wheel = horizontal pan
      setPanX(p => Math.min(Math.max(p + e.deltaY * 0.8, 0), maxPanX))
    } else {
      // Plain wheel = vertical pan
      setPanY(p => Math.min(Math.max((p === null ? autoFitPanY : p) + e.deltaY * 0.8, 0), maxPanY))
    }
  }, [maxPanX, maxPanY, autoFitPanY])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Drag to pan ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, panX: clampedPanX, panY: resolvedPanY }
  }, [clampedPanX, clampedPanY])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return
    const dx = dragStart.current.x - e.clientX
    const dy = dragStart.current.y - e.clientY
    setPanX(Math.min(Math.max(dragStart.current.panX + dx, 0), maxPanX))
    setPanY(Math.min(Math.max(dragStart.current.panY + dy, 0), maxPanY))
  }, [maxPanX, maxPanY])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  // ── Y-axis ticks ───────────────────────────────────────────────────────────
  // Zoomed out (rowH < 20): show 1,5,10,15,20,25,30
  // Zoomed in  (rowH >= 20): show every day
  const yTicks = useMemo(() => {
    if (rowH >= 20) return Array.from({ length: 31 }, (_, i) => i + 1)
    return [1, 5, 10, 15, 20, 25, 30, 31]
  }, [rowH])

  // ── X-axis ticks ───────────────────────────────────────────────────────────
  // Show month label for every visible month column
  const visibleMonthStart = Math.floor(clampedPanX / colW)
  const visibleMonthEnd   = Math.ceil((clampedPanX + plotW) / colW)

  // ── Dot screen positions (with collision spread) ───────────────────────────
  const positioned = useMemo(() => {
    return assignPositions(dots, colW, rowH, totalH)
  }, [dots, colW, rowH, totalH])

  // ── Trade lines ────────────────────────────────────────────────────────────
  const tradeLines = useMemo(() => {
    const tm = {}
    positioned.forEach(d => {
      if (!tm[d.trade_id]) tm[d.trade_id] = []
      tm[d.trade_id].push(d)
    })
    return Object.values(tm).map(pts => pts.sort((a, b) => a.ts - b.ts))
  }, [positioned])

  // ── Transform: canvas coords → screen coords ───────────────────────────────
  // canvas px: (0,0) = top-left of plot area
  // screen:    add Y_AXIS_W (left), subtract panX for horizontal, subtract panY for vertical
  // Y is measured from top of the total canvas, so we need to offset by panY
  const toScreen = (px, py) => ({
    sx: px - clampedPanX,   // relative to plot left edge (Y_AXIS_W added by SVG translate)
    sy: py - (totalH - plotH - clampedPanY),  // shift so day 1 at bottom
  })

  // Day pixel in canvas space (0=top of 31-day canvas, totalH=bottom)
  const dayPxCanvas = (day) => (31 - day) / 31 * totalH + rowH / 2

  // Recompute positioned with canvas-space Y
  const positionedFull = useMemo(() => {
    const groups = {}
    dots.forEach(d => {
      const k = `${d.monthIdx}-${d.day}`
      if (!groups[k]) groups[k] = []
      groups[k].push(d)
    })
    const result = []
    Object.values(groups).forEach(grp => {
      const n      = grp.length
      const baseX  = grp[0].monthIdx * colW + colW / 2   // canvas X (no Y_AXIS_W yet)
      const baseY  = dayPxCanvas(grp[0].day)
      const spread = Math.min(DOT_R * 2.8, colW * 0.3)
      grp.forEach((d, i) => {
        const offset = n > 1 ? (i - (n - 1) / 2) * spread : 0
        result.push({ ...d, canvasX: baseX + offset, canvasY: baseY })
      })
    })
    return result
  }, [dots, colW, rowH, totalH])

  // Screen px = canvas px → apply pan, add gutters
  const sx = useCallback((canvasX) => canvasX - clampedPanX + Y_AXIS_W, [clampedPanX])
  const sy = useCallback((canvasY) => canvasY - (totalH - plotH - clampedPanY), [totalH, plotH, clampedPanY])

  // Filter to only dots visible on screen (no stale closure — inline the math)
  const visibleDots = useMemo(() => positionedFull.filter(d => {
    const screenX = d.canvasX - clampedPanX + Y_AXIS_W
    const screenY = d.canvasY - (totalH - plotH - clampedPanY)
    return screenX > Y_AXIS_W - 20 && screenX < size.w + 20
        && screenY > -20 && screenY < plotH + 20
  }), [positionedFull, clampedPanX, clampedPanY, totalH, plotH, size.w])

  return (
    <div ref={containerRef}
      className="relative w-full bg-[#0d1117] rounded-xl overflow-hidden"
      style={{ height: 480, cursor: dragging.current ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <Tooltip dot={hovered} />

      <svg width={size.w} height={size.h} style={{ display: 'block' }}>

        {/* ── Plot clip rect ── */}
        <defs>
          <clipPath id="plot-clip">
            <rect x={Y_AXIS_W} y={0} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* ── Y axis background ── */}
        <rect x={0} y={0} width={Y_AXIS_W} height={plotH} fill="#0d1117" />

        {/* ── Y axis ticks + horizontal grid lines ── */}
        {yTicks.map(day => {
          const canvasY  = dayPxCanvas(day)
          const screenY  = sy(canvasY)
          if (screenY < -2 || screenY > plotH + 2) return null
          const isMajor  = [1, 5, 10, 15, 20, 25, 30, 31].includes(day)
          return (
            <g key={day}>
              <line
                x1={Y_AXIS_W} y1={screenY} x2={size.w} y2={screenY}
                stroke={isMajor ? '#1e293b' : '#131a24'}
                strokeWidth={isMajor ? 1 : 0.5}
              />
              <text
                x={Y_AXIS_W - 6} y={screenY + 4}
                textAnchor="end" fontSize={isMajor ? 10 : 8}
                fontWeight={isMajor ? '600' : '400'}
                fill={isMajor ? '#475569' : '#2d3748'}
                fontFamily="ui-monospace, monospace"
              >
                {day}
              </text>
            </g>
          )
        })}

        {/* ── X axis month columns ── */}
        {months.map((mo, i) => {
          const screenLeft = i * colW - clampedPanX + Y_AXIS_W
          const cx         = screenLeft + colW / 2
          if (screenLeft > size.w || screenLeft + colW < Y_AXIS_W) return null
          return (
            <g key={mo.key}>
              {/* column separator */}
              {i > 0 && (
                <line x1={screenLeft} y1={0} x2={screenLeft} y2={plotH}
                  stroke="#1a2234" strokeWidth={1} />
              )}
              {/* alternating shade */}
              {i % 2 === 0 && (
                <rect x={screenLeft} y={0} width={colW} height={plotH}
                  fill="rgba(148,163,184,0.02)" clipPath="url(#plot-clip)" />
              )}
              {/* month label on X axis */}
              <text
                x={cx} y={plotH + 22}
                textAnchor="middle" fontSize={11} fontWeight="600"
                fill="#4b5563" fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {mo.label}
              </text>
            </g>
          )
        })}

        {/* X axis line */}
        <line x1={Y_AXIS_W} y1={plotH} x2={size.w} y2={plotH}
          stroke="#1e293b" strokeWidth={1} />
        {/* Y axis line */}
        <line x1={Y_AXIS_W} y1={0} x2={Y_AXIS_W} y2={plotH}
          stroke="#1e293b" strokeWidth={1} />

        {/* ── Trade connecting lines (clipped) ── */}
        <g clipPath="url(#plot-clip)">
          {tradeLines.map((pts, li) => {
            const sym = pts[0]?.symbol
            const dim = activeSymbol !== null && sym !== activeSymbol
            if (dim) return null
            const coords = pts
              .map(d => ({ x: sx(d.canvasX), y: sy(d.canvasY) }))
              .filter(c => true)  // keep all — line may exit/enter clip
            if (coords.length < 2) return null
            const d = coords.map((c, i) =>
              `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`
            ).join(' ')
            return (
              <path key={`tl-${li}`} d={d} fill="none"
                stroke={pts[0]?.color} strokeWidth={1.5}
                strokeDasharray="6 3" strokeOpacity={0.35}
                strokeLinejoin="round" />
            )
          })}

          {/* ── Dots ── */}
          {visibleDots.map(d => {
            const cfg    = ACTION_CFG[d.action_type] || ACTION_CFG['New Position']
            const dim    = activeSymbol !== null && d.symbol !== activeSymbol
            const isSel  = selectedId === d.id
            const screenX = sx(d.canvasX)
            const screenY = sy(d.canvasY)

            // Day-row highlight for this dot's row
            return (
              <g key={d.id} opacity={dim ? 0.08 : 1}
                transform={`translate(${screenX.toFixed(1)},${screenY.toFixed(1)})`}
                onClick={(e) => { e.stopPropagation(); onDotClick(d) }}
                onMouseEnter={(e) => setHovered({ ...d, _clientX: e.clientX, _clientY: e.clientY })}
                onMouseMove={(e)  => setHovered(h => h ? { ...h, _clientX: e.clientX, _clientY: e.clientY } : h)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle r={DOT_R + 9} fill="transparent" />
                <DotMark shape={cfg.shape} filled={cfg.filled}
                  color={d.color} r={DOT_R} selected={isSel} />
              </g>
            )
          })}

          {/* ── Per-day labels (right of rightmost dot in each group) ── */}
          {(() => {
            // Group visible dots by (monthIdx, day), find rightmost per group
            const groups = {}
            visibleDots.forEach(d => {
              if (activeSymbol !== null && d.symbol !== activeSymbol) return
              const k = `${d.monthIdx}-${d.day}`
              if (!groups[k]) groups[k] = []
              groups[k].push(d)
            })
            return Object.entries(groups).map(([k, grp]) => {
              const rightmost  = grp.reduce((a, b) => sx(a.canvasX) > sx(b.canvasX) ? a : b)
              const labelX     = sx(rightmost.canvasX) + DOT_R + 5
              const labelY     = sy(rightmost.canvasY) + 4
              const colRightX  = (rightmost.monthIdx + 1) * colW - clampedPanX + Y_AXIS_W - 6
              const available  = colRightX - labelX
              if (available < 20) return null  // no room

              const parts = grp.map(d => {
                const cfg    = ACTION_CFG[d.action_type] || ACTION_CFG['New Position']
                const isExit = d.action_type === 'Partial Exit' || d.action_type === 'Close Position'
                const price  = Number(isExit ? d.exit_price : d.entry_price) || 0
                return `${cfg.label} ${d.symbol}${d.quantity ? ' ' + d.quantity : ''}${price > 0 ? ' @' + price.toFixed(0) : ''}`
              })
              const text     = parts.join(' | ')
              const maxChars = Math.floor(available / 6)
              const display  = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text

              return (
                <text key={k}
                  x={labelX} y={labelY}
                  fontSize={8.5}
                  fill={grp[0].color}
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {display}
                </text>
              )
            })
          })()}
        </g>

        {/* Zoom hint */}
        <text x={size.w - 8} y={plotH + 30} textAnchor="end"
          fontSize={9} fill="#2d3748" fontFamily="ui-sans-serif, system-ui">
          Ctrl+scroll zoom X · Shift+Ctrl+scroll zoom Y · Drag to pan
        </text>
      </svg>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function TradeCalendarView() {
  const [actions,      setActions]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [selected,     setSelected]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try   { const r = await getTradeActions(); setActions(r.data || []) }
    catch (e) { setError(e.response?.data?.error || e.message || 'Failed to load') }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const { symbolColors, symbols } = useMemo(() => {
    const colors = {}; const syms = []
    actions.forEach(a => {
      if (!colors[a.symbol]) {
        colors[a.symbol] = PALETTE[syms.length % PALETTE.length]
        syms.push(a.symbol)
      }
    })
    return { symbolColors: colors, symbols: syms }
  }, [actions])

  // Build month list
  const months = useMemo(() => {
    const seen = new Map()
    actions.forEach(a => {
      if (!a.date) return
      const [y, m] = a.date.split('-').map(Number)
      const k = y * 100 + m
      if (!seen.has(k)) seen.set(k, {
        key: k, year: y, month: m,
        label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      })
    })
    return Array.from(seen.values()).sort((a, b) => a.key - b.key)
  }, [actions])

  const monthIndex = useMemo(() => {
    const m = {}
    months.forEach((mo, i) => { m[mo.key] = i })
    return m
  }, [months])

  // Build dot objects
  const dots = useMemo(() => (
    actions.filter(a => a.date).map(a => {
      const [y, m, d] = a.date.split('-').map(Number)
      const mk = y * 100 + m
      return {
        ...a,
        year: y, month: m, day: d,
        monthIdx: monthIndex[mk] ?? 0,
        ts: new Date(a.date).getTime(),
        dateLabel: new Date(a.date).toLocaleDateString('en-NP', {
          day: 'numeric', month: 'short', year: 'numeric',
        }),
        color: symbolColors[a.symbol] || '#6b7280',
      }
    }).sort((a, b) => a.ts - b.ts)
  ), [actions, symbolColors, monthIndex])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return (
    <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-400 text-sm">{error}</div>
  )
  if (dots.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-1">
      <p className="text-sm font-semibold">No trades yet</p>
      <p className="text-xs">Add your first trade to see it plotted here</p>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setActiveSymbol(null)}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
            activeSymbol === null
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-transparent'
              : 'border-gray-700 text-gray-500 hover:border-gray-500'
          }`}>
          All
        </button>
        {symbols.map(sym => {
          const active = activeSymbol === sym
          return (
            <button key={sym}
              onClick={() => setActiveSymbol(p => p === sym ? null : sym)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                active ? 'text-white border-transparent' : 'border-gray-700 text-gray-500 hover:border-gray-600'
              }`}
              style={active ? { background: symbolColors[sym] } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: active ? '#fff' : symbolColors[sym] }} />
              {sym}
            </button>
          )
        })}
        <div className="ml-auto"><Legend /></div>
      </div>

      {/* Chart */}
      <GannCanvas
        dots={dots}
        months={months}
        activeSymbol={activeSymbol}
        selectedId={selected?.id}
        onDotClick={dot => setSelected(p => p?.id === dot.id ? null : dot)}
      />

      {/* Detail panel */}
      {selected && (
        <DetailPanel dot={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
