// === StockChart.jsx — core chart component: candlestick/line, indicators (MA/EMA/BB/RSI/MACD/ATR), drawing tools, SMC + PA overlays, position lines ===
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../context/ThemeContext'
import { useScreen } from '../../context/ScreenContext'
import { getIndexChart, getStockChart, getTopMovers, triggerBackfill, getTradeHistory } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'

// ── useFixedDropdown ──────────────────────────────────────────────────────────
// Reusable hook for any toolbar dropdown that must escape overflow clipping.
// Returns { triggerRef, open, setOpen, portal(content) }.
// The dropdown is portalled to document.body via fixed positioning — works
// regardless of how many overflow:auto/hidden ancestors the trigger sits inside.
// align: 'left' | 'right' — which edge of the trigger to align the dropdown to.
function useFixedDropdown(align = 'right') {
  const [open, setOpen]     = useState(false)
  const [rect, setRect]     = useState(null)
  const triggerRef          = useRef(null)
  // Ref to the portalled dropdown node — excluded from outside-click so buttons
  // inside the portal are clickable before the mousedown closes the dropdown.
  const dropRef             = useRef(null)

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [])

  // Reposition on open, resize, scroll
  useEffect(() => {
    if (!open) return
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [open, updateRect])

  // Close on outside click — excludes both trigger and portal content
  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target)
      const inDrop    = dropRef.current?.contains(e.target)
      if (!inTrigger && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  // Compute drop position from latest rect — memoized so portal child doesn't re-render needlessly
  const dropStyle = useMemo(() => rect ? {
    position: 'fixed',
    top:  rect.bottom + 4,
    ...(align === 'right'
      ? { right: window.innerWidth - rect.right }
      : { left: rect.left }),
    zIndex: 9999,
  } : {}, [rect, align])

  // Wrap content in a portal — ref attached so outside-click excludes portal
  const portal = useCallback((content) => {
    if (!open || !rect) return null
    return createPortal(
      <div ref={dropRef} style={dropStyle}>{content}</div>,
      document.body
    )
  }, [open, rect, dropStyle])

  return { triggerRef, open, setOpen, portal, updateRect }
}

// ── Module-level caches (survive re-renders, shared across StockChart instances) ─
const _chartCache   = new Map()  // `sym:tf` or `idx:id:tf` → { data, latest, ts }
const CHART_TTL     = 5 * 60_000  // 5 min — NEPSE data is daily, 5 min is fresh enough
const _zoomMemory   = new Map()  // `sym:tf` → { from, to } — remembers zoom per symbol+timeframe

// ── Drawing Tools ─────────────────────────────────────────────────────────────

const DRAW_TOOLS = [
  { id: 'trendline',  label: 'Trend', title: 'Trendline'            },
  { id: 'horizontal', label: 'H',     title: 'Horizontal Line'      },
  { id: 'vertical',   label: 'V',     title: 'Vertical Line'        },
  { id: 'ray',        label: 'Ray',   title: 'Ray (extends right)'  },
  { id: 'fib',        label: 'Fib',   title: 'Fibonacci Retracement'},
  { id: 'path',       label: 'Path',  title: 'Path (multi-point)'   },
]

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const FIB_COLORS = ['#f87171','#fb923c','#facc15','#4ade80','#60a5fa','#a78bfa','#f472b6']

// Convert chart logical coords → canvas pixel coords
// priceSeries must be a series instance (chart.priceScale('right') removed in lw-charts v4)
function chartToPixel(chart, priceSeries, time, price) {
  try {
    const x = chart.timeScale().timeToCoordinate(time)
    const y = priceSeries.priceToCoordinate(price)
    return (x == null || y == null) ? null : { x, y }
  } catch { return null }
}

// Convert mouse event coords (relative to containerEl) → chart price/time
function pixelToChart(chart, priceSeries, containerEl, e) {
  try {
    const rect = containerEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const time  = chart.timeScale().coordinateToTime(x)
    const price = priceSeries.coordinateToPrice(y)
    return { x, y, time, price }
  } catch { return null }
}

function renderDrawings(ctx, canvas, chart, priceSeries, drawings, preview, isDark) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const c2p = (time, price) => chartToPixel(chart, priceSeries, time, price)

  function drawLine(p1, p2, color, dash = [], width = 1.5) {
    if (!p1 || !p2) return
    ctx.save()
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash)
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
    ctx.restore()
  }

  function dot(p, color, r = 3) {
    if (!p) return
    ctx.save(); ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  function extendRay(p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y
    if (dx === 0 && dy === 0) return p2
    const ts = []
    if (dx > 0) ts.push((canvas.width  - p1.x) / dx)
    if (dx < 0) ts.push((0            - p1.x) / dx)
    if (dy > 0) ts.push((canvas.height - p1.y) / dy)
    if (dy < 0) ts.push((0            - p1.y) / dy)
    const t = Math.min(...ts.filter(v => v > 0.001))
    return { x: p1.x + dx * t, y: p1.y + dy * t }
  }

  // Fib always draws full-width horizontal bands between p1 and p2 price levels
  function drawFib(p1, p2) {
    if (!p1 || !p2) return
    const dy = p2.y - p1.y
    ctx.save()
    FIB_LEVELS.forEach((lvl, i) => {
      const y = p1.y + dy * lvl
      if (y < -20 || y > canvas.height + 20) return // skip off-screen levels
      const c = FIB_COLORS[i]
      ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
      ctx.fillStyle = c; ctx.font = 'bold 9px monospace'
      ctx.fillText(`${(lvl * 100).toFixed(1)}%`, 4, y - 2)
      try {
        const price = priceSeries.coordinateToPrice(y)
        if (price != null) {
          ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280'
          ctx.font = '9px monospace'
          ctx.fillText(price.toFixed(2), 44, y - 2)
        }
      } catch (_) {}
    })
    ctx.restore()
  }

  // ── Committed drawings ──
  for (const d of drawings) {
    if (d.type === 'horizontal') {
      const p = c2p(d.time, d.price)
      if (!p) continue
      drawLine({ x: 0, y: p.y }, { x: canvas.width, y: p.y }, d.color)
      ctx.save(); ctx.fillStyle = d.color; ctx.font = 'bold 9px monospace'
      ctx.fillText(Number(d.price).toFixed(2), canvas.width - 54, p.y - 3); ctx.restore()
    } else if (d.type === 'vertical') {
      const p = c2p(d.time, d.price)
      if (!p) continue
      drawLine({ x: p.x, y: 0 }, { x: p.x, y: canvas.height }, d.color, [4, 3])
      ctx.save(); ctx.fillStyle = d.color; ctx.font = '9px monospace'
      ctx.fillText(d.time, p.x + 4, 14); ctx.restore()
    } else if (d.type === 'trendline') {
      const p1 = c2p(d.t1, d.p1), p2 = c2p(d.t2, d.p2)
      drawLine(p1, p2, d.color); dot(p1, d.color); dot(p2, d.color)
    } else if (d.type === 'ray') {
      const p1 = c2p(d.t1, d.p1), p2 = c2p(d.t2, d.p2)
      if (p1 && p2) { drawLine(p1, extendRay(p1, p2), d.color); dot(p1, d.color) }
    } else if (d.type === 'fib') {
      drawFib(c2p(d.t1, d.p1), c2p(d.t2, d.p2))
    } else if (d.type === 'path') {
      const pts = d.points.map(pt => c2p(pt.time, pt.price)).filter(Boolean)
      if (pts.length < 2) continue
      ctx.save(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke(); ctx.restore()
      pts.forEach(p => dot(p, d.color, 2.5))
    }
  }

  // ── Live preview ──
  if (!preview) return
  const { tool, start, end, points } = preview
  const PRE = '#f59e0b'

  if (tool === 'horizontal' && start) {
    drawLine({ x: 0, y: start.y }, { x: canvas.width, y: start.y }, PRE, [4, 3])
  } else if (tool === 'vertical' && start) {
    drawLine({ x: start.x, y: 0 }, { x: start.x, y: canvas.height }, PRE, [4, 3])
  } else if ((tool === 'trendline' || tool === 'ray') && start && end) {
    const p1 = { x: start.x, y: start.y }, p2 = { x: end.x, y: end.y }
    if (tool === 'ray') drawLine(p1, extendRay(p1, p2), PRE, [3, 3])
    else drawLine(p1, p2, PRE, [3, 3])
    dot(p1, PRE)
  } else if (tool === 'fib' && start && end) {
    drawFib({ x: start.x, y: start.y }, { x: end.x, y: end.y })
  } else if (tool === 'path' && points?.length) {
    const pts = points.map(pt => c2p(pt.time, pt.price)).filter(Boolean)
    if (end) pts.push({ x: end.x, y: end.y })
    if (pts.length >= 2) {
      ctx.save(); ctx.strokeStyle = PRE; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke(); ctx.restore()
      pts.forEach(p => dot(p, PRE, 2.5))
    }
  }
}

// Hit-test: is pixel (mx, my) within HIT_RADIUS of a committed drawing?
// Returns the drawing index or -1.
const HIT_RADIUS = 6
function hitTestDrawing(mx, my, drawings, chart, priceSeries) {
  const c2p = (time, price) => chartToPixel(chart, priceSeries, time, price)
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i]
    if (d.type === 'horizontal') {
      const p = c2p(d.time, d.price)
      if (p && Math.abs(my - p.y) <= HIT_RADIUS) return i
    } else if (d.type === 'vertical') {
      const p = c2p(d.time, d.price)
      if (p && Math.abs(mx - p.x) <= HIT_RADIUS) return i
    } else if (d.type === 'trendline' || d.type === 'ray') {
      const p1 = c2p(d.t1, d.p1), p2 = c2p(d.t2, d.p2)
      if (!p1 || !p2) continue
      const dx = p2.x - p1.x, dy = p2.y - p1.y
      const len2 = dx * dx + dy * dy
      if (len2 === 0) continue
      const t = Math.max(0, Math.min(1, ((mx - p1.x) * dx + (my - p1.y) * dy) / len2))
      const cx = p1.x + t * dx, cy = p1.y + t * dy
      if (Math.hypot(mx - cx, my - cy) <= HIT_RADIUS) return i
    } else if (d.type === 'fib') {
      const p1 = c2p(d.t1, d.p1), p2 = c2p(d.t2, d.p2)
      if (!p1 || !p2) continue
      const dy = p2.y - p1.y
      for (const lvl of FIB_LEVELS) {
        const y = p1.y + dy * lvl
        if (Math.abs(my - y) <= HIT_RADIUS) return i
      }
    } else if (d.type === 'path') {
      const pts = d.points.map(pt => c2p(pt.time, pt.price)).filter(Boolean)
      for (let j = 1; j < pts.length; j++) {
        const p1 = pts[j - 1], p2 = pts[j]
        const dx = p2.x - p1.x, dy = p2.y - p1.y
        const len2 = dx * dx + dy * dy
        if (len2 === 0) continue
        const t = Math.max(0, Math.min(1, ((mx - p1.x) * dx + (my - p1.y) * dy) / len2))
        const cx = p1.x + t * dx, cy = p1.y + t * dy
        if (Math.hypot(mx - cx, my - cy) <= HIT_RADIUS) return i
      }
    }
  }
  return -1
}

// ── Indicator math ────────────────────────────────────────────────────────────

function calcMA(data, period = 20) {
  return data.map((d, i) => {
    if (i < period - 1) return null
    const avg = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
}

function calcEMA(data, period) {
  if (data.length < period) return []
  const k = 2 / (period + 1)
  const out = []
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period
  out.push({ time: data[period - 1].time, value: +ema.toFixed(2) })
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    out.push({ time: data[i].time, value: +ema.toFixed(2) })
  }
  return out
}

// ── Shared indicator math helpers ────────────────────────────────────────────
// Wilder's smoothing: used by RSI, ATR, Supertrend
const wilderSmooth = (prev, curr, period) => (prev * (period - 1) + curr) / period
// True Range: used by ATR, Supertrend
const trueRange = (h, l, pc) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))

function calcRSI(data, period = 14) {
  if (data.length < period + 1) return []
  const out = []
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = data[i].close - data[i - 1].close
    d >= 0 ? (gains += d) : (losses -= d)
  }
  let ag = gains / period, al = losses / period
  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const d = data[i].close - data[i - 1].close
      ag = wilderSmooth(ag, Math.max(d,  0), period)
      al = wilderSmooth(al, Math.max(-d, 0), period)
    }
    const rs = al === 0 ? 100 : ag / al
    out.push({ time: data[i].time, value: +(100 - 100 / (1 + rs)).toFixed(2) })
  }
  return out
}

function calcMACD(data, fast = 12, slow = 26, sig = 9) {
  if (data.length < slow + sig) return { macd: [], signal: [], hist: [] }
  const ema = (arr, p) => {
    const k = 2 / (p + 1), out = [arr[0]]
    for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k))
    return out
  }
  const closes = data.map(d => d.close)
  const ef = ema(closes, fast), es = ema(closes, slow)
  const ml = closes.map((_, i) => ef[i] - es[i]).slice(slow - 1)
  const times = data.map(d => d.time).slice(slow - 1)
  const sl = ema(ml, sig)
  return {
    macd:   ml.map((v, i) => ({ time: times[i], value: +v.toFixed(2) })),
    signal: sl.map((v, i) => ({ time: times[i], value: +v.toFixed(2) })),
    hist:   ml.map((v, i) => ({ time: times[i], value: +(v - sl[i]).toFixed(2) })),
  }
}

// ── Bollinger Bands (20, 2) ──────────────────────────────────────────────────
function calcBB(data, period = 20, mult = 2) {
  const upper = [], lower = [], mid = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, d) => s + d.close, 0) / period
    const std = Math.sqrt(slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / period)
    mid.push({ time: data[i].time, value: +avg.toFixed(2) })
    upper.push({ time: data[i].time, value: +(avg + mult * std).toFixed(2) })
    lower.push({ time: data[i].time, value: +(avg - mult * std).toFixed(2) })
  }
  return { upper, lower, mid }
}

// ── ATR (Average True Range, 14) ─────────────────────────────────────────────
function calcATR(data, period = 14) {
  if (data.length < period + 1) return []
  const trs = []
  for (let i = 1; i < data.length; i++)
    trs.push(trueRange(data[i].high, data[i].low, data[i - 1].close))
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  const out = [{ time: data[period].time, value: +atr.toFixed(2) }]
  for (let i = period; i < trs.length; i++) {
    atr = wilderSmooth(atr, trs[i], period)
    out.push({ time: data[i + 1].time, value: +atr.toFixed(2) })
  }
  return out
}

async function loadLC() { return import('lightweight-charts') }

// ── Embedded Symbol Search ─────────────────────────────────────────────────────

function ChartSymbolSearch() {
  const { selectedSymbol, selectSymbol } = useScreen()
  const [query,  setQuery]  = useState('')
  const [symbols,setSymbols]= useState({ stocks: [], indexes: [] })
  const [cursor, setCursor] = useState(-1)
  const [loadErr,setLoadErr]= useState(null)
  const inputRef        = useRef(null)
  const listRef         = useRef(null)
  const mouseDownInList = useRef(false)

  // useFixedDropdown handles open state, positioning, outside-click, and portal
  const { triggerRef, open, setOpen, portal, updateRect } = useFixedDropdown('left')

  // TradingView-style: any printable key typed anywhere (not in another input) → focus search
  useEffect(() => {
    const handler = (e) => {
      // Ignore if already inside any input / textarea / contenteditable
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      // Ignore modifier-only combos (Ctrl+C, Alt+Tab etc.) and special keys
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.length !== 1) return  // only single printable characters
      // Focus the search input and seed the query with the typed character.
      // Clear native value first so the browser doesn't also insert the char
      // after focus (double-char bug on some browsers).
      const inp = inputRef.current
      if (!inp) return
      e.preventDefault()
      inp.value = ''
      inp.focus()
      setQuery(e.key.toUpperCase())
      setOpen(true)
      updateRect()
      setCursor(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setOpen, updateRect])

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) { setSymbols(r.data); setLoadErr(null) } })
      .catch(() => setLoadErr('Symbols unavailable'))
  }, [])

  const allItems = useMemo(() => [
    ...symbols.indexes.map(i => ({ label: i.name, sub: 'Index', indexId: i.index_id, company_name: null })),
    ...symbols.stocks.map(s => ({ label: s.symbol, sub: 'Stock', company_name: s.company_name || null })),
  ], [symbols])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (query.length < 1) return allItems.slice(0, 20)
    return allItems
      .filter(i =>
        i.label.toLowerCase().startsWith(q) ||
        i.label.toLowerCase().includes(q) ||
        (i.company_name && i.company_name.toLowerCase().includes(q))
      )
      .sort((a, b) =>
        (a.label.toLowerCase().startsWith(q) ? 0 : 1) -
        (b.label.toLowerCase().startsWith(q) ? 0 : 1)
      )
      .slice(0, 30)
  }, [query, allItems])

  const handleSelect = useCallback((item) => {
    selectSymbol(item.label, item.indexId || null, null, item.company_name || null)
    setQuery(''); setOpen(false); setCursor(-1)
  }, [selectSymbol, setOpen])

  function handleKey(e) {
    if (!open) { setOpen(true); updateRect(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') {
      const target = cursor >= 0 ? filtered[cursor] : filtered[0]
      if (target) handleSelect(target)
    }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const showList  = filtered.length > 0
  const showEmpty = filtered.length === 0 && query.length > 0

  return (
    <div className="w-[88px] sm:w-full sm:max-w-[200px] shrink-0">
      <div
        ref={triggerRef}
        className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 cursor-pointer"
        onClick={() => { setOpen(true); updateRect(); setTimeout(() => inputRef.current?.focus(), 40) }}
      >
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          data-chart-search
          value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setOpen(true); updateRect(); setCursor(-1) }}
          onFocus={() => { setOpen(true); updateRect() }}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="bg-transparent text-[10px] font-bold text-gray-700 dark:text-gray-200 placeholder-gray-600 dark:placeholder-gray-300 outline-none w-full min-w-0 uppercase"
        />
      </div>

      {/* Dropdown — portalled to body via useFixedDropdown */}
      {portal(
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto" style={{ minWidth: 240 }}>
          {loadErr ? (
            <div className="px-3 py-3 text-center">
              <p className="text-[10px] text-red-400 font-medium">{loadErr}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Check your connection</p>
            </div>
          ) : showList ? (
            <ul ref={listRef}>
              {filtered.map((item, i) => {
                const isActive = i === cursor || (cursor === -1 && i === 0 && query.length > 0)
                return (
                  <li key={item.label}
                    onMouseDown={() => { mouseDownInList.current = true; handleSelect(item); mouseDownInList.current = false }}
                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-50 dark:bg-blue-950/60' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.label}</span>
                      {item.company_name && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">{item.company_name}</span>
                      )}
                    </div>
                    <span className={`shrink-0 ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      item.sub === 'Index'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>{item.sub}</span>
                  </li>
                )
              })}
            </ul>
          ) : showEmpty ? (
            <div className="px-3 py-2 text-[10px] text-gray-400">
              No results for &quot;{query}&quot;
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── HUD Controls — timeframe, chart type, indicators ──────────────────────────

const TIMEFRAMES = ['6M', '1Y', '3Y', 'ALL']
const INDICATORS = ['MA', 'EMA', 'BB', 'RSI', 'MACD', 'ATR']

// ── Indicator + Drawing Tools dropdown ────────────────────────────────────────
function ChartIndicatorDropdown({ activeTool, setActiveTool, onClearDrawings, drawCount }) {
  const { activeIndicators: _ai, toggleIndicator } = useScreen() || {}
  const activeIndicators = Array.isArray(_ai) ? _ai : []
  const { triggerRef, open, setOpen, portal } = useFixedDropdown('right')

  const totalActive = activeIndicators.length + (activeTool ? 1 : 0)

  return (
    <div className="shrink-0">
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
          open || totalActive > 0
            ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-500'
        }`}
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
          <circle cx="6" cy="4" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="10" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        {totalActive > 0 && (
          <span className="min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-white/25 text-[10px] font-bold leading-none px-0.5">
            {totalActive}
          </span>
        )}
      </button>

      {/* Dropdown — portalled to body, fixed position, never clipped */}
      {portal(
        <div className="w-[270px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

          {/* Indicators section */}
          <div className="px-3 pt-3 pb-2.5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
              Indicators
            </p>
            <div className="flex flex-wrap gap-1">
              {INDICATORS.map(ind => {
                const on = activeIndicators.includes(ind)
                return (
                  <button key={ind} onClick={() => toggleIndicator(ind)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                      on
                        ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400'
                    }`}>
                    {ind}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-gray-800 mx-3" />

          {/* Drawing tools section */}
          <div className="px-3 pt-2.5 pb-3">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
              Drawing Tools
            </p>
            <div className="flex flex-wrap gap-1">
              {DRAW_TOOLS.map(t => (
                <button key={t.id} title={t.title}
                  onClick={() => setActiveTool(p => p === t.id ? null : t.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                    activeTool === t.id
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-500'
                  }`}>
                  {t.label}
                </button>
              ))}
              {drawCount > 0 && (
                <button onClick={() => { onClearDrawings(); setOpen(false) }}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-red-200 dark:border-red-900 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all">
                  ✕ Clear {drawCount}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Essential controls: chart type + timeframes only
function ChartHUDControls() {
  const { chartType, setChartType, timeframe, setTimeframe } = useScreen() || {}

  return (
    <div className="flex items-center gap-1 min-w-0" style={{ whiteSpace: 'nowrap' }}>
      {/* Chart type */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {[['candlestick', '🕯'], ['line', '📈']].map(([type, icon]) => (
          <button key={type} onClick={() => setChartType(type)} title={type}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {icon}
          </button>
        ))}
      </div>

      {/* Timeframes */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tf}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── HUD Price + Symbol ─────────────────────────────────────────────────────────

function ChartHUDPrice({ latestClose, chartData }) {
  const { selectedSymbol, selectedCompanyName } = useScreen()

  const lastBar = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const change  = lastBar ? (lastBar.diff_pct ?? lastBar.per_change ?? null) : null
  const isPos   = parseFloat(change) >= 0
  const close   = latestClose ?? lastBar?.close

  return (
    <div
      className="flex flex-col pointer-events-none px-2.5 py-1.5 rounded-xl
                 bg-white/80 dark:bg-gray-950/85 backdrop-blur-md
                 shadow-md border border-white/70 dark:border-white/[0.12]"
      translate="no"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wide">{selectedSymbol}</span>
        {close != null && (
          <>
            <span className="text-[19px] font-black text-gray-900 dark:text-white tabular-nums leading-none">
              {parseFloat(close).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {change != null && (
              <span className={`text-[11px] font-bold ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
                {isPos ? '▲' : '▼'} {Math.abs(parseFloat(change)).toFixed(2)}%
              </span>
            )}
          </>
        )}
      </div>
      {selectedCompanyName && (
        <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5 truncate max-w-[200px]">{selectedCompanyName}</span>
      )}
    </div>
  )
}

// ── Position Badge ─────────────────────────────────────────────────────────────

const ENTRY_DOT_COLORS  = ['bg-blue-400', 'bg-amber-400', 'bg-violet-400', 'bg-emerald-400', 'bg-pink-400']
const ENTRY_TEXT_COLORS = ['text-blue-400', 'text-amber-400', 'text-violet-400', 'text-emerald-400', 'text-pink-400']

function PositionBadge({ positions, latestClose }) {
  if (!positions?.length) return null

  const close    = parseFloat(latestClose) || 0
  const totalQty = positions.reduce((s, p) => s + (p.remaining_quantity ?? p.quantity ?? 0), 0)
  const avgEntry = totalQty > 0
    ? positions.reduce((s, p) => s + parseFloat(p.entry_price) * (p.remaining_quantity ?? p.quantity ?? 0), 0) / totalQty
    : 0
  const isLong     = positions.every(p => p.position !== 'SHORT')
  const totalUnreal = close
    ? positions.reduce((s, p) => {
        const qty  = p.remaining_quantity ?? p.quantity ?? 0
        const e    = parseFloat(p.entry_price)
        const long = p.position !== 'SHORT'
        return s + (long ? (close - e) * qty : (e - close) * qty)
      }, 0)
    : 0
  const pnlPct  = avgEntry ? ((close - avgEntry) / avgEntry * 100) * (isLong ? 1 : -1) : 0
  const isPos   = totalUnreal >= 0
  const isSingle = positions.length === 1

  return (
    <div className="absolute bottom-16 left-3 z-20 pointer-events-none" translate="no">
      <div className="bg-white/96 dark:bg-gray-900/96 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden w-56">
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-1.5 ${isLong ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
              isLong ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-red-100 dark:bg-red-900 text-red-500'
            }`}>{positions[0]?.position}</span>
            <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100">
              {isSingle ? (positions[0].symbol ?? '') : `${positions.length} entries`}
            </span>
          </div>
          {close > 0 && (
            <span className={`text-[11px] font-bold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
              {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Summary */}
        <div className="px-3 pt-2 pb-1 grid grid-cols-3 gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Avg Entry</p>
            <p className="text-[10px] font-semibold text-blue-400 tabular-nums">{avgEntry.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Qty</p>
            <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{totalQty}</p>
          </div>
          {close > 0 && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Unreal</p>
              <p className={`text-[10px] font-semibold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
                {isPos ? '+' : '−'}Rs.{Math.abs(Math.round(totalUnreal)).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Per-entry */}
        <div className="px-3 py-2 space-y-1.5">
          {positions.map((pos, idx) => {
            const e   = parseFloat(pos.entry_price)
            const qty = pos.remaining_quantity ?? pos.quantity ?? 0
            const long = pos.position !== 'SHORT'
            const u   = close ? (long ? (close - e) * qty : (e - close) * qty) : null
            const rr  = pos.sl && pos.tp
              ? (Math.abs(parseFloat(pos.tp) - e) / Math.abs(e - parseFloat(pos.sl))).toFixed(1)
              : null
            return (
              <div key={pos.id ?? idx} className="flex items-start gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 shrink-0 ${ENTRY_DOT_COLORS[idx % ENTRY_DOT_COLORS.length]}`} />
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 flex-1">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Entry</p>
                    <p className={`text-[10px] font-semibold tabular-nums ${ENTRY_TEXT_COLORS[idx % ENTRY_TEXT_COLORS.length]}`}>{e.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Qty</p>
                    <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 tabular-nums">{qty}</p>
                  </div>
                  {u !== null && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-widest">P&L</p>
                      <p className={`text-[10px] font-semibold tabular-nums ${u >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {u >= 0 ? '+' : '−'}{Math.abs(Math.round(u)).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {pos.sl && <div><p className="text-[9px] text-gray-400 uppercase tracking-widest">SL</p><p className="text-[10px] font-semibold text-red-400 tabular-nums">{parseFloat(pos.sl).toFixed(2)}</p></div>}
                  {pos.tp && <div><p className="text-[9px] text-gray-400 uppercase tracking-widest">TP</p><p className="text-[10px] font-semibold text-emerald-400 tabular-nums">{parseFloat(pos.tp).toFixed(2)}</p></div>}
                  {rr   && <div><p className="text-[9px] text-gray-400 uppercase tracking-widest">R:R</p><p className="text-[10px] font-semibold text-violet-400">1:{rr}</p></div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* SL→TP progress bar (single position only) */}
        {isSingle && (() => {
          const pos  = positions[0]
          const sl   = pos.sl ? parseFloat(pos.sl) : null
          const tp   = pos.tp ? parseFloat(pos.tp) : null
          const e    = parseFloat(pos.entry_price)
          if (!sl || !tp || !close) return null
          const range    = tp - sl
          const entryPct = Math.min(100, Math.max(0, ((e  - sl) / range) * 100))
          const closePct = Math.min(100, Math.max(0, ((close - sl) / range) * 100))
          return (
            <div className="px-3 pb-2.5">
              <div className="relative h-1.5 rounded-full overflow-visible mb-1">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 via-gray-200 dark:via-gray-700 to-emerald-400" />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-blue-400 rounded-full" style={{ left: `${entryPct}%` }} />
                <div className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
                  style={{ left: `${closePct}%`, top: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-red-400">{sl.toFixed(2)}</span>
                <span className={`font-semibold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>{close.toFixed(2)}</span>
                <span className="text-emerald-400">{tp.toFixed(2)}</span>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Movers Overlay ─────────────────────────────────────────────────────────────

function MoversOverlay({ movers, date, pinned, onClear }) {
  if (!movers || (!movers.gainers?.length && !movers.losers?.length)) return null
  const { selectSymbol } = useScreen()

  return (
    <div translate="no" className={`absolute top-14 right-2 z-20 w-52 rounded-2xl border shadow-lg backdrop-blur-sm text-[10px] overflow-hidden
      ${pinned
        ? 'bg-white dark:bg-gray-900/95 border-blue-200 dark:border-blue-700 ring-1 ring-blue-400/30'
        : 'bg-white/95 dark:bg-gray-900/90 border-gray-200 dark:border-white/[0.10]'
      }`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{date}</span>
        {pinned ? (
          <button onClick={onClear} className="text-[10px] text-blue-400 hover:text-blue-600 font-semibold flex items-center gap-0.5">
            <span>📌</span> Pinned
          </button>
        ) : (
          <span className="text-[10px] text-gray-300 dark:text-gray-600">Click to pin</span>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
        <div className="px-2 py-2">
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">Gainers</p>
          {(movers.gainers || []).slice(0, 5).map((s, i) => (
            <div key={i}
              onClick={() => selectSymbol(s.s)}
              className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 transition-colors"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">{s.s}</span>
              <span className="text-emerald-500 font-semibold">+{s.p}%</span>
            </div>
          ))}
        </div>
        <div className="px-2 py-2">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-1">Losers</p>
          {(movers.losers || []).slice(0, 5).map((s, i) => (
            <div key={i}
              onClick={() => selectSymbol(s.s)}
              className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 transition-colors"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">{s.s}</span>
              <span className="text-red-400 font-semibold">{s.p}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── OHLC Tooltip ──────────────────────────────────────────────────────────────

function OHLCTooltip({ bar, change }) {
  const isUp = bar ? (bar.close ?? bar.value) >= (bar.open ?? bar.value) : true
  return (
    <div
      className="absolute top-2 right-3 z-10 pointer-events-none"
      style={{ opacity: bar ? 1 : 0, transition: 'opacity 0.12s ease-out' }}
      translate="no"
    >
      <div className="bg-white/90 dark:bg-gray-950/90 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-lg backdrop-blur-md">
        {bar && <>
          <div className="text-[10px] text-gray-400 mb-1">{bar.time}</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-[15px] font-bold ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
              {(bar.close ?? bar.value)?.toLocaleString()}
            </span>
            {change != null && (
              <span className={`text-[10px] font-semibold ${change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </div>
          {bar.open != null && (
            <div className="grid grid-cols-4 gap-x-3 text-[10px]">
              {['O','H','L','C'].map(l => <span key={l} className="text-gray-400">{l}</span>)}
              <span className="text-gray-700 dark:text-gray-300">{bar.open?.toLocaleString()}</span>
              <span className="text-emerald-500">{bar.high?.toLocaleString()}</span>
              <span className="text-red-400">{bar.low?.toLocaleString()}</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{bar.close?.toLocaleString()}</span>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-2 p-4 animate-pulse" style={{ background: 'var(--chart-bg, #fafafa)' }}>
      <div className="flex gap-1 items-end h-full">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="flex-1 bg-gray-200 dark:bg-gray-800/80 rounded-sm"
            style={{ height: `${30 + (Math.sin(i * 0.4) * 30 + 40)}%` }} />
        ))}
      </div>
    </div>
  )
}

// ── Sub-pane label ─────────────────────────────────────────────────────────────

function SubPaneLabel({ title, sub, color, legend }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-1 pb-0.5 shrink-0">
      <span className={`text-[10px] font-bold uppercase tracking-widest`} style={{ color }}>{title}</span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
      {legend && legend.map((l, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="w-2 h-0.5 rounded inline-block" style={{ background: l.color }} />
          <span className="text-[10px] text-gray-400">{l.label}</span>
        </span>
      ))}
    </div>
  )
}

// ── Main StockChart ────────────────────────────────────────────────────────────

export default function StockChart({ hideToolbar = false, onChartReady, smcData = null, smcToggles = null, smcSignals = null, onChartDataReady = null, paData = null, paToggles = null }) {
  const { isDark } = useTheme()
  const {
    selectedSymbol, selectedIndexId, chartType, timeframe,
    activeIndicators: _activeIndicators, isIndex, onHover, onPin, pinnedDate, clearPin,
    activePositions, disableMovers,
  } = useScreen() || {}
  const activeIndicators = Array.isArray(_activeIndicators) ? _activeIndicators : []

  const mainRef    = useRef(null)
  const rsiRef     = useRef(null)
  const macdRef    = useRef(null)
  const atrRef     = useRef(null)
  const chartsRef  = useRef({})
  const seriesRef  = useRef({})
  const moversCache      = useRef({})
  const pendingHover     = useRef(null)
  const lastFetchedDate  = useRef(null)   // prevents duplicate fetch for the same candle date
  const pinnedDateRef  = useRef(pinnedDate)

  // Drawing tools — persisted to localStorage keyed by symbol:timeframe
  const drawKey = isIndex?.()
    ? `chart_drawings:idx:${selectedIndexId}:${timeframe}`
    : `chart_drawings:${selectedSymbol}:${timeframe}`

  // Save drawings to localStorage (called after every add/clear)
  const saveDrawings = useCallback((drawings) => {
    try {
      // Snapshot the array before serialising — prevents concurrent mutation
      // during rapid drawing events from corrupting the stored JSON
      const snapshot = drawings.slice()
      if (snapshot.length === 0) {
        localStorage.removeItem(drawKey)
      } else {
        localStorage.setItem(drawKey, JSON.stringify(snapshot))
      }
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        console.warn('[Tradeo] Drawing storage full — drawings not saved. Clear browser storage to resume.')
      }
      // SecurityError (private mode) — silently ignored
    }
  }, [drawKey])

  // Load saved drawings when symbol/timeframe changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(drawKey)
      drawingsRef.current = saved ? JSON.parse(saved) : []
    } catch {
      drawingsRef.current = []
    }
    setDrawVersion(v => v + 1) // repaint canvas with restored drawings
  }, [drawKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const canvasRef           = useRef(null)
  const priceSeriesRef      = useRef(null)  // set after chart build — needed for coordinate conversion
  const roRef               = useRef(null)  // ResizeObserver — stored independently so cleanup is always reachable
  const drawingsRef         = useRef([])
  const drawPreviewRef      = useRef(null)
  const rafRef              = useRef(null)
  // Always-fresh ref so drawing handlers (inside effects) can call saveDrawings without stale closure
  const saveDrawingsRef     = useRef(saveDrawings)
  useEffect(() => { saveDrawingsRef.current = saveDrawings }, [saveDrawings])

  // Always-fresh ref for onChartReady — the closure in loadLC().then() would otherwise
  // capture the initial value and miss updates (onChartReady is an inline arrow in MultiChart)
  const onChartReadyRef = useRef(onChartReady)
  useEffect(() => { onChartReadyRef.current = onChartReady }, [onChartReady])

  // Action rows for active positions — keyed by trade_id. Fetched when activePositions changes.
  // Stored in a ref so the chart build effect can read them without adding them to its dep array.
  const positionActionsRef  = useRef({})
  const [actionsReady, setActionsReady] = useState(0)  // bump triggers chart rebuild after fetch

  useEffect(() => {
    // Clear immediately so old markers don't flash on the new symbol's chart
    positionActionsRef.current = {}
    if (!activePositions?.length) return
    let cancelled = false
    Promise.all(
      activePositions.map(pos => {
        const id = pos.id || pos.trade_id
        if (!id) return Promise.resolve([id, []])
        return getTradeHistory(id)
          .then(res => [id, res.data || []])
          .catch(() => [id, []])
      })
    ).then(results => {
      if (cancelled) return
      const map = {}
      results.forEach(([id, rows]) => { if (id) map[id] = rows })
      positionActionsRef.current = map
      setActionsReady(v => v + 1)
    })
    return () => { cancelled = true }
  }, [activePositions])

  const [chartData,      setChartData]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [refreshTick,    setRefreshTick]    = useState(0)
  const [error,          setError]          = useState(null)
  const [tooltip,        setTooltip]        = useState(null)
  const [overlayData,    setOverlayData]    = useState(null)
  const [latestClose,    setLatestClose]    = useState(null)
  const [activeTool,     setActiveTool]     = useState(null)
  const [drawVersion,    setDrawVersion]    = useState(0)  // bump to repaint canvas
  const [chartBuiltVer,  setChartBuiltVer]  = useState(0)  // bumps when chart instance is created

  // SMC overlay series — declared after chartBuiltVer to avoid TDZ in the overlay useEffect
  const smcSeriesRef = useRef([])

  // ── SMC overlay drawing — must be after chartBuiltVer declaration ─────────
  useEffect(() => {
    const chart = chartsRef.current.main
    smcSeriesRef.current.forEach(s => { try { chart?.removeSeries(s) } catch (_) {} })
    smcSeriesRef.current = []

    if (!smcData || !smcToggles || !chart || !chartData.length) return
    const lastDate = chartData[chartData.length - 1]?.time
    if (!lastDate) return

    function addLine(fromDate, toDate, level, color, lineStyle = 1, lineWidth = 1.5) {
      try {
        const s = chart.addLineSeries({ color, lineWidth, lineStyle, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        s.setData([{ time: fromDate, value: level }, { time: toDate, value: level }])
        smcSeriesRef.current.push(s)
      } catch (_) {}
    }
    function addZoneBand(fromDate, top, bottom, color) {
      addLine(fromDate, lastDate, top, color, 1, 1)
      addLine(fromDate, lastDate, bottom, color, 1, 1)
    }

    if (smcToggles.showBOS) {
      smcData.bos.filter(b => b.type === 'bullish').slice(-10).forEach(b =>
        addLine(b.swing_date ?? b.date, lastDate, b.level, '#22c55e', 1))
    }
    if (smcToggles.showCHoCH) {
      smcData.choch.filter(c => c.type === 'bullish').slice(-5).forEach(c =>
        addLine(c.swing_date ?? c.date, lastDate, c.level, '#f59e0b', 0, 1.5))
    }
    if (smcToggles.showOB) {
      smcData.order_blocks.filter(o => o.type === 'bullish').slice(-5).forEach(o =>
        addZoneBand(o.date, o.high, o.low, '#22c55e'))
    }
    if (smcToggles.showFVG) {
      smcData.fvg.filter(f => f.type === 'bullish' && !f.mitigated).slice(-5).forEach(f =>
        addZoneBand(f.date, f.top, f.bottom, '#3b82f6'))
    }
    if (smcToggles.showSweeps) {
      smcData.sweeps.filter(s => s.type === 'buy_side').slice(-5).forEach(s =>
        addLine(s.swing_date ?? s.date, lastDate, s.level, '#a78bfa', 1))
    }
    if (smcToggles.showEntry && smcSignals?.length && priceSeriesRef.current) {
      try {
        const existing = priceSeriesRef.current.markers() || []
        const newMarkers = smcSignals.slice(-10).map(sig => ({
          time: sig.date, position: 'belowBar',
          color: sig.score >= 5 ? '#22c55e' : '#86efac',
          shape: 'arrowUp', size: 1, text: `${sig.score}/6`,
        }))
        priceSeriesRef.current.setMarkers(
          [...existing.filter(m => m.shape !== 'arrowUp'), ...newMarkers]
            .sort((a, b) => a.time.localeCompare(b.time))
        )
      } catch (_) {}
    } else if (!smcToggles.showEntry && priceSeriesRef.current) {
      try {
        const existing = priceSeriesRef.current.markers() || []
        priceSeriesRef.current.setMarkers(existing.filter(m => m.shape !== 'arrowUp'))
      } catch (_) {}
    }

    return () => {
      smcSeriesRef.current.forEach(s => { try { chart?.removeSeries(s) } catch (_) {} })
      smcSeriesRef.current = []
    }
  }, [chartBuiltVer, smcData, smcToggles, smcSignals]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── PA series ref — declared after chartBuiltVer to avoid TDZ ───────────
  const paSeriesRef = useRef([])

  // ── Price Action overlay ──────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartsRef.current.main
    paSeriesRef.current.forEach(s => { try { chart?.removeSeries(s) } catch (_) {} })
    paSeriesRef.current = []

    if (!paData || !paToggles || !chart || !chartData.length) return
    const lastDate = chartData[chartData.length - 1]?.time
    if (!lastDate) return

    // Add a horizontal line series extending from fromDate to lastDate
    const addLine = (fromDate, level, color, lineWidth = 1, lineStyle = 0) => {
      if (!fromDate || !level) return
      try {
        const s = chart.addLineSeries({ color, lineWidth, lineStyle, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        s.setData([{ time: fromDate, value: level }, { time: lastDate, value: level }])
        paSeriesRef.current.push(s)
      } catch (_) {}
    }

    // Add a translucent zone band (two border lines only — no fill series in LW Charts v4)
    const addZoneBand = (fromDate, top, bottom, color) => {
      if (!fromDate || !top || !bottom) return
      try {
        const rgba = color + '66'
        const sTop = chart.addLineSeries({ color: rgba, lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        sTop.setData([{ time: fromDate, value: top }, { time: lastDate, value: top }])
        const sBot = chart.addLineSeries({ color: rgba, lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        sBot.setData([{ time: fromDate, value: bottom }, { time: lastDate, value: bottom }])
        paSeriesRef.current.push(sTop, sBot)
      } catch (_) {}
    }

    // Swing markers (HH/HL/LH/LL) — drawn as price markers on the price series
    if (paToggles.showSwings && paData.swings?.length && priceSeriesRef.current) {
      try {
        const existing = priceSeriesRef.current.markers() || []
        const swingMarkers = paData.swings.slice(-20).map(sw => ({
          time:     sw.date,
          position: (sw.type === 'HH' || sw.type === 'LH') ? 'aboveBar' : 'belowBar',
          color:    sw.type === 'HH' ? '#3b82f6'
                  : sw.type === 'HL' ? '#60a5fa'
                  : sw.type === 'LH' ? '#9ca3af'
                  : '#f87171',
          shape: (sw.type === 'HH' || sw.type === 'LH') ? 'arrowDown' : 'arrowUp',
          text:  sw.type,
          size:  1,
        }))
        // Merge with existing markers (e.g. SMC entry markers) and sort by time
        const merged = [...existing.filter(m => !['HH','HL','LH','LL'].includes(m.text)), ...swingMarkers]
          .sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0)
        priceSeriesRef.current.setMarkers(merged)
      } catch (_) {}
    } else if (!paToggles.showSwings && priceSeriesRef.current) {
      try {
        const existing = priceSeriesRef.current.markers() || []
        priceSeriesRef.current.setMarkers(existing.filter(m => !['HH','HL','LH','LL'].includes(m.text)))
      } catch (_) {}
    }

    // S/R horizontal lines
    if (paToggles.showSR && paData.support_resistance?.length) {
      paData.support_resistance.forEach(z => {
        const color    = z.type === 'resistance' ? '#ef4444' : '#22c55e'
        const lw       = z.strength === 'strong' ? 2 : 1
        const earliest = chartData[0]?.time ?? lastDate
        addLine(earliest, z.price, color, lw)
      })
    }

    // Demand/Supply zone bands
    if (paToggles.showZones && paData.demand_supply?.length) {
      paData.demand_supply.forEach(z => {
        const color   = z.type === 'demand' ? '#22c55e' : '#ef4444'
        const fromDate = z.origin_date ?? chartData[0]?.time
        addZoneBand(fromDate, z.top, z.bottom, color)
      })
    }

    // Volume spike markers
    if (paToggles.showVolume && paData.volume_spikes?.length && priceSeriesRef.current) {
      try {
        const existing = priceSeriesRef.current.markers() || []
        const volMarkers = paData.volume_spikes.slice(-15).map(sp => ({
          time:     sp.date,
          position: sp.type === 'bull' ? 'belowBar' : 'aboveBar',
          color:    sp.type === 'bull' ? '#a855f7' : '#7c3aed',
          shape:    sp.type === 'bull' ? 'arrowUp' : 'arrowDown',
          text:     `${sp.ratio}×`,
          size:     1,
        }))
        const merged = [...existing.filter(m => !m.text?.endsWith('×')), ...volMarkers]
          .sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0)
        priceSeriesRef.current.setMarkers(merged)
      } catch (_) {}
    } else if (!paToggles.showVolume && priceSeriesRef.current) {
      try {
        const existing = priceSeriesRef.current.markers() || []
        priceSeriesRef.current.setMarkers(existing.filter(m => !m.text?.endsWith('×')))
      } catch (_) {}
    }

    // Candle pattern markers
    if (paToggles.showPatterns && paData.patterns?.length && priceSeriesRef.current) {
      const ABBREV = {
        bullish_engulfing: 'ENG', bearish_engulfing: 'ENG',
        hammer: 'HAM', shooting_star: 'SS',
        bullish_pin: 'PIN', bearish_pin: 'PIN',
        inside_bar: 'IB', doji: 'DOJ',
      }
      try {
        const existing = priceSeriesRef.current.markers() || []
        const ptMarkers = paData.patterns.slice(-20).map(pt => ({
          time:     pt.date,
          position: pt.direction === 'bull' ? 'belowBar' : 'aboveBar',
          color:    pt.direction === 'bull' ? '#f59e0b' : '#d97706',
          shape:    pt.direction === 'bull' ? 'arrowUp' : 'arrowDown',
          text:     ABBREV[pt.type] ?? pt.type.slice(0, 3).toUpperCase(),
          size:     1,
        }))
        const ptTypes = new Set(Object.values(ABBREV))
        const merged = [...existing.filter(m => !ptTypes.has(m.text)), ...ptMarkers]
          .sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0)
        priceSeriesRef.current.setMarkers(merged)
      } catch (_) {}
    } else if (!paToggles.showPatterns && priceSeriesRef.current) {
      try {
        const ABBREV_VALS = new Set(['ENG','HAM','SS','PIN','IB','DOJ'])
        const existing = priceSeriesRef.current.markers() || []
        priceSeriesRef.current.setMarkers(existing.filter(m => !ABBREV_VALS.has(m.text)))
      } catch (_) {}
    }

    return () => {
      paSeriesRef.current.forEach(s => { try { chart?.removeSeries(s) } catch (_) {} })
      paSeriesRef.current = []
    }
  }, [chartBuiltVer, paData, paToggles]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh handler — clears cache and bumps refreshTick to re-fire fetch effect
  const handleRefresh = useCallback(() => {
    const cacheKey = isIndex()
      ? `idx:${selectedIndexId}:${timeframe}`
      : `${selectedSymbol}:${timeframe}`
    _chartCache.delete(cacheKey)
    setRefreshTick(t => t + 1)
  }, [isIndex, selectedIndexId, selectedSymbol, timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  // Always-fresh ref so drawing onContextMenu can call it without stale closure
  const handleRefreshRef = useRef(handleRefresh)
  useEffect(() => { handleRefreshRef.current = handleRefresh }, [handleRefresh])

  // Right-click context menu state — position + whether a drawing was hit
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, hitIdx } | null

  // ── Portal controls into ScreenPage tab bar ───────────────────────────────
  // hideToolbar=true when inside MultiChart panel — panel has its own header controls
  const toolbarPortal = useScreenToolbarSlot(hideToolbar ? null :
    <div className="flex items-center gap-1.5 min-w-0">
      {/* Symbol search — must NOT sit inside overflow-x-auto (clips dropdown).
          The slot container in ScreenPage uses overflow-x-auto for the rest of
          the controls; search is shrink-0 so it anchors at the left. */}
      <ChartSymbolSearch />
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
      {/* Chart type + timeframes — scrollable section */}
      <div className="flex-1 overflow-x-auto min-w-0 no-scrollbar">
        <ChartHUDControls />
      </div>
      {/* Indicators + drawing tools — always at far right, outside overflow */}
      <ChartIndicatorDropdown
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        drawCount={drawingsRef.current.length}
        onClearDrawings={() => {
          drawingsRef.current = []
          drawPreviewRef.current = null
          saveDrawingsRef.current([])
          setActiveTool(null)
          setDrawVersion(v => v + 1)
        }}
      />
    </div>
  )

  const C = {
    bg:     isDark ? '#0c152936' : '#fafafa',
    grid:   'transparent',
    text:   isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#111827' : '#f3f4f6',
    up:     '#10b981',
    down:   '#ef4444',
    ma:     '#3b82f6',
    ema:    '#f59e0b',
    rsi:    '#a78bfa',
    macd:   '#60a5fa',
    signal: '#f59e0b',
  }

  // Debounced movers fetch — avoids spamming on every crosshair pixel
  const getMovers = useCallback(async (date) => {
    if (!date) return null
    if (moversCache.current[date]) return moversCache.current[date]
    try {
      const r = await getTopMovers(date)
      moversCache.current[date] = r.data
      return r.data
    } catch { return null }
  }, [])

  // Fetch chart data — with client-side cache to avoid redundant server hits
  useEffect(() => {
    setError(null); setTooltip(null); setOverlayData(null); setChartData([])
    lastFetchedDate.current = null   // reset date guard on every symbol/timeframe change

    const cacheKey = isIndex()
      ? `idx:${selectedIndexId}:${timeframe}`
      : `${selectedSymbol}:${timeframe}`

    // Serve from cache immediately if fresh — eliminates loading flash on timeframe/symbol switching
    const cached = _chartCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CHART_TTL) {
      setChartData(cached.data)
      setLatestClose(cached.latest)
      setLoading(false)
      onChartDataReady?.(cached.data)
      return
    }

    setLoading(true)
    let cancelled = false

    const req = isIndex()
      ? getIndexChart({ index_id: selectedIndexId, timeframe })
      : getStockChart({ symbol: selectedSymbol, timeframe })

    req.then(async r => {
      if (cancelled) return
      const data = r.data.data || []
      const latest = data.length > 0 ? data[data.length - 1].close : null
      _chartCache.set(cacheKey, { data, latest, ts: Date.now() })
      setChartData(data)
      setLatestClose(latest)
      setLoading(false)
      onChartDataReady?.(data)

      // Gap detection: if latest candle is older than expected, trigger backfill
      if (data.length > 0) {
        const latestCandle = data[data.length - 1].time // 'YYYY-MM-DD'
        const nowNPT = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
        const hNPT = nowNPT.getUTCHours()
        const mNPT = nowNPT.getUTCMinutes()
        const afterClose = hNPT > 15 || (hNPT === 15 && mNPT >= 10)
        if (!afterClose) return

        const expected = (() => {
          const d = new Date(nowNPT)
          for (let i = 0; i < 7; i++) {
            const s = d.toISOString().slice(0, 10)
            const dow = d.getUTCDay()
            // NEPSE switched to Sun–Thu (Sat+Sun off) starting Nepali year 2082 (≈ mid-April 2025).
            // Use April 13 of each Gregorian year as the conservative cutoff for the new weekend rule.
            const year = parseInt(s.slice(0, 4))
            const nepaliNewYearApprox = `${year}-04-13`
            const isWeekend = s >= nepaliNewYearApprox ? (dow === 0 || dow === 6) : (dow === 5 || dow === 6)
            if (!isWeekend) return s
            d.setUTCDate(d.getUTCDate() - 1)
          }
        })()

        if (latestCandle < expected) {
          try {
            const wasIndex = isIndex()
            const bf = await triggerBackfill(expected)
            if (bf.data?.filled) {
              const reloaded = wasIndex
                ? await getIndexChart({ index_id: selectedIndexId, timeframe })
                : await getStockChart({ symbol: selectedSymbol, timeframe })
              const fresh = reloaded.data.data || []
              const freshLatest = fresh.length > 0 ? fresh[fresh.length - 1].close : null
              // Update cache with fresh data after backfill
              _chartCache.set(cacheKey, { data: fresh, latest: freshLatest, ts: Date.now() })
              setChartData(fresh)
              setLatestClose(freshLatest)
            }
          } catch { /* backfill is best-effort */ }
        }
      }
    }).catch(e => {
      if (cancelled) return
      setError(e.response?.data?.error || 'Failed to load chart data')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [selectedSymbol, selectedIndexId, timeframe, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build / rebuild charts
  useEffect(() => {
    if (loading || !chartData.length || !mainRef.current) return

    Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
    chartsRef.current = {}; seriesRef.current = {}

    const changeMap = {}
    chartData.forEach(d => { changeMap[d.time] = d.diff_pct ?? d.per_change })

    let cancelled = false
    const timeScaleUnsubs = []

    loadLC().then(({ createChart, CrosshairMode, LineStyle }) => {
      if (cancelled || !mainRef.current) return

      const base = {
        layout:         { background: { color: C.bg }, textColor: C.text, fontSize: 11 },
        attributionLogo: false,
        grid:           { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
        crosshair: {
          mode:     CrosshairMode.Normal,
          vertLine: { width: 1, color: '#363a45', style: LineStyle.Solid },
          horzLine: { width: 1, color: '#363a45', style: LineStyle.Solid },
        },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.12 } },
        timeScale: { borderColor: C.border, timeVisible: true, fixLeftEdge: true, fixRightEdge: false, rightOffset: 5 },
        handleScroll: true, handleScale: true,
      }

      const main = createChart(mainRef.current, {
        ...base,
        width:  mainRef.current.clientWidth,
        height: mainRef.current.clientHeight,
      })
      chartsRef.current.main = main
      setChartBuiltVer(v => v + 1)

      let priceSeries
      if (chartType === 'candlestick') {
        priceSeries = main.addCandlestickSeries({
          upColor: C.up, downColor: C.down,
          borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up + 'cc', wickDownColor: C.down + 'cc',
        })
        priceSeries.setData(chartData)
      } else {
        priceSeries = main.addAreaSeries({
          lineColor: C.ma, topColor: C.ma + '33', bottomColor: C.ma + '00',
          lineWidth: 2, priceLineVisible: true,
        })
        priceSeries.setData(chartData.map(d => ({ time: d.time, value: d.close })))
      }
      seriesRef.current.price = priceSeries
      priceSeriesRef.current  = priceSeries

      // Notify parent with both chart + series — series required for setCrosshairPosition
      onChartReadyRef.current?.(main, priceSeries)

      // MA overlay
      if (activeIndicators.includes('MA')) {
        const ma = calcMA(chartData, 20)
        if (ma.length) {
          const s = main.addLineSeries({ color: C.ma + '90', lineWidth: 1.5, priceLineVisible: false, title: 'MA20' })
          s.setData(ma)
        }
      }

      // EMA overlay
      if (activeIndicators.includes('EMA')) {
        const ema = calcEMA(chartData, 20)
        if (ema.length) {
          const s = main.addLineSeries({ color: C.ema + 'cc', lineWidth: 1.5, priceLineVisible: false, title: 'EMA20' })
          s.setData(ema)
        }
      }

      // Bollinger Bands overlay
      if (activeIndicators.includes('BB')) {
        const { upper, lower, mid } = calcBB(chartData, 20, 2)
        if (upper.length) {
          const sU = main.addLineSeries({ color: '#a78bfa88', lineWidth: 1, priceLineVisible: false, title: 'BB+' })
          const sL = main.addLineSeries({ color: '#a78bfa88', lineWidth: 1, priceLineVisible: false, title: 'BB-' })
          const sM = main.addLineSeries({ color: '#a78bfa55', lineWidth: 1, lineStyle: 2, priceLineVisible: false, title: '' })
          sU.setData(upper); sL.setData(lower); sM.setData(mid)
        }
      }

      // Position lines + markers
      const ENTRY_COLORS = ['#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#f472b6']
      const markers = []

      if (activePositions?.length) {
        activePositions.forEach((pos, idx) => {
          const { entry_price, sl, tp, entry_date, date: trade_date, position: dir } = pos
          const tradeId    = pos.id || pos.trade_id
          const entryColor = ENTRY_COLORS[idx % ENTRY_COLORS.length]
          // entry_date: set by LogsPage/Portfolio "Go to Chart" mapping
          // trade_date: raw trade_log row clicked from LeftPanel (has `date` not `entry_date`)
          const entryStr = (entry_date || trade_date) ? (entry_date || trade_date).slice(0, 10) : null
          // First candle at or after entry date (used for marker and scroll)
          const entryCandle = entryStr ? chartData.find(d => d.time >= entryStr) : null

          const addPosLine = (price, color, lineStyle, label) => {
            if (!price) return
            const s = main.addLineSeries({
              color, lineWidth: 1.5, lineStyle,
              priceLineVisible: false, lastValueVisible: true,
              title: activePositions.length > 1 ? `${label}${idx + 1}` : label,
              crosshairMarkerVisible: false,
            })
            const priceVal = parseFloat(price)
            // Whitespace (no value) before entry date — line is invisible before the entry,
            // regardless of how far back the chart data extends
            s.setData(chartData.map(d =>
              entryStr && d.time < entryStr
                ? { time: d.time }                   // gap: no line drawn
                : { time: d.time, value: priceVal }  // line visible from entry onwards
            ))
          }

          addPosLine(entry_price, entryColor, 0, 'Entry')
          addPosLine(sl, idx === 0 ? '#f87171' : '#fca5a5', 2, 'SL')
          addPosLine(tp, idx === 0 ? '#34d399' : '#6ee7b7', 2, 'TP')

          // Entry marker at the exact entry candle
          if (entryCandle) {
            markers.push({
              time:     entryCandle.time,
              position: dir === 'SHORT' ? 'aboveBar' : 'belowBar',
              color:    entryColor,
              shape:    dir === 'SHORT' ? 'arrowDown' : 'arrowUp',
              text:     activePositions.length > 1 ? `E${idx + 1}` : '',
              size:     2,
            })
          }

          // ADD / SELL markers — derived from v2.2 action rows (fetched async, stored in ref)
          const actionRows = tradeId ? (positionActionsRef.current[tradeId] || []) : []
          actionRows.forEach(row => {
            const rowDate = row.date ? row.date.slice(0, 10) : null
            if (!rowDate) return
            const rowCandle = chartData.find(d => d.time >= rowDate)
            if (!rowCandle) return

            if (row.action_type === 'Add Position') {
              markers.push({
                time:     rowCandle.time,
                position: dir === 'SHORT' ? 'aboveBar' : 'belowBar',
                color:    entryColor,
                shape:    'circle',
                text:     '+',
                size:     1,
              })
            } else if (row.action_type === 'Partial Exit') {
              markers.push({
                time:     rowCandle.time,
                position: dir === 'SHORT' ? 'belowBar' : 'aboveBar',
                color:    '#f59e0b',
                shape:    'circle',
                text:     '−',
                size:     1,
              })
            } else if (row.action_type === 'Close Position' || row.action_type === 'Reversal') {
              markers.push({
                time:     rowCandle.time,
                position: dir === 'SHORT' ? 'belowBar' : 'aboveBar',
                color:    '#f87171',
                shape:    dir === 'SHORT' ? 'arrowUp' : 'arrowDown',
                text:     activePositions.length > 1 ? `X${idx + 1}` : 'X',
                size:     2,
              })
            }
          })
        })
      }

      // Volume histogram
      const volSeries = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
      main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })
      volSeries.setData(chartData.map(d => ({
        time: d.time, value: d.volume || d.turnover || 0,
        color: d.close >= d.open ? C.up + '70' : C.down + '70',
      })))

      if (markers.length) priceSeries.setMarkers(markers)

      // Crosshair events — movers fetch only for NEPSE index charts, never for stock symbols.
      // isIndex() is called inside each handler (not captured at build time) so switching
      // symbol→index or index→symbol always evaluates the current state.
      main.subscribeCrosshairMove(param => {
        if (pinnedDateRef.current) return
        if (cancelled) return
        if (!param.time) { setTooltip(null); setOverlayData(null); onHover(null, null); return }
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })
        // Movers data loads on click only — see subscribeClick below
      })

      main.subscribeClick(async param => {
        if (cancelled) return
        if (!param.time) return
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })

        if (!isIndex?.() || disableMovers) return
        if (pendingHover.current) { clearTimeout(pendingHover.current); pendingHover.current = null }
        lastFetchedDate.current = param.time
        const movers = await getMovers(param.time)
        if (cancelled) return
        setOverlayData({ date: param.time, movers, pinned: true })
        onPin(param.time, movers)
      })

      // ── Sub-pane sync — one-way only (main → sub) prevents feedback loop.
      // Guard flag `syncing` stops the sub-pane subscriber from re-updating main.
      // All unsubscribe functions collected so cleanup removes them precisely.
      // RSI sub-pane
      if (activeIndicators.includes('RSI') && rsiRef.current) {
        const rsiData = calcRSI(chartData)
        if (rsiData.length) {
          const rc = createChart(rsiRef.current, {
            ...base,
            width: rsiRef.current.clientWidth,
            height: rsiRef.current.clientHeight,
            rightPriceScale: { ...base.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
          })
          chartsRef.current.rsi = rc
          rc.addLineSeries({ color: C.rsi, lineWidth: 1.5, priceLineVisible: false }).setData(rsiData)
          rc.addLineSeries({ color: C.down + '80', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(rsiData.map(d => ({ time: d.time, value: 70 })))
          rc.addLineSeries({ color: C.up + '80', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(rsiData.map(d => ({ time: d.time, value: 30 })))
          let rsiSyncing = false
          const unsubMainRsi = main.timeScale().subscribeVisibleLogicalRangeChange(r => {
            if (r && !rsiSyncing) { rsiSyncing = true; rc.timeScale().setVisibleLogicalRange(r); rsiSyncing = false }
          })
          timeScaleUnsubs.push(unsubMainRsi)
        }
      }

      // MACD sub-pane
      if (activeIndicators.includes('MACD') && macdRef.current) {
        const { macd, signal, hist } = calcMACD(chartData)
        if (macd.length) {
          const mc = createChart(macdRef.current, {
            ...base,
            width: macdRef.current.clientWidth,
            height: macdRef.current.clientHeight,
          })
          chartsRef.current.macd = mc
          mc.addLineSeries({ color: C.macd, lineWidth: 1.5, priceLineVisible: false }).setData(macd)
          mc.addLineSeries({ color: C.signal, lineWidth: 1.5, priceLineVisible: false }).setData(signal)
          mc.addHistogramSeries({ priceLineVisible: false }).setData(
            hist.map(d => ({ ...d, color: d.value >= 0 ? C.up + '99' : C.down + '99' }))
          )
          let macdSyncing = false
          const unsubMainMacd = main.timeScale().subscribeVisibleLogicalRangeChange(r => {
            if (r && !macdSyncing) { macdSyncing = true; mc.timeScale().setVisibleLogicalRange(r); macdSyncing = false }
          })
          timeScaleUnsubs.push(unsubMainMacd)
        }
      }

      // ATR sub-pane
      if (activeIndicators.includes('ATR') && atrRef.current) {
        const atrData = calcATR(chartData)
        if (atrData.length) {
          const ac = createChart(atrRef.current, {
            ...base,
            width: atrRef.current.clientWidth,
            height: atrRef.current.clientHeight,
          })
          chartsRef.current.atr = ac
          ac.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, title: 'ATR14' }).setData(atrData)
          let atrSyncing = false
          const unsubMainAtr = main.timeScale().subscribeVisibleLogicalRangeChange(r => {
            if (r && !atrSyncing) { atrSyncing = true; ac.timeScale().setVisibleLogicalRange(r); atrSyncing = false }
          })
          timeScaleUnsubs.push(unsubMainAtr)
        }
      }

      // ── Zoom logic ─────────────────────────────────────────────────────────
      // Priority: positions > saved zoom > default 120-bar window
      const zoomKey = isIndex()
        ? `idx:${selectedIndexId}:${timeframe}`
        : `${selectedSymbol}:${timeframe}`

      const applyZoom = () => {
        // 1. Position view — scroll to show entry date
        if (activePositions?.length) {
          const allEntryDates = []
          activePositions.forEach(p => {
            const ed = p.entry_date || p.date
            if (ed) allEntryDates.push(ed.slice(0, 10))
            const id = p.id || p.trade_id
            const rows = id ? (positionActionsRef.current[id] || []) : []
            rows.forEach(row => { if (row.date) allEntryDates.push(row.date.slice(0, 10)) })
          })
          const earliest = allEntryDates.filter(Boolean).sort()[0]
          if (earliest) {
            const entryIdx = chartData.findIndex(d => d.time >= earliest)
            if (entryIdx > 0) {
              main.timeScale().setVisibleLogicalRange({
                from: Math.max(0, entryIdx - 20),
                to:   chartData.length + 3,
              })
              return
            }
          }
        }

        // 2. Saved zoom — restore last known position for this symbol+timeframe
        const saved = _zoomMemory.get(zoomKey)
        if (saved) {
          main.timeScale().setVisibleLogicalRange(saved)
          return
        }

        // 3. Default — show last 120 bars (~6 months) so candles are readable
        const defaultBars = 120
        const from = Math.max(0, chartData.length - defaultBars)
        main.timeScale().setVisibleLogicalRange({ from, to: chartData.length + 3 })
      }

      applyZoom()

      // Save zoom whenever the user scrolls or scales — cap map at 100 entries
      const unsubZoom = main.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (!range) return
        if (_zoomMemory.size >= 100) _zoomMemory.delete(_zoomMemory.keys().next().value)
        _zoomMemory.set(zoomKey, { from: range.from, to: range.to })
      })
      timeScaleUnsubs.push(unsubZoom)

      // Resize — batched via RAF so rapid resize events collapse into one frame
      let resizeRaf = null
      roRef.current = new ResizeObserver(() => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf)
        resizeRaf = requestAnimationFrame(() => {
          if (mainRef.current && chartsRef.current.main) {
            chartsRef.current.main.applyOptions({
              width:  mainRef.current.clientWidth,
              height: mainRef.current.clientHeight,
            })
          }
          if (rsiRef.current && chartsRef.current.rsi) {
            chartsRef.current.rsi.applyOptions({
              width:  rsiRef.current.clientWidth,
              height: rsiRef.current.clientHeight,
            })
          }
          if (macdRef.current && chartsRef.current.macd) {
            chartsRef.current.macd.applyOptions({
              width:  macdRef.current.clientWidth,
              height: macdRef.current.clientHeight,
            })
          }
          if (atrRef.current && chartsRef.current.atr) {
            chartsRef.current.atr.applyOptions({
              width:  atrRef.current.clientWidth,
              height: atrRef.current.clientHeight,
            })
          }
        }) // end RAF
      })  // end ResizeObserver
      if (mainRef.current) roRef.current.observe(mainRef.current)
    })

    return () => {
      cancelled = true
      if (pendingHover.current) clearTimeout(pendingHover.current)
      if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
      // Unsubscribe all time-scale listeners before removing charts
      timeScaleUnsubs.forEach(fn => { try { fn?.() } catch (_) {} })
      onChartReadyRef.current?.(null, null)  // clear stale refs in parent before removing
      Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
      chartsRef.current = {}
    }
  }, [chartData, chartType, activeIndicators, activePositions, actionsReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme color changes without rebuilding the chart — avoids full rebuild on dark/light toggle
  useEffect(() => {
    const bg   = isDark ? '#0d1117' : '#fafafa'
    const text = isDark ? '#6b7280' : '#9ca3af'
    const border = isDark ? '#111827' : '#f3f4f6'
    Object.values(chartsRef.current).forEach(c => {
      try {
        c.applyOptions({
          layout: { background: { color: bg }, textColor: text },
          rightPriceScale: { borderColor: border },
          timeScale: { borderColor: border },
        })
      } catch (_) {}
    })
  }, [isDark])

  useEffect(() => {
    pinnedDateRef.current = pinnedDate
    if (!pinnedDate) setOverlayData(prev => prev ? { ...prev, pinned: false } : null)
  }, [pinnedDate])

  // Keep canvas sized to mainRef and repaint on every chart scroll/scale
  useEffect(() => {
    const chart = chartsRef.current.main
    const canvas = canvasRef.current
    const ps = priceSeriesRef.current
    if (!chart || !canvas || !ps || !mainRef.current) return

    function syncSize() {
      const w = mainRef.current?.clientWidth  || 0
      const h = mainRef.current?.clientHeight || 0
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w
        canvas.height = h
      }
    }

    function repaint() {
      syncSize()
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderDrawings(ctx, canvas, chart, ps, drawingsRef.current, drawPreviewRef.current, isDark)
    }

    function scheduleRepaint() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(repaint)
    }

    repaint()
    // Re-draw whenever chart scrolls or scales
    chart.timeScale().subscribeVisibleTimeRangeChange(scheduleRepaint)
    const ro = new ResizeObserver(scheduleRepaint)
    if (mainRef.current) ro.observe(mainRef.current)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { chart.timeScale().unsubscribeVisibleTimeRangeChange(scheduleRepaint) } catch (_) {}
      ro.disconnect()
    }
  }, [chartBuiltVer, isDark, activeTool, drawVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drawing mouse handlers — re-registers whenever chartBuiltVer changes (new chart instance)
  const activeToolRef = useRef(activeTool)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])

  useEffect(() => {
    // Attach to mainRef so events fire regardless of canvas pointer-events setting
    const container = mainRef.current
    if (!container) return

    const DRAW_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#a78bfa','#f472b6']
    let colorIdx = 0
    const nextColor = () => DRAW_COLORS[colorIdx++ % DRAW_COLORS.length]

    function getCtx() { return chartsRef.current.main }
    function getPs()  { return priceSeriesRef.current }

    function repaintNow() {
      const chart = getCtx(), ps = getPs(), canvas = canvasRef.current
      if (!chart || !ps || !canvas) return
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderDrawings(ctx, canvas, chart, ps, drawingsRef.current, drawPreviewRef.current, isDark)
    }

    function scheduleRepaint() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(repaintNow)
    }

    function getPoint(e) {
      const chart = getCtx(), ps = getPs()
      if (!chart || !ps) return null
      return pixelToChart(chart, ps, container, e)
    }

    function onMouseDown(e) {
      const tool = activeToolRef.current
      if (!tool) return
      e.preventDefault()
      const pt = getPoint(e)
      if (!pt) return

      if (tool === 'horizontal') {
        if (pt.price == null) return
        drawingsRef.current.push({ type: 'horizontal', time: pt.time, price: pt.price, color: nextColor() })
        saveDrawingsRef.current(drawingsRef.current)
        setDrawVersion(v => v + 1)
        // clear preview so hover-preview resets (tool stays active)
        drawPreviewRef.current = null
      } else if (tool === 'vertical') {
        if (pt.time == null) return
        drawingsRef.current.push({ type: 'vertical', time: pt.time, price: pt.price, color: nextColor() })
        saveDrawingsRef.current(drawingsRef.current)
        setDrawVersion(v => v + 1)
        drawPreviewRef.current = null
      } else if (tool === 'trendline' || tool === 'ray' || tool === 'fib') {
        drawPreviewRef.current = { tool, start: pt, end: pt, color: nextColor() }
      } else if (tool === 'path') {
        if (!drawPreviewRef.current) {
          drawPreviewRef.current = { tool, points: [{ time: pt.time, price: pt.price }], end: pt, color: nextColor() }
        } else {
          drawPreviewRef.current.points.push({ time: pt.time, price: pt.price })
          drawPreviewRef.current.end = pt
        }
      }
      scheduleRepaint()
    }

    function onMouseMove(e) {
      const tool = activeToolRef.current
      if (!tool) return
      const pt = getPoint(e)
      if (!pt) return
      if (drawPreviewRef.current) {
        drawPreviewRef.current.end = pt
        scheduleRepaint()
      } else if (tool === 'horizontal' || tool === 'vertical') {
        drawPreviewRef.current = { tool, start: pt, end: pt, color: '#f59e0b' }
        scheduleRepaint()
      }
    }

    function onMouseUp(e) {
      const tool = activeToolRef.current
      const preview = drawPreviewRef.current
      if (!tool) return
      if (!preview) return
      if (tool === 'path') return
      if (tool === 'horizontal' || tool === 'vertical') {
        drawPreviewRef.current = null
        scheduleRepaint()
        return
      }
      const pt = getPoint(e)
      if (!pt) return

      if (tool === 'trendline' || tool === 'ray' || tool === 'fib') {
        const moved = Math.abs(pt.x - preview.start.x) > 4 || Math.abs(pt.y - preview.start.y) > 4
        if (moved) {
          drawingsRef.current.push({
            type: tool, color: preview.color,
            t1: preview.start.time, p1: preview.start.price,
            t2: pt.time,            p2: pt.price,
          })
          saveDrawingsRef.current(drawingsRef.current)
          setDrawVersion(v => v + 1)
        }
        // Tool stays active — only clear the in-progress preview
        drawPreviewRef.current = null
        scheduleRepaint()
      }
    }

    function onDblClick(e) {
      const tool = activeToolRef.current
      const preview = drawPreviewRef.current
      if (tool === 'path' && preview?.points?.length >= 2) {
        drawingsRef.current.push({ type: 'path', color: preview.color, points: preview.points })
        saveDrawingsRef.current(drawingsRef.current)
        setDrawVersion(v => v + 1)
        drawPreviewRef.current = null
        scheduleRepaint()
      }
    }

    function onContextMenu(e) {
      e.preventDefault()
      const tool = activeToolRef.current

      // Cancel in-progress drawing first — no menu
      if (tool && drawPreviewRef.current) {
        drawPreviewRef.current = null
        scheduleRepaint()
        return
      }

      // Hit-test committed drawings
      const bRect = container.getBoundingClientRect()
      const mx = e.clientX - bRect.left
      const my = e.clientY - bRect.top
      const chart = getCtx(), ps = getPs()
      const hitIdx = (chart && ps)
        ? hitTestDrawing(mx, my, drawingsRef.current, chart, ps)
        : -1

      // Show context menu at cursor position
      setCtxMenu({ x: e.clientX, y: e.clientY, hitIdx })
    }

    function onMouseLeave() {
      const tool = activeToolRef.current
      if (tool === 'horizontal' || tool === 'vertical') {
        drawPreviewRef.current = null
        scheduleRepaint()
      }
    }

    // Escape key — cancel active tool and any in-progress drawing
    function onKeyDown(e) {
      if (e.key === 'Escape' && activeToolRef.current) {
        drawPreviewRef.current = null
        setActiveTool(null)
        scheduleRepaint()
      }
    }

    container.addEventListener('mousedown',   onMouseDown)
    container.addEventListener('mousemove',   onMouseMove)
    container.addEventListener('mouseup',     onMouseUp)
    container.addEventListener('dblclick',    onDblClick)
    container.addEventListener('contextmenu', onContextMenu)
    container.addEventListener('mouseleave',  onMouseLeave)
    window.addEventListener('keydown',        onKeyDown)

    return () => {
      container.removeEventListener('mousedown',   onMouseDown)
      container.removeEventListener('mousemove',   onMouseMove)
      container.removeEventListener('mouseup',     onMouseUp)
      container.removeEventListener('dblclick',    onDblClick)
      container.removeEventListener('contextmenu', onContextMenu)
      container.removeEventListener('mouseleave',  onMouseLeave)
      window.removeEventListener('keydown',        onKeyDown)
    }
  }, [chartBuiltVer]) // eslint-disable-line react-hooks/exhaustive-deps

  const showRSI   = activeIndicators.includes('RSI')
  const showMACD  = activeIndicators.includes('MACD')
  const showATR   = activeIndicators.includes('ATR')
  const indCount  = (showRSI ? 1 : 0) + (showMACD ? 1 : 0) + (showATR ? 1 : 0)
  const mainPct   = indCount === 0 ? 100 : indCount === 1 ? 70 : indCount === 2 ? 55 : indCount === 3 ? 45 : 40

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-[12px] text-gray-400">{error}</p>
      <button
        onClick={() => { setError(null); setLoading(true) }}
        className="text-[10px] text-blue-500 hover:underline"
      >Retry</button>
    </div>
  )

  const subPanePct = indCount === 0 ? 0 : Math.round((100 - mainPct) / indCount)

  return (
    <>
    {/* Portal the toolbar controls up into ScreenPage's tab bar slot */}
    {toolbarPortal}

    {/* ── Right-click context menu ─────────────────────────────────────────── */}
    {ctxMenu && createPortal(
      <>
        {/* Backdrop — click outside closes */}
        <div className="fixed inset-0 z-[9998]" onClick={() => setCtxMenu(null)} />
        <div
          className="fixed z-[9999] min-w-[160px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1 animate-menu-in"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth  - 176),
            top:  Math.min(ctxMenu.y, window.innerHeight - (ctxMenu.hitIdx >= 0 ? 108 : 52)),
          }}
        >
          {/* Refresh */}
          <button
            onClick={() => { handleRefreshRef.current(); setCtxMenu(null) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors text-left"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Refresh Chart
          </button>

          {/* Delete drawing — only when a drawing was hit */}
          {ctxMenu.hitIdx >= 0 && (
            <>
              <div className="h-px bg-gray-100 dark:bg-gray-800 mx-2 my-1" />
              <button
                onClick={() => {
                  drawingsRef.current.splice(ctxMenu.hitIdx, 1)
                  saveDrawingsRef.current(drawingsRef.current)
                  setDrawVersion(v => v + 1)
                  setCtxMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
                Delete Drawing
              </button>
            </>
          )}
        </div>
      </>,
      document.body
    )}

    <div className="flex flex-col w-full h-full overflow-hidden" style={{ background: isDark ? '#0d1117' : '#fafafa' }}>

      {/* ── Overlays (absolute inside the chart area below) ── */}

      {/* ── Chart area ── */}
      {/* Position badge rendered outside loading gate so it's visible during chart load */}
      {!loading && <PositionBadge positions={activePositions} latestClose={latestClose} />}

      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden animate-chart-in">

          {/* Price overlay top-left — key on symbol so it fades on symbol change */}
          <div className="absolute top-2 left-3 z-20 pointer-events-none">
            {chartData.length > 0 && (
              <div key={selectedSymbol} className="animate-fade-up">
                <ChartHUDPrice latestClose={latestClose} chartData={chartData} />
              </div>
            )}
          </div>

          {/* OHLC tooltip */}
          <OHLCTooltip bar={tooltip} change={tooltip?.change} />

          {/* Pinned hint — only shown for index charts */}
          {overlayData?.pinned && isIndex?.() && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="text-[10px] text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                📌 Movers shown in right panel — click to unpin
              </span>
            </div>
          )}

          {/* Active drawing tool hint — bottom-center */}
          {activeTool && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <span className="text-[10px] text-white bg-amber-600/90 px-2.5 py-1 rounded-full shadow whitespace-nowrap">
                {activeTool === 'horizontal' ? 'Click to place · Esc to exit · Right-click drawing to delete'
                : activeTool === 'vertical'  ? 'Click to place · Esc to exit · Right-click drawing to delete'
                : activeTool === 'path'      ? 'Click points · Double-click to finish · Right-click to cancel · Esc to exit'
                : activeTool === 'fib'       ? 'Click & drag to set Fibonacci range · Right-click to cancel · Esc to exit'
                : 'Click & drag · Right-click to cancel · Esc to exit'}
              </span>
            </div>
          )}

          {/* Main price chart + drawing canvas overlay */}
          <div
            ref={mainRef}
            className="w-full shrink-0 relative"
            style={{
              height: `${mainPct}%`,
              cursor: activeTool ? 'crosshair' : 'default',
            }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-10 pointer-events-none"
            />
          </div>

          {showRSI && (
            <div className="w-full shrink-0 flex flex-col" style={{ height: `${subPanePct}%`, borderTop: isDark ? '1px solid #1c2333' : '1px solid #f3f4f6' }}>
              <SubPaneLabel title="RSI" sub="14" color="#a78bfa"
                legend={[{ color: '#ef444480', label: '70 OB' }, { color: '#10b98180', label: '30 OS' }]} />
              <div ref={rsiRef} className="w-full flex-1 min-h-0 relative">
                {!chartsRef.current.rsi && <div className="absolute inset-0 animate-pulse" style={{ background: isDark ? '#0d1117' : '#fafafa' }} />}
              </div>
            </div>
          )}

          {showMACD && (
            <div className="w-full shrink-0 flex flex-col" style={{ height: `${subPanePct}%`, borderTop: isDark ? '1px solid #1c2333' : '1px solid #f3f4f6' }}>
              <SubPaneLabel title="MACD" sub="12 / 26 / 9" color="#60a5fa"
                legend={[{ color: '#60a5fa', label: 'MACD' }, { color: '#f59e0b', label: 'Signal' }]} />
              <div ref={macdRef} className="w-full flex-1 min-h-0 relative">
                {!chartsRef.current.macd && <div className="absolute inset-0 animate-pulse" style={{ background: isDark ? '#0d1117' : '#fafafa' }} />}
              </div>
            </div>
          )}

          {showATR && (
            <div className="w-full shrink-0 flex flex-col" style={{ height: `${subPanePct}%`, borderTop: isDark ? '1px solid #1c2333' : '1px solid #f3f4f6' }}>
              <SubPaneLabel title="ATR" sub="14" color="#f59e0b"
                legend={[{ color: '#f59e0b', label: 'ATR' }]} />
              <div ref={atrRef} className="w-full flex-1 min-h-0 relative">
                {!chartsRef.current.atr && <div className="absolute inset-0 animate-pulse" style={{ background: isDark ? '#0d1117' : '#fafafa' }} />}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
    </>
  )
}
