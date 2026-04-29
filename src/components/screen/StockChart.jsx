import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useScreen } from '../../context/ScreenContext'
import { getIndexChart, getStockChart, getTopMovers, getMarketSymbols, getSMCScan, triggerBackfill } from '../../api'

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

  // shorthand: convert price/time → pixel using the passed series
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
    if (dx > 0) ts.push((canvas.width - p1.x) / dx)
    if (dx < 0) ts.push((0 - p1.x) / dx)
    if (dy > 0) ts.push((canvas.height - p1.y) / dy)
    if (dy < 0) ts.push((0 - p1.y) / dy)
    const t = Math.min(...ts.filter(v => v > 0.001))
    return { x: p1.x + dx * t, y: p1.y + dy * t }
  }

  function drawFib(p1, p2) {
    if (!p1 || !p2) return
    const dy = p2.y - p1.y
    ctx.save()
    FIB_LEVELS.forEach((lvl, i) => {
      const y = p1.y + dy * lvl
      const c = FIB_COLORS[i]
      ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(p1.x, y); ctx.lineTo(p2.x > p1.x ? canvas.width : 0, y); ctx.stroke()
      ctx.fillStyle = c; ctx.font = 'bold 9px monospace'
      ctx.fillText(`${(lvl * 100).toFixed(1)}%`, 4, y - 2)
      // price label — use series coordinateToPrice (v4 API)
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
      ctx.fillText(d.price.toFixed(2), canvas.width - 54, p.y - 3); ctx.restore()
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
  const PRE = '#f59e0b' // amber preview color

  if (tool === 'horizontal' && start) {
    // horizontal: use raw pixel y from mouse, not chart conversion
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
      ag = (ag * (period - 1) + Math.max(d, 0)) / period
      al = (al * (period - 1) + Math.max(-d, 0)) / period
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

// ── VWAP (Volume-Weighted Average Price) ─────────────────────────────────────
function calcVWAP(data) {
  let cumVol = 0, cumTP = 0
  return data.map(d => {
    const tp = (d.high + d.low + d.close) / 3
    const vol = d.volume || d.turnover || 0
    cumVol += vol
    cumTP += tp * vol
    return { time: d.time, value: cumVol > 0 ? +(cumTP / cumVol).toFixed(2) : 0 }
  }).filter(d => d.value > 0)
}

// ── ATR (Average True Range, 14) ─────────────────────────────────────────────
function calcATR(data, period = 14) {
  if (data.length < period + 1) return []
  const trs = []
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  const out = [{ time: data[period].time, value: +atr.toFixed(2) }]
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    out.push({ time: data[i + 1].time, value: +atr.toFixed(2) })
  }
  return out
}

// ── Stochastic (14, 3, 3) ────────────────────────────────────────────────────
function calcStochastic(data, kPeriod = 14, dPeriod = 3) {
  if (data.length < kPeriod) return { k: [], d: [] }
  const rawK = []
  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1)
    const hh = Math.max(...slice.map(d => d.high))
    const ll = Math.min(...slice.map(d => d.low))
    const val = hh === ll ? 50 : ((data[i].close - ll) / (hh - ll)) * 100
    rawK.push({ time: data[i].time, value: +val.toFixed(2) })
  }
  // Smooth K to get %K (SMA of rawK over dPeriod)
  const kLine = rawK.map((d, i) => {
    if (i < dPeriod - 1) return null
    const avg = rawK.slice(i - dPeriod + 1, i + 1).reduce((s, x) => s + x.value, 0) / dPeriod
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
  // %D = SMA of %K
  const dLine = kLine.map((d, i) => {
    if (i < dPeriod - 1) return null
    const avg = kLine.slice(i - dPeriod + 1, i + 1).reduce((s, x) => s + x.value, 0) / dPeriod
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
  return { k: kLine, d: dLine }
}

// ── Supertrend (10, 3) ──────────────────────────────────────────────────────
function calcSupertrend(data, period = 10, mult = 3) {
  const atrVals = []
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close
    atrVals.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  if (atrVals.length < period) return { up: [], down: [] }

  const result = []
  let atr = atrVals.slice(0, period).reduce((s, v) => s + v, 0) / period
  let upperBand = ((data[period].high + data[period].low) / 2) + mult * atr
  let lowerBand = ((data[period].high + data[period].low) / 2) - mult * atr
  let supertrend = data[period].close > upperBand ? lowerBand : upperBand
  let isUp = data[period].close > supertrend

  result.push({ time: data[period].time, value: +supertrend.toFixed(2), isUp })

  for (let i = period + 1; i < data.length; i++) {
    atr = (atr * (period - 1) + atrVals[i - 1]) / period
    const hl2 = (data[i].high + data[i].low) / 2
    let newUpper = hl2 + mult * atr
    let newLower = hl2 - mult * atr
    newLower = newLower > lowerBand ? newLower : lowerBand
    newUpper = newUpper < upperBand ? newUpper : upperBand
    if (data[i].close > upperBand) { supertrend = newLower; isUp = true }
    else if (data[i].close < lowerBand) { supertrend = newUpper; isUp = false }
    else { supertrend = isUp ? newLower : newUpper }
    upperBand = newUpper; lowerBand = newLower
    result.push({ time: data[i].time, value: +supertrend.toFixed(2), isUp })
  }

  return {
    up: result.filter(d => d.isUp).map(d => ({ time: d.time, value: d.value })),
    down: result.filter(d => !d.isUp).map(d => ({ time: d.time, value: d.value })),
  }
}

async function loadLC() { return import('lightweight-charts') }

// ── Embedded Symbol Search ─────────────────────────────────────────────────────

function ChartSymbolSearch() {
  const { selectedSymbol, selectSymbol } = useScreen()
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const [symbols,setSymbols]= useState({ stocks: [], indexes: [] })
  const [cursor, setCursor] = useState(-1)
  const [loadErr,setLoadErr]= useState(null)
  const inputRef        = useRef(null)
  const listRef         = useRef(null)
  const mouseDownInList = useRef(false)

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) { setSymbols(r.data); setLoadErr(null) } })
      .catch(() => setLoadErr('Symbols unavailable'))
  }, [])

  const allItems = [
    ...symbols.indexes.map(i => ({ label: i.name, sub: 'Index', indexId: i.index_id })),
    ...symbols.stocks.map(s => ({ label: s.symbol, sub: 'Stock' })),
  ]

  const filtered = query.length < 1
    ? allItems.slice(0, 20)
    : allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 30)

  const handleSelect = useCallback((item) => {
    selectSymbol(item.label, item.indexId || null)
    setQuery(''); setOpen(false); setCursor(-1)
  }, [selectSymbol])

  function handleKey(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && cursor >= 0) handleSelect(filtered[cursor])
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div className="relative w-full max-w-[220px]">
      <div
        className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 cursor-pointer"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 40) }}
      >
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          data-chart-search
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          autoComplete="off"
          className="bg-transparent text-[11px] font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none w-full"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <ul ref={listRef}>
            {filtered.map((item, i) => (
              <li key={item.label}
                onMouseDown={() => { mouseDownInList.current = true; handleSelect(item); mouseDownInList.current = false }}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                  i === cursor ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{item.label}</span>
                <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${
                  item.sub === 'Index'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>{item.sub}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && filtered.length === 0 && query.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2 text-[10px] text-gray-400">
          {loadErr || `No results for "${query}"`}
        </div>
      )}
    </div>
  )
}

// ── HUD Controls — timeframe, chart type, indicators ──────────────────────────

const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']
const INDICATORS = ['MA', 'EMA', 'BB', 'VWAP', 'RSI', 'MACD', 'ATR', 'STOCH', 'ST']

function ChartHUDControls({ activeTool, setActiveTool, onClearDrawings, drawCount }) {
  const { chartType, setChartType, timeframe, setTimeframe, activeIndicators: _ai, toggleIndicator, smcEnabled, setSmcEnabled } = useScreen() || {}
  const activeIndicators = Array.isArray(_ai) ? _ai : []

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
      {/* Chart type */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
        {[['candlestick','Candle'], ['line','Line']].map(([type, label]) => (
          <button key={type} onClick={() => setChartType(type)}
            className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Timeframes */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tf}
          </button>
        ))}
      </div>

      {/* Indicators + SMC */}
      <div className="flex items-center gap-0.5">
        {INDICATORS.map(ind => (
          <button key={ind} onClick={() => toggleIndicator(ind)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
              activeIndicators.includes(ind)
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500'
            }`}>
            {ind}
          </button>
        ))}
        <button onClick={() => setSmcEnabled(p => !p)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ml-1 ${
            smcEnabled
              ? 'bg-purple-500 border-purple-500 text-white'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-300 hover:text-purple-500'
          }`}>
          SMC
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Drawing tools — inline after SMC */}
      <div className="flex items-center gap-0.5">
        {DRAW_TOOLS.map(t => (
          <button key={t.id}
            title={t.title}
            onClick={() => setActiveTool(p => p === t.id ? null : t.id)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
              activeTool === t.id
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-500'
            }`}>
            {t.label}
          </button>
        ))}
        {drawCount > 0 && (
          <button
            title="Clear all drawings"
            onClick={onClearDrawings}
            className="px-1.5 py-0.5 rounded text-[9px] font-semibold border border-red-300 dark:border-red-800 text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors ml-0.5"
          >
            ✕{drawCount}
          </button>
        )}
      </div>
    </div>
  )
}

// ── HUD Price + Symbol ─────────────────────────────────────────────────────────

function ChartHUDPrice({ latestClose, chartData }) {
  const { selectedSymbol } = useScreen()

  const lastBar = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const change  = lastBar ? (lastBar.diff_pct ?? lastBar.per_change ?? null) : null
  const isPos   = parseFloat(change) >= 0
  const close   = latestClose ?? lastBar?.close

  return (
    <div className="flex items-baseline gap-2 pointer-events-none" translate="no">
      <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300 tracking-wide">{selectedSymbol}</span>
      {close != null && (
        <>
          <span className="text-[20px] font-black text-gray-900 dark:text-white tabular-nums leading-none">
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
    <div className="absolute bottom-8 left-3 z-20 pointer-events-none" translate="no">
      <div className="bg-white/96 dark:bg-gray-900/96 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden w-56">
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-1.5 ${isLong ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded ${
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
            <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Avg Entry</p>
            <p className="text-[9px] font-semibold text-blue-400 tabular-nums">{avgEntry.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Qty</p>
            <p className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{totalQty}</p>
          </div>
          {close > 0 && (
            <div>
              <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Unreal</p>
              <p className={`text-[9px] font-semibold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
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
                    <p className="text-[7px] text-gray-400 uppercase tracking-widest">Entry</p>
                    <p className={`text-[9px] font-semibold tabular-nums ${ENTRY_TEXT_COLORS[idx % ENTRY_TEXT_COLORS.length]}`}>{e.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[7px] text-gray-400 uppercase tracking-widest">Qty</p>
                    <p className="text-[9px] font-semibold text-gray-600 dark:text-gray-400 tabular-nums">{qty}</p>
                  </div>
                  {u !== null && (
                    <div>
                      <p className="text-[7px] text-gray-400 uppercase tracking-widest">P&L</p>
                      <p className={`text-[9px] font-semibold tabular-nums ${u >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {u >= 0 ? '+' : '−'}{Math.abs(Math.round(u)).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {pos.sl && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest">SL</p><p className="text-[9px] font-semibold text-red-400 tabular-nums">{parseFloat(pos.sl).toFixed(2)}</p></div>}
                  {pos.tp && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest">TP</p><p className="text-[9px] font-semibold text-emerald-400 tabular-nums">{parseFloat(pos.tp).toFixed(2)}</p></div>}
                  {rr   && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest">R:R</p><p className="text-[9px] font-semibold text-violet-400">1:{rr}</p></div>}
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
              <div className="flex justify-between text-[7px]">
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
        ? 'bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 ring-1 ring-blue-400/30'
        : 'bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700'
      }`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{date}</span>
        {pinned ? (
          <button onClick={onClear} className="text-[9px] text-blue-400 hover:text-blue-600 font-semibold flex items-center gap-0.5">
            <span>📌</span> Pinned
          </button>
        ) : (
          <span className="text-[8px] text-gray-300 dark:text-gray-600">Click to pin</span>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
        <div className="px-2 py-2">
          <p className="text-[8px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">Gainers</p>
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
          <p className="text-[8px] font-semibold text-red-400 uppercase tracking-widest mb-1">Losers</p>
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
  if (!bar) return null
  const isUp = (bar.close ?? bar.value) >= (bar.open ?? bar.value)
  return (
    <div className="absolute top-14 left-3 z-10 pointer-events-none" translate="no">
      <div className="bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
        <div className="text-[9px] text-gray-400 mb-1">{bar.time}</div>
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
          <div className="grid grid-cols-4 gap-x-3 text-[9px]">
            {['O','H','L','C'].map(l => <span key={l} className="text-gray-400">{l}</span>)}
            <span className="text-gray-700 dark:text-gray-300">{bar.open?.toLocaleString()}</span>
            <span className="text-emerald-500">{bar.high?.toLocaleString()}</span>
            <span className="text-red-400">{bar.low?.toLocaleString()}</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{bar.close?.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-2 p-4 animate-pulse">
      <div className="flex gap-1 items-end h-full">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-sm"
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
      <span className={`text-[8px] font-bold uppercase tracking-widest`} style={{ color }}>{title}</span>
      {sub && <span className="text-[8px] text-gray-400">{sub}</span>}
      {legend && legend.map((l, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="w-2 h-0.5 rounded inline-block" style={{ background: l.color }} />
          <span className="text-[8px] text-gray-400">{l.label}</span>
        </span>
      ))}
    </div>
  )
}

// ── Main StockChart ────────────────────────────────────────────────────────────

export default function StockChart() {
  const { isDark } = useTheme()
  const {
    selectedSymbol, selectedIndexId, chartType, timeframe,
    activeIndicators: _activeIndicators, isIndex, onHover, onPin, pinnedDate, clearPin,
    activePositions, smcEnabled,
  } = useScreen() || {}
  const activeIndicators = Array.isArray(_activeIndicators) ? _activeIndicators : []

  const mainRef    = useRef(null)
  const rsiRef     = useRef(null)
  const macdRef    = useRef(null)
  const atrRef     = useRef(null)
  const stochRef   = useRef(null)
  const chartsRef  = useRef({})
  const seriesRef  = useRef({})
  const moversCache    = useRef({})
  const pendingHover   = useRef(null)
  const pinnedDateRef  = useRef(pinnedDate)

  // Drawing tools
  const canvasRef      = useRef(null)
  const priceSeriesRef = useRef(null)  // set after chart build — needed for coordinate conversion
  const drawingsRef    = useRef([])
  const drawPreviewRef = useRef(null)
  const rafRef         = useRef(null)

  const [chartData,      setChartData]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [tooltip,        setTooltip]        = useState(null)
  const [overlayData,    setOverlayData]    = useState(null)
  const [latestClose,    setLatestClose]    = useState(null)
  const [smcData,        setSmcData]        = useState(null)
  const [activeTool,     setActiveTool]     = useState(null)
  const [drawVersion,    setDrawVersion]    = useState(0)  // bump to repaint canvas
  const [chartBuiltVer,  setChartBuiltVer]  = useState(0)  // bumps when chart instance is created

  const C = {
    bg:     isDark ? '#030712' : '#ffffff',
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

  // Fetch chart data
  useEffect(() => {
    setLoading(true); setError(null); setTooltip(null); setOverlayData(null)

    const req = isIndex()
      ? getIndexChart({ index_id: selectedIndexId, timeframe })
      : getStockChart({ symbol: selectedSymbol, timeframe })

    req.then(async r => {
      const data = r.data.data || []
      setChartData(data)
      setLatestClose(data.length > 0 ? data[data.length - 1].close : null)
      setLoading(false)

      // Gap detection: if latest candle is older than expected, trigger backfill
      if (data.length > 0) {
        const latestCandle = data[data.length - 1].time // 'YYYY-MM-DD'
        const nowNPT = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
        const hNPT = nowNPT.getUTCHours()
        const mNPT = nowNPT.getUTCMinutes()
        // Market data available after 3:10 PM NPT
        const afterClose = hNPT > 15 || (hNPT === 15 && mNPT >= 10)
        if (!afterClose) return // market still open — no gap expected

        // Find last trading day (skip weekends: Sat=6, Sun=0 from 2026-04-01)
        const expected = (() => {
          const d = new Date(nowNPT)
          for (let i = 0; i < 7; i++) {
            const s = d.toISOString().slice(0, 10)
            const dow = d.getUTCDay()
            const isWeekend = s >= '2026-04-01' ? (dow === 0 || dow === 6) : (dow === 5 || dow === 6)
            if (!isWeekend) return s
            d.setUTCDate(d.getUTCDate() - 1)
          }
        })()

        if (latestCandle < expected) {
          console.log(`[CHART] Gap detected: latest=${latestCandle}, expected=${expected} — triggering backfill`)
          try {
            const wasIndex = isIndex() // capture before any await
            const bf = await triggerBackfill(expected)
            if (bf.data?.filled) {
              const reloaded = wasIndex
                ? await getIndexChart({ index_id: selectedIndexId, timeframe })
                : await getStockChart({ symbol: selectedSymbol, timeframe })
              const fresh = reloaded.data.data || []
              setChartData(fresh)
              setLatestClose(fresh.length > 0 ? fresh[fresh.length - 1].close : null)
            }
          } catch { /* backfill is best-effort — chart still shows existing data */ }
        }
      }
    }).catch(e => {
      setError(e.response?.data?.error || 'Failed to load chart data')
      setLoading(false)
    })
  }, [selectedSymbol, selectedIndexId, timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch SMC data when enabled — use same timeframe as chart so dates align
  useEffect(() => {
    if (!smcEnabled || isIndex()) { setSmcData(null); return }
    const tfDays = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095, 'ALL': 2000 }
    const days = tfDays[timeframe] ?? 365
    getSMCScan({ symbol: selectedSymbol, days })
      .then(r => { console.log('[SMC]', r.data); setSmcData(r.data) })
      .catch(e => { console.error('[SMC] fetch failed', e); setSmcData(null) })
  }, [smcEnabled, selectedSymbol, timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build / rebuild charts
  useEffect(() => {
    if (loading || !chartData.length || !mainRef.current) return

    Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
    chartsRef.current = {}; seriesRef.current = {}

    const changeMap = {}
    chartData.forEach(d => { changeMap[d.time] = d.diff_pct ?? d.per_change })

    let cancelled = false
    let roCleanup = null

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

      // VWAP overlay
      if (activeIndicators.includes('VWAP') && !isIndex()) {
        const vwap = calcVWAP(chartData)
        if (vwap.length) {
          const s = main.addLineSeries({ color: '#f59e0bcc', lineWidth: 1.5, lineStyle: 2, priceLineVisible: false, title: 'VWAP' })
          s.setData(vwap)
        }
      }

      // Supertrend overlay
      if (activeIndicators.includes('ST')) {
        const { up, down } = calcSupertrend(chartData, 10, 3)
        if (up.length) {
          const sUp = main.addLineSeries({ color: '#34d399', lineWidth: 2, priceLineVisible: false, title: 'ST↑', lineStyle: 0 })
          sUp.setData(up)
        }
        if (down.length) {
          const sDn = main.addLineSeries({ color: '#f87171', lineWidth: 2, priceLineVisible: false, title: 'ST↓', lineStyle: 0 })
          sDn.setData(down)
        }
      }

      // Position lines + markers
      const ENTRY_COLORS = ['#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#f472b6']
      const markers = []

      if (activePositions?.length) {
        activePositions.forEach((pos, idx) => {
          const { entry_price, sl, tp, entry_date, position: dir } = pos
          const entryColor = ENTRY_COLORS[idx % ENTRY_COLORS.length]
          const entryStr   = entry_date ? entry_date.slice(0, 10) : null
          const startIdx   = entryStr ? chartData.findIndex(d => d.time >= entryStr) : 0
          const fromData   = startIdx >= 0 ? chartData.slice(startIdx) : chartData.slice(-Math.min(chartData.length, 60))

          const addPosLine = (price, color, lineStyle, label) => {
            if (!price || !fromData.length) return
            const s = main.addLineSeries({
              color, lineWidth: 1.5, lineStyle,
              priceLineVisible: false, lastValueVisible: true,
              title: activePositions.length > 1 ? `${label}${idx + 1}` : label,
              crosshairMarkerVisible: false,
            })
            s.setData(fromData.map(d => ({ time: d.time, value: parseFloat(price) })))
          }

          addPosLine(entry_price, entryColor, 0, 'Entry')
          addPosLine(sl, idx === 0 ? '#f87171' : '#fca5a5', 2, 'SL')
          addPosLine(tp, idx === 0 ? '#34d399' : '#6ee7b7', 2, 'TP')

          if (fromData.length) {
            markers.push({
              time:     fromData[0].time,
              position: dir === 'SHORT' ? 'aboveBar' : 'belowBar',
              color:    entryColor,
              shape:    dir === 'SHORT' ? 'arrowDown' : 'arrowUp',
              text:     activePositions.length > 1 ? `E${idx + 1}` : '',
              size:     2,
            })
          }
        })
      }

      // Volume histogram
      const volSeries = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
      main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })
      volSeries.setData(chartData.map(d => ({
        time: d.time, value: d.volume || d.turnover || 0,
        color: d.close >= d.open ? C.up + '44' : C.down + '44',
      })))

      // SMC overlays — Order Blocks as bands, FVGs as zones, BOS/CHoCH/sweeps/patterns as markers
      if (smcData && smcEnabled) {
        const smcMarkers = []

        // Order Blocks — solid colored price lines (top + bottom of the zone)
        for (const ob of (smcData.order_blocks || [])) {
          const isBull = ob.type === 'bullish'
          const obColor = isBull ? '#34d399' : '#f87171'
          const obTop = Math.max(ob.high, ob.open, ob.close)
          const obBottom = Math.min(ob.low, ob.open, ob.close)
          const fromIdx = chartData.findIndex(d => d.time >= ob.date)
          if (fromIdx < 0) continue
          const slice = chartData.slice(fromIdx)
          if (!slice.length) continue
          const sTop = main.addLineSeries({
            color: obColor, lineWidth: 1.5, lineStyle: 2,
            priceLineVisible: false, crosshairMarkerVisible: false,
            title: isBull ? 'OB↑' : 'OB↓',
          })
          sTop.setData(slice.map(d => ({ time: d.time, value: obTop })))
          const sBot = main.addLineSeries({
            color: obColor + '99', lineWidth: 1, lineStyle: 2,
            priceLineVisible: false, crosshairMarkerVisible: false, title: '',
          })
          sBot.setData(slice.map(d => ({ time: d.time, value: obBottom })))
          // Entry marker at the OB candle
          smcMarkers.push({
            time: ob.date, position: isBull ? 'belowBar' : 'aboveBar',
            color: obColor, shape: 'square',
            text: isBull ? 'OB↑' : 'OB↓', size: 1,
          })
        }

        // FVG — dashed lines for gap top and bottom, extending 15 candles
        for (const gap of (smcData.fvg || []).slice(-10)) {
          const isBull = gap.type === 'bullish'
          const gapColor = isBull ? '#60a5fa' : '#f472b6'
          const fromIdx = chartData.findIndex(d => d.time >= gap.date)
          if (fromIdx < 0) continue
          const gapSlice = chartData.slice(fromIdx, fromIdx + 15)
          if (!gapSlice.length) continue
          const sT = main.addLineSeries({
            color: gapColor, lineWidth: 1, lineStyle: 1,
            priceLineVisible: false, crosshairMarkerVisible: false,
            title: isBull ? 'FVG↑' : 'FVG↓',
          })
          sT.setData(gapSlice.map(d => ({ time: d.time, value: gap.top })))
          const sB = main.addLineSeries({
            color: gapColor + '88', lineWidth: 1, lineStyle: 1,
            priceLineVisible: false, crosshairMarkerVisible: false, title: '',
          })
          sB.setData(gapSlice.map(d => ({ time: d.time, value: gap.bottom })))
        }

        // BOS markers
        for (const b of (smcData.bos || [])) {
          smcMarkers.push({
            time: b.date, position: b.type === 'bullish' ? 'belowBar' : 'aboveBar',
            color: b.type === 'bullish' ? '#34d399' : '#f87171',
            shape: b.type === 'bullish' ? 'arrowUp' : 'arrowDown',
            text: 'BOS', size: 1,
          })
        }

        // CHoCH markers
        for (const ch of (smcData.choch || [])) {
          smcMarkers.push({
            time: ch.date, position: ch.type === 'bullish' ? 'belowBar' : 'aboveBar',
            color: '#f59e0b', shape: 'circle',
            text: 'ChCh', size: 1,
          })
        }

        // Liquidity sweep markers
        for (const sw of (smcData.sweeps || [])) {
          smcMarkers.push({
            time: sw.date, position: sw.type === 'buy_side' ? 'belowBar' : 'aboveBar',
            color: '#a78bfa', shape: 'square',
            text: sw.type === 'buy_side' ? 'BSw' : 'SSw', size: 1,
          })
        }

        // Candlestick pattern markers
        for (const p of (smcData.patterns || []).slice(-15)) {
          const isBullish = p.type.includes('bullish') || p.type === 'hammer' || p.type === 'inside_bar'
          const label = p.type.replaceAll('_', ' ').replace('bullish ', '').replace('bearish ', '').slice(0, 5)
          smcMarkers.push({
            time: p.date, position: isBullish ? 'belowBar' : 'aboveBar',
            color: isBullish ? '#22c55e' : '#ef4444',
            shape: 'circle', text: label, size: 0,
          })
        }

        // Merge all markers (position + SMC) and set once
        const allMarkers = [...markers, ...smcMarkers].sort((a, b) => a.time < b.time ? -1 : 1)
        if (allMarkers.length) priceSeries.setMarkers(allMarkers)
      } else if (markers.length) {
        // No SMC but there are position markers — set them
        priceSeries.setMarkers(markers)
      }

      // Crosshair events — debounce movers fetch by 80ms
      main.subscribeCrosshairMove(param => {
        if (pinnedDateRef.current) return
        if (cancelled) return
        if (!param.time) { setTooltip(null); setOverlayData(null); onHover(null, null); return }
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })

        // Debounce: cancel previous pending fetch
        if (pendingHover.current) clearTimeout(pendingHover.current)
        pendingHover.current = setTimeout(async () => {
          if (cancelled || pinnedDateRef.current) return
          const movers = await getMovers(param.time)
          if (cancelled || pinnedDateRef.current) return
          setOverlayData({ date: param.time, movers, pinned: false })
          onHover(param.time, movers)
        }, 80)
      })

      main.subscribeClick(async param => {
        if (cancelled) return
        if (!param.time) return
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        if (pendingHover.current) { clearTimeout(pendingHover.current); pendingHover.current = null }
        const movers = await getMovers(param.time)
        if (cancelled) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })
        setOverlayData({ date: param.time, movers, pinned: true })
        onPin(param.time, movers)
      })

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
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) rc.timeScale().setVisibleLogicalRange(r) })
          rc.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) main.timeScale().setVisibleLogicalRange(r) })
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
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) mc.timeScale().setVisibleLogicalRange(r) })
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
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) ac.timeScale().setVisibleLogicalRange(r) })
        }
      }

      // Stochastic sub-pane
      if (activeIndicators.includes('STOCH') && stochRef.current) {
        const { k, d } = calcStochastic(chartData)
        if (k.length) {
          const sc = createChart(stochRef.current, {
            ...base,
            width: stochRef.current.clientWidth,
            height: stochRef.current.clientHeight,
            rightPriceScale: { ...base.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
          })
          chartsRef.current.stoch = sc
          sc.addLineSeries({ color: '#60a5fa', lineWidth: 1.5, priceLineVisible: false, title: '%K' }).setData(k)
          sc.addLineSeries({ color: '#f87171', lineWidth: 1.5, priceLineVisible: false, title: '%D' }).setData(d)
          // 80/20 levels
          sc.addLineSeries({ color: C.down + '60', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(k.map(p => ({ time: p.time, value: 80 })))
          sc.addLineSeries({ color: C.up + '60', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(k.map(p => ({ time: p.time, value: 20 })))
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) sc.timeScale().setVisibleLogicalRange(r) })
        }
      }

      main.timeScale().fitContent()

      // Resize both width AND height
      const ro = new ResizeObserver(() => {
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
        if (stochRef.current && chartsRef.current.stoch) {
          chartsRef.current.stoch.applyOptions({
            width:  stochRef.current.clientWidth,
            height: stochRef.current.clientHeight,
          })
        }
      })
      if (mainRef.current) ro.observe(mainRef.current)
      roCleanup = () => ro.disconnect()
    })

    return () => {
      cancelled = true
      if (pendingHover.current) clearTimeout(pendingHover.current)
      if (roCleanup) roCleanup()
      Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
      chartsRef.current = {}
    }
  }, [chartData, isDark, chartType, activeIndicators, activePositions, smcData, smcEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // sync size
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
      const ctx = canvas.getContext('2d')
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
        setDrawVersion(v => v + 1)
      } else if (tool === 'vertical') {
        if (pt.time == null) return
        drawingsRef.current.push({ type: 'vertical', time: pt.time, price: pt.price, color: nextColor() })
        setDrawVersion(v => v + 1)
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
        // show live crosshair preview even before mousedown
        drawPreviewRef.current = { tool, start: pt, end: pt, color: '#f59e0b' }
        scheduleRepaint()
      }
    }

    function onMouseUp(e) {
      const tool = activeToolRef.current
      const preview = drawPreviewRef.current
      if (!preview || !tool) return
      if (tool === 'path') return
      if (tool === 'horizontal' || tool === 'vertical') {
        // already committed on mousedown
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
          setDrawVersion(v => v + 1)
        }
        drawPreviewRef.current = null
        scheduleRepaint()
      }
    }

    function onDblClick(e) {
      const tool = activeToolRef.current
      const preview = drawPreviewRef.current
      if (tool === 'path' && preview?.points?.length >= 2) {
        drawingsRef.current.push({ type: 'path', color: preview.color, points: preview.points })
        setDrawVersion(v => v + 1)
        drawPreviewRef.current = null
        scheduleRepaint()
      }
    }

    function onContextMenu(e) {
      if (!activeToolRef.current) return
      e.preventDefault()
      drawPreviewRef.current = null
      scheduleRepaint()
    }

    function onMouseLeave() {
      const tool = activeToolRef.current
      if (tool === 'horizontal' || tool === 'vertical') {
        drawPreviewRef.current = null
        scheduleRepaint()
      }
    }

    container.addEventListener('mousedown',   onMouseDown)
    container.addEventListener('mousemove',   onMouseMove)
    container.addEventListener('mouseup',     onMouseUp)
    container.addEventListener('dblclick',    onDblClick)
    container.addEventListener('contextmenu', onContextMenu)
    container.addEventListener('mouseleave',  onMouseLeave)

    return () => {
      container.removeEventListener('mousedown',   onMouseDown)
      container.removeEventListener('mousemove',   onMouseMove)
      container.removeEventListener('mouseup',     onMouseUp)
      container.removeEventListener('dblclick',    onDblClick)
      container.removeEventListener('contextmenu', onContextMenu)
      container.removeEventListener('mouseleave',  onMouseLeave)
    }
  }, [chartBuiltVer, isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  const showRSI   = activeIndicators.includes('RSI')
  const showMACD  = activeIndicators.includes('MACD')
  const showATR   = activeIndicators.includes('ATR')
  const showSTOCH = activeIndicators.includes('STOCH')
  const indCount  = (showRSI ? 1 : 0) + (showMACD ? 1 : 0) + (showATR ? 1 : 0) + (showSTOCH ? 1 : 0)
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
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-950 overflow-hidden">

      {/* ── HUD top bar ── */}
      <div className="shrink-0 z-30 flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        <ChartSymbolSearch />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
        <ChartHUDControls
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          drawCount={drawingsRef.current.length}
          onClearDrawings={() => {
            drawingsRef.current = []
            drawPreviewRef.current = null
            setActiveTool(null)
            setDrawVersion(v => v + 1)
          }}
        />
      </div>

      {/* ── Overlays (absolute inside the chart area below) ── */}

      {/* ── Chart area ── */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Price overlay top-left */}
          <div className="absolute top-2 left-3 z-20 pointer-events-none">
            {chartData.length > 0 && (
              <ChartHUDPrice latestClose={latestClose} chartData={chartData} />
            )}
          </div>

          {/* SMC info badge — shows structure counts when enabled */}
          {smcEnabled && smcData && (
            <div className="absolute top-2 right-3 z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-400/30 rounded-lg px-2 py-1">
                <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">SMC</span>
                <span className="text-[8px] text-gray-400">OB:{smcData.order_blocks?.length ?? 0}</span>
                <span className="text-[8px] text-gray-400">FVG:{smcData.fvg?.length ?? 0}</span>
                <span className="text-[8px] text-gray-400">BOS:{smcData.bos?.length ?? 0}</span>
                <span className="text-[8px] text-gray-400">PAT:{smcData.patterns?.length ?? 0}</span>
              </div>
            </div>
          )}
          {smcEnabled && !smcData && !isIndex() && (
            <div className="absolute top-2 right-3 z-20 pointer-events-none">
              <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg px-2 py-1">
                <span className="text-[8px] text-purple-400">SMC loading…</span>
              </div>
            </div>
          )}

          {/* Position badge */}
          <PositionBadge positions={activePositions} latestClose={latestClose} />

          {/* OHLC tooltip */}
          <OHLCTooltip bar={tooltip} change={tooltip?.change} />

          {/* Pinned hint */}
          {overlayData?.pinned && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="text-[9px] text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                📌 Movers shown in right panel — click to unpin
              </span>
            </div>
          )}

          {/* Active drawing tool hint — bottom-center */}
          {activeTool && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <span className="text-[9px] text-white bg-amber-600/90 px-2.5 py-1 rounded-full shadow whitespace-nowrap">
                {activeTool === 'horizontal' ? 'Click anywhere to place horizontal line'
                : activeTool === 'vertical'  ? 'Click anywhere to place vertical line'
                : activeTool === 'path'      ? 'Click points · Double-click to finish · Right-click to cancel'
                : activeTool === 'fib'       ? 'Click & drag to set Fibonacci range · Right-click to cancel'
                : 'Click & drag · Right-click to cancel'}
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
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="RSI" sub="14" color="#a78bfa"
                legend={[{ color: '#ef444480', label: '70 OB' }, { color: '#10b98180', label: '30 OS' }]} />
              <div ref={rsiRef} className="w-full flex-1 min-h-0" />
            </div>
          )}

          {showMACD && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="MACD" sub="12 / 26 / 9" color="#60a5fa"
                legend={[{ color: '#60a5fa', label: 'MACD' }, { color: '#f59e0b', label: 'Signal' }]} />
              <div ref={macdRef} className="w-full flex-1 min-h-0" />
            </div>
          )}

          {showATR && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="ATR" sub="14" color="#f59e0b"
                legend={[{ color: '#f59e0b', label: 'ATR' }]} />
              <div ref={atrRef} className="w-full flex-1 min-h-0" />
            </div>
          )}

          {showSTOCH && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="STOCH" sub="14 / 3 / 3" color="#60a5fa"
                legend={[{ color: '#60a5fa', label: '%K' }, { color: '#f87171', label: '%D' }]} />
              <div ref={stochRef} className="w-full flex-1 min-h-0" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
