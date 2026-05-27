// === TradeGalleryView.jsx — trade gallery: candlestick thumbnail cards, hover actions, lazy chart loading ===

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { getStockChart, getTradeHistory } from '../../api'
import { useContextMenu } from '../ContextMenu'
import { fmt } from '../../utils/format'

// ── Module-level chart data cache ─────────────────────────────────────────────
const _cache = new Map()
const CACHE_TTL = 5 * 60_000

async function loadLC() { return import('lightweight-charts') }

// Add N calendar days to a YYYY-MM-DD string
function shiftDate(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Today as YYYY-MM-DD
function today() { return new Date().toISOString().slice(0, 10) }

// Marker shape + color per action type
const ACTION_MARKER = {
  'New Position':   { position: 'belowBar', shape: 'arrowUp',   color: '#3b82f6' },
  'Add Position':   { position: 'belowBar', shape: 'arrowUp',   color: '#8b5cf6' },
  'Partial Exit':   { position: 'aboveBar', shape: 'arrowDown',  color: '#f59e0b' },
  'Close Position': { position: 'aboveBar', shape: 'arrowDown',  color: '#6b7280' },
  'Reversal':       { position: 'aboveBar', shape: 'arrowDown',  color: '#ec4899' },
}

// Human-readable label per action type
const ACTION_VERB = {
  'New Position':   'Buy',
  'Add Position':   'Add',
  'Partial Exit':   'Partial Exit',
  'Close Position': 'Close',
  'Reversal':       'Reversal',
}

const ACTION_TOOLTIP_COLOR = {
  'New Position':   '#3b82f6',
  'Add Position':   '#8b5cf6',
  'Partial Exit':   '#f59e0b',
  'Close Position': '#9ca3af',
  'Reversal':       '#ec4899',
}

// ── Tooltip box — clamps inside the thumbnail container ──────────────────────

function TooltipBox({ tooltip, containerRef }) {
  const boxRef = useRef(null)
  const [pos, setPos] = useState({ left: tooltip.x + 10, top: tooltip.y - 10 })

  useEffect(() => {
    if (!boxRef.current || !containerRef.current) return
    const box  = boxRef.current.getBoundingClientRect()
    const cont = containerRef.current.getBoundingClientRect()
    const PAD  = 6

    let left = tooltip.x + 10
    let top  = tooltip.y - box.height - 8

    // Clamp right edge
    if (left + box.width > cont.width - PAD) left = tooltip.x - box.width - 10
    if (left < PAD) left = PAD

    // Clamp top/bottom
    if (top < PAD) top = tooltip.y + 14
    if (top + box.height > cont.height - PAD) top = cont.height - box.height - PAD

    setPos({ left, top })
  }, [tooltip.x, tooltip.y]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={boxRef}
      className="absolute z-30 pointer-events-none"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-2.5 py-2 shadow-xl backdrop-blur-sm whitespace-nowrap">
        <div className="text-[10px] text-gray-400 font-mono mb-1.5 border-b border-gray-700 pb-1">{tooltip.date}</div>
        {tooltip.lines.map((line, i) => (
          <div key={i} className="flex items-center gap-1.5" style={{ marginBottom: i < tooltip.lines.length - 1 ? 2 : 0 }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: line.color }} />
            <span className="text-[10px] font-semibold" style={{ color: line.color }}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Candlestick thumbnail ─────────────────────────────────────────────────────

function CandleThumbnail({ symbol, actions, wacc, ltp, isClosed, onCardHoverChange }) {
  const { isDark } = useTheme()
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const roRef         = useRef(null)
  const actionsRef    = useRef(actions)  // keep latest actions accessible in crosshair callback
  actionsRef.current  = actions
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [tooltip,  setTooltip]  = useState(null) // { x, y, lines[] }

  useEffect(() => {
    if (actions === null) return
    let cancelled = false

    async function build(stockData) {
      if (cancelled || !containerRef.current || !stockData.length) return
      const { createChart } = await loadLC()
      if (cancelled || !containerRef.current) return

      if (chartRef.current) {
        try { chartRef.current.remove() } catch (_) {}
        chartRef.current = null
      }

      const bg   = isDark ? '#030712' : '#ffffff'
      const up   = '#10b981'
      const down = '#ef4444'

      const chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth  || 300,
        height: containerRef.current.clientHeight || 160,
        layout: { background: { color: bg }, textColor: 'transparent' },
        grid:   { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        rightPriceScale: { visible: false },
        leftPriceScale:  { visible: false },
        timeScale:       { visible: false, borderColor: 'transparent' },
        crosshair:       { mode: 1, vertLine: { labelVisible: false }, horzLine: { labelVisible: false } },
        handleScroll:    false,
        handleScale:     false,
      })
      chartRef.current = chart

      const candleSeries = chart.addCandlestickSeries({
        upColor: up, downColor: down,
        borderUpColor: up, borderDownColor: down,
        wickUpColor: up, wickDownColor: down,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      const candleData = stockData.map(d => ({
        time:  d.time || d.date,
        open:  +d.open, high: +d.high, low: +d.low, close: +d.close,
      }))
      candleSeries.setData(candleData)

      // ── Price lines ──────────────────────────────────────────────────────────

      // WACC — blue dashed
      if (wacc > 0) {
        candleSeries.createPriceLine({
          price: wacc, color: '#3b82f680', lineWidth: 1,
          lineStyle: 2, axisLabelVisible: false, title: '',
        })
      }

      // LTP — gray dashed (open trades)
      if (ltp > 0 && !isClosed) {
        candleSeries.createPriceLine({
          price: ltp, color: '#94a3b880', lineWidth: 1,
          lineStyle: 2, axisLabelVisible: false, title: '',
        })
      }

      // ── Action markers ───────────────────────────────────────────────────────

      if (actions.length > 0) {
        // Build marker list — one per action, snapped to nearest candle date
        const candleDates = new Set(candleData.map(c => c.time))

        function nearestCandle(targetDate) {
          // Walk backward up to 7 days to find a trading day in data
          for (let i = 0; i <= 7; i++) {
            const d = shiftDate(targetDate, -i)
            if (candleDates.has(d)) return d
          }
          return null
        }

        const markers = actions
          .map(a => {
            const cfg = ACTION_MARKER[a.action_type]
            if (!cfg) return null
            const date = nearestCandle(a.date)
            if (!date) return null
            return {
              time:     date,
              position: cfg.position,
              shape:    cfg.shape,
              color:    cfg.color,
              size:     0.6,           // small
              text:     '',
            }
          })
          .filter(Boolean)
          // lightweight-charts requires markers sorted by time
          .sort((a, b) => (a.time > b.time ? 1 : -1))

        if (markers.length) candleSeries.setMarkers(markers)
      }

      // ── Zoom to trade date range ─────────────────────────────────────────────

      const sortedDates = actions.map(a => a.date).filter(Boolean).sort()
      const entryDate   = sortedDates[0]
      const exitDate    = isClosed ? sortedDates[sortedDates.length - 1] : today()

      if (entryDate) {
        const from = shiftDate(entryDate, -10)   // 10 days before entry
        const to   = shiftDate(exitDate,  +10)   // 10 days after exit

        // Clamp to available candle range
        const firstCandle = candleData[0].time
        const lastCandle  = candleData[candleData.length - 1].time
        chart.timeScale().setVisibleRange({
          from: from < firstCandle ? firstCandle : from,
          to:   to   > lastCandle  ? lastCandle  : to,
        })
      } else {
        chart.timeScale().fitContent()
      }

      // ── Crosshair → action tooltip ───────────────────────────────────────────

      // Build a date → actions[] lookup from the action rows
      function buildActionMap(acts) {
        const map = {}
        acts.forEach(a => {
          const key = a.date?.slice(0, 10)
          if (!key) return
          if (!map[key]) map[key] = []
          map[key].push(a)
        })
        return map
      }

      chart.subscribeCrosshairMove(param => {
        if (!param.time || !containerRef.current) {
          setTooltip(null)
          onCardHoverChange?.(true)   // still hovering card, just not on an action
          return
        }

        const date    = typeof param.time === 'string' ? param.time : param.time
        const actMap  = buildActionMap(actionsRef.current || [])
        const matched = actMap[date]

        if (!matched?.length) {
          setTooltip(null)
          return
        }

        // Position tooltip near the crosshair point
        const rect = containerRef.current.getBoundingClientRect()
        const cx   = param.point?.x ?? 0
        const cy   = param.point?.y ?? 0

        const lines = matched.map(a => {
          const verb  = ACTION_VERB[a.action_type] || a.action_type
          const price = parseFloat(a.exit_price || a.entry_price) || 0
          const qty   = a.quantity || ''
          return {
            text:  `${verb} ${symbol} ${qty} @ Rs.${fmt(price)}`,
            color: ACTION_TOOLTIP_COLOR[a.action_type] || '#94a3b8',
          }
        })

        setTooltip({ x: cx, y: cy, date, lines })
      })

      // ResizeObserver stored in roRef so cleanup can always reach it
      roRef.current = new ResizeObserver(() => {
        if (!containerRef.current || !chart) return
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      })
      roRef.current.observe(containerRef.current)
    }

    async function fetchAndBuild() {
      const key = `${symbol}:1Y`
      const cached = _cache.get(key)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (!cancelled) setLoading(false)
        await build(cached.data)
        return
      }
      try {
        const res  = await getStockChart({ symbol, timeframe: '1Y' })
        const data = res.data.data || []
        _cache.set(key, { data, ts: Date.now() })
        if (!cancelled) setLoading(false)
        await build(data)
      } catch {
        if (!cancelled) { setLoading(false); setError(true) }
      }
    }

    fetchAndBuild()

    return () => {
      cancelled = true
      if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
      if (chartRef.current) {
        try { chartRef.current.remove() } catch (_) {}
        chartRef.current = null
      }
    }
  }, [symbol, isDark, actions, wacc, ltp, isClosed]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="relative w-full h-full tv-thumb"
      onMouseEnter={() => onCardHoverChange?.(true)}
      onMouseLeave={() => { onCardHoverChange?.(false); setTooltip(null) }}
    >
      <style>{`.tv-thumb a[href*="tradingview"]{display:none!important;}`}</style>

      <div ref={containerRef} className="w-full h-full" />

      {/* action tooltip — shown when crosshair lands on a trade action date */}
      {tooltip && (
        <TooltipBox tooltip={tooltip} containerRef={containerRef} />
      )}

      {/* loading */}
      {(loading || actions === null) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-5 h-5 border border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* error */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <span className="text-[10px] text-gray-400">No chart data</span>
        </div>
      )}
    </div>
  )
}

// ── Direction / Status config ─────────────────────────────────────────────────

const DIR_CFG = {
  LONG:  { label: '↑ Long',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20', bar: 'bg-emerald-500' },
  SHORT: { label: '↓ Short', pill: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20',                         bar: 'bg-red-500'     },
}

const STATUS_CFG = {
  OPEN:    { label: 'Open',    dot: 'bg-blue-500',  pill: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',     pulse: true  },
  PARTIAL: { label: 'Partial', dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20', pulse: true  },
  CLOSED:  { label: 'Closed',  dot: 'bg-gray-400',  pill: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-600/20',      pulse: false },
}

// ── Hover action bar shown over the chart thumbnail ───────────────────────────

function HoverActions({ isClosed, onAdd, onPartialExit, onClose }) {
  if (isClosed) return null

  return (
    <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 pb-2 pointer-events-none">
      <button
        onClick={e => { e.stopPropagation(); onAdd() }}
        className="pointer-events-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold
                   bg-blue-600/90 hover:bg-blue-500 text-white backdrop-blur-sm shadow-lg transition-colors"
      >
        ＋ Add
      </button>
      <button
        onClick={e => { e.stopPropagation(); onPartialExit() }}
        className="pointer-events-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold
                   bg-amber-500/90 hover:bg-amber-400 text-white backdrop-blur-sm shadow-lg transition-colors"
      >
        ↗ Partial
      </button>
      <button
        onClick={e => { e.stopPropagation(); onClose() }}
        className="pointer-events-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold
                   bg-emerald-600/90 hover:bg-emerald-500 text-white backdrop-blur-sm shadow-lg transition-colors"
      >
        ✓ Close
      </button>
    </div>
  )
}

// ── Single gallery card ───────────────────────────────────────────────────────

function GalleryCard({ position, ltp, onAdd, onPartialExit, onClose, onDelete }) {
  const navigate = useNavigate()
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const [actions,  setActions]  = useState(null)
  const [hovered,  setHovered]  = useState(false)
  const [visible,  setVisible]  = useState(false)
  const cardRef = useRef(null)

  // Only fetch history when the card scrolls into view
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const wacc     = parseFloat(position.wacc) || 0
  const totalQty = parseFloat(position.total_qty) || 0
  const ltpNum   = ltp ? parseFloat(ltp) : null
  const isClosed = position.status === 'CLOSED'
  const direction = position.direction?.toUpperCase() === 'LONG' ? 'LONG' : 'SHORT'
  const dirCfg    = DIR_CFG[direction]
  const statusCfg = STATUS_CFG[position.status] || STATUS_CFG.CLOSED

  const unrealPnl = ltpNum != null && !isClosed
    ? (direction === 'LONG' ? (ltpNum - wacc) * totalQty : (wacc - ltpNum) * totalQty)
    : null
  const pnlValue = isClosed ? parseFloat(position.total_realized_pnl) : unrealPnl
  const pnlLabel = isClosed ? 'Realized P&L' : 'Unreal P&L'
  const hasPnl   = pnlValue != null && !isNaN(pnlValue)
  const pnlPos   = hasPnl && pnlValue >= 0

  const slPct = position.sl && wacc > 0
    ? Math.abs((parseFloat(position.sl) - wacc) / wacc * 100).toFixed(1) : null
  const tpPct = position.tp && wacc > 0
    ? Math.abs((parseFloat(position.tp) - wacc) / wacc * 100).toFixed(1) : null
  const rr = position.sl && position.tp && wacc > 0
    ? (Math.abs(parseFloat(position.tp) - wacc) / Math.abs(parseFloat(position.sl) - wacc)).toFixed(1) : null

  // Fetch action history only once the card is visible in the viewport
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    getTradeHistory(position.trade_id)
      .then(res => { if (!cancelled) setActions(res.data || []) })
      .catch(() => { if (!cancelled) setActions([]) })
    return () => { cancelled = true }
  }, [position.trade_id, visible])

  function goToChart() {
    const posPayload = !isClosed ? [{
      id:          position.trade_id,
      entry_price: wacc,
      sl:          position.sl ? parseFloat(position.sl) : null,
      tp:          position.tp ? parseFloat(position.tp) : null,
      position:    direction,
      quantity:    totalQty,
    }] : null
    navigate('/screen', { state: { symbol: position.symbol, positions: posPayload } })
  }

  const menuItems = isClosed
    ? [{ label: 'Delete Trade', icon: '🗑', action: () => onDelete(position) }]
    : [
        { label: 'Add to Position', icon: '＋', action: () => onAdd(position) },
        { label: 'Partial Exit',    icon: '↗', action: () => onPartialExit(position) },
        { label: 'Close Position',  icon: '✓', action: () => onClose(position) },
        { separator: true },
        { label: 'Delete Trade',    icon: '🗑', action: () => onDelete(position) },
      ]

  return (
    <>
      <ContextMenuPortal />
      <div
        ref={cardRef}
        className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-gray-900/80
                   hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-lg hover:shadow-black/5
                   dark:hover:shadow-black/30 transition-all duration-200 overflow-hidden flex flex-col"
        onContextMenu={onContextMenu(menuItems)}
      >
        {/* direction accent bar */}
        <div className={`h-0.5 w-full ${dirCfg.bar} opacity-60`} />

        {/* ── candlestick thumbnail ── */}
        <div className="relative w-full bg-white dark:bg-gray-950 overflow-hidden" style={{ height: 160 }}>

          {/* chart — full pointer events so crosshair works; hover bubbles up via onCardHoverChange */}
          <div className="absolute inset-0">
            <CandleThumbnail
              symbol={position.symbol}
              actions={actions}
              wacc={wacc}
              ltp={ltpNum}
              isClosed={isClosed}
              onCardHoverChange={setHovered}
            />
          </div>

          {/* "open in screen" icon — top right, always visible */}
          <button
            onClick={e => { e.stopPropagation(); goToChart() }}
            title={`Open ${position.symbol} in Screen`}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md
                       bg-black/20 hover:bg-black/50 text-white/60 hover:text-white
                       transition-colors backdrop-blur-sm z-20"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>

          {/* hover action bar — z-20 so it sits above the click layer */}
          <div className={`absolute inset-0 z-20 transition-opacity duration-150 pointer-events-none ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="pointer-events-auto">
              <HoverActions
                isClosed={isClosed}
                onAdd={() => onAdd(position)}
                onPartialExit={() => onPartialExit(position)}
                onClose={() => onClose(position)}
              />
            </div>
          </div>
        </div>

        {/* ── card body ── */}
        <div className="flex flex-col gap-3 p-4 flex-1">

          {/* symbol + badges */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-[15px] text-gray-900 dark:text-gray-50 tracking-wide">{position.symbol}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${dirCfg.pill}`}>
                  {dirCfg.label}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">
                {position.opened_at?.slice(0, 10)}
              </div>
            </div>
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 ${statusCfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${statusCfg.pulse ? 'animate-pulse' : ''}`} />
              {statusCfg.label}
            </span>
          </div>

          {/* stat grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Qty"  value={totalQty} mono />
            <StatBox label="WACC" value={`Rs.${fmt(wacc)}`} mono />
            {ltpNum != null && !isClosed && (
              <StatBox label="LTP" value={`Rs.${fmt(ltpNum)}`} mono
                color={ltpNum >= wacc ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} />
            )}
            {position.sl && (
              <StatBox label={`SL${slPct ? ` ↓${slPct}%` : ''}`} value={`Rs.${fmt(position.sl)}`} mono color="text-red-500 dark:text-red-400" />
            )}
            {position.tp && (
              <StatBox label={`TP${rr ? ` 1:${rr}` : ''}${tpPct ? ` ↑${tpPct}%` : ''}`} value={`Rs.${fmt(position.tp)}`} mono color="text-emerald-600 dark:text-emerald-400" />
            )}
          </div>

          {/* P&L pill */}
          {hasPnl && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${
              pnlPos ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'
            }`}>
              <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">{pnlLabel}</span>
              <span className={`text-[13px] font-bold font-mono ${pnlPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {pnlPos ? '+' : ''}Rs.{fmt(pnlValue)}
              </span>
            </div>
          )}

          {/* right-click hint */}
          <p className="text-[10px] text-gray-300 dark:text-gray-700 text-center mt-auto pt-1 select-none">
            Right-click for actions
          </p>
        </div>
      </div>
    </>
  )
}

// ── Stat box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, mono, color }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-2.5 py-2">
      <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5 truncate">{label}</div>
      <div className={`text-[12px] ${mono ? 'font-mono' : 'font-semibold'} truncate ${color || 'text-gray-900 dark:text-gray-200'}`}>{value}</div>
    </div>
  )
}

// ── Gallery container ─────────────────────────────────────────────────────────

export default function TradeGalleryView({ positions = [], ltpMap = {}, filter, search, onAdd, onPartialExit, onClose, onDelete, onOpenAddModal }) {
  const displayed = useMemo(() => {
    let list = positions
    if (filter === 'open') list = list.filter(p => p.status !== 'CLOSED')
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter(p => p.symbol.includes(q))
    }
    return list
  }, [positions, filter, search])

  if (displayed.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500">
        <p className="text-[13px] font-semibold mb-1">No {filter === 'open' ? 'open ' : ''}positions</p>
        <p className="text-[11px]">
          {filter === 'open'
            ? <span>Switch to All above to see closed trades</span>
            : <button onClick={onOpenAddModal} className="underline hover:text-blue-500 transition-colors">Add your first trade →</button>
          }
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {displayed.map(pos => (
        <GalleryCard
          key={pos.trade_id}
          position={pos}
          ltp={ltpMap?.[pos.symbol]}
          onAdd={onAdd}
          onPartialExit={onPartialExit}
          onClose={onClose}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
