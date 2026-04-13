import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useAnalysis } from '../../context/AnalysisContext'
import { getIndexChart, getStockChart, getTopMovers, getMarketSymbols } from '../../api'

// ── Indicator math ────────────────────────────────────────────────────────────

function calcMA(data, period = 20) {
  return data.map((d, i) => {
    if (i < period - 1) return null
    const avg = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
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

async function loadLC() { return import('lightweight-charts') }

// ── Embedded Symbol Search (inside chart) ─────────────────────────────────────

function ChartSymbolSearch() {
  const { selectedSymbol, selectSymbol } = useAnalysis()
  const [query, setQuery]     = useState('')
  const [open, setOpen]       = useState(false)
  const [symbols, setSymbols] = useState({ stocks: [], indexes: [] })
  const [cursor, setCursor]   = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) setSymbols(r.data) })
      .catch(e => console.error('[symbols]', e?.response?.data || e?.message))
  }, [])

  const allItems = [
    ...symbols.indexes.map(i => ({ label: i.name, sub: 'Index', indexId: i.index_id })),
    ...symbols.stocks.map(s => ({ label: s.symbol, sub: 'Stock' })),
  ]

  const filtered = query.length < 1
    ? allItems.slice(0, 20)
    : allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 30)

  function handleSelect(item) {
    selectSymbol(item.label, item.indexId || null)
    setQuery(''); setOpen(false); setCursor(-1)
  }

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
    <div className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}>
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          className="bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full cursor-pointer"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          <ul ref={listRef}>
            {filtered.map((item, i) => (
              <li key={item.label} onMouseDown={() => handleSelect(item)}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                  i === cursor ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{item.label}</span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
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
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-3 text-[11px] text-gray-400">
          No results for "{query}"
        </div>
      )}
    </div>
  )
}

// ── Embedded Controls (timeframe, chart type, indicators) ─────────────────────

const TIMEFRAMES = ['1D', '1W', '1M', '6M', '1Y', '3Y', 'ALL']
const INDICATORS = ['MA', 'RSI', 'MACD']

function ChartHUDControls() {
  const { chartType, setChartType, timeframe, setTimeframe, activeIndicators, toggleIndicator } = useAnalysis()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Chart type */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {['candlestick', 'line'].map(type => (
          <button key={type} onClick={() => setChartType(type)}
            className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
            {type === 'candlestick' ? 'Candle' : 'Line'}
          </button>
        ))}
      </div>

      {/* Timeframes */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tf}
          </button>
        ))}
      </div>

      {/* Indicators */}
      <div className="flex items-center gap-1">
        {INDICATORS.map(ind => (
          <button key={ind} onClick={() => toggleIndicator(ind)}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors ${
              activeIndicators.includes(ind)
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300'
            }`}>
            {ind}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Embedded HUD — symbol + live price + change ───────────────────────────────

function ChartHUDPrice({ latestClose, chartData }) {
  const { selectedSymbol, isIndex } = useAnalysis()

  const lastBar = chartData.at(-1)
  const change  = lastBar?.diff_pct ?? lastBar?.per_change ?? null
  const isPos   = parseFloat(change) >= 0
  const close   = latestClose ?? lastBar?.close

  return (
    <div className="flex items-baseline gap-2" translate="no">
      <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-wide">{selectedSymbol}</span>
      {close && (
        <>
          <span className="text-[20px] font-bold text-gray-900 dark:text-white tabular-nums leading-none">
            {parseFloat(close).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {change != null && (
            <span className={`text-[11px] font-semibold ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
              {isPos ? '▲' : '▼'} {Math.abs(parseFloat(change)).toFixed(2)}%
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ── Active position badge ─────────────────────────────────────────────────────

function PositionBadge({ position, latestClose }) {
  if (!position) return null
  const { symbol, entry_price, sl, tp, quantity, remaining_quantity, position: dir, entry_date } = position
  const entry  = parseFloat(entry_price) || 0
  const close  = parseFloat(latestClose) || entry
  const qty    = remaining_quantity ?? quantity ?? 0
  const pnl    = entry ? ((close - entry) / entry * 100) : 0
  const isPos  = pnl >= 0
  const isLong = dir !== 'SHORT'
  const rr     = sl && tp
    ? (Math.abs(parseFloat(tp) - entry) / Math.abs(entry - parseFloat(sl))).toFixed(1)
    : null

  return (
    <div className="absolute bottom-8 left-3 z-20 pointer-events-none" translate="no">
      <div className="bg-white/96 dark:bg-gray-900/96 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden w-56">
        <div className={`flex items-center justify-between px-3 py-1.5 ${isLong ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
              isLong ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-red-100 dark:bg-red-900 text-red-500'
            }`}>{dir}</span>
            <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100">{symbol}</span>
          </div>
          <span className={`text-[11px] font-bold ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
            {isPos ? '+' : ''}{pnl.toFixed(2)}%
          </span>
        </div>
        <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <div><p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Entry</p>
            <p className="text-[10px] font-semibold text-blue-400">{entry.toLocaleString()}</p></div>
          <div><p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Qty</p>
            <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{qty}</p></div>
          {sl && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Stop Loss</p>
            <p className="text-[10px] font-semibold text-red-400">{parseFloat(sl).toLocaleString()}</p></div>}
          {tp && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Take Profit</p>
            <p className="text-[10px] font-semibold text-emerald-400">{parseFloat(tp).toLocaleString()}</p></div>}
          {entry_date && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Since</p>
            <p className="text-[10px] font-semibold text-gray-500">{entry_date.slice(0, 10)}</p></div>}
          {rr && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">R:R</p>
            <p className="text-[10px] font-semibold text-violet-400">1 : {rr}</p></div>}
        </div>
        {sl && tp && entry && (() => {
          const slV = parseFloat(sl), tpV = parseFloat(tp), range = tpV - slV
          const entryPct = Math.min(100, Math.max(0, ((entry - slV) / range) * 100))
          const closePct = Math.min(100, Math.max(0, ((close - slV) / range) * 100))
          return (
            <div className="px-3 pb-2.5">
              <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-visible mb-1">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 via-gray-200 to-emerald-400 dark:via-gray-700" />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-blue-400 rounded-full" style={{ left: `${entryPct}%` }} />
                <div className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
                  style={{ left: `${closePct}%`, transform: 'translate(-50%, -50%)' }} />
              </div>
              <div className="flex justify-between text-[7px] text-gray-400">
                <span className="text-red-400">{slV.toLocaleString()}</span>
                <span className={`font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>{close.toLocaleString()}</span>
                <span className="text-emerald-400">{tpV.toLocaleString()}</span>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Hover movers overlay ──────────────────────────────────────────────────────

function MoversOverlay({ movers, date, pinned, onClear }) {
  if (!movers || (!movers.gainers?.length && !movers.losers?.length)) return null
  return (
    <div translate="no" className={`absolute top-14 right-2 z-20 w-52 rounded-2xl border shadow-lg backdrop-blur-sm text-[10px] overflow-hidden
      ${pinned
        ? 'bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 ring-1 ring-blue-400/30'
        : 'bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700'
      }`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{date}</span>
        {pinned && (
          <button onClick={onClear} className="text-[9px] text-blue-400 hover:text-blue-600 font-semibold flex items-center gap-0.5">
            <span>📌</span> Pinned
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
        <div className="px-2 py-2">
          <p className="text-[8px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">Gainers</p>
          {(movers.gainers || []).slice(0, 5).map((s, i) => (
            <div key={i} className="flex justify-between items-center py-0.5">
              <span className="font-semibold text-gray-700 dark:text-gray-200">{s.s}</span>
              <span className="text-emerald-500 font-semibold">+{s.p}%</span>
            </div>
          ))}
        </div>
        <div className="px-2 py-2">
          <p className="text-[8px] font-semibold text-red-400 uppercase tracking-widest mb-1">Losers</p>
          {(movers.losers || []).slice(0, 5).map((s, i) => (
            <div key={i} className="flex justify-between items-center py-0.5">
              <span className="font-semibold text-gray-700 dark:text-gray-200">{s.s}</span>
              <span className="text-red-400 font-semibold">{s.p}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── OHLC Tooltip (crosshair hover) ────────────────────────────────────────────

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
            <span className="text-gray-400">O</span>
            <span className="text-gray-400">H</span>
            <span className="text-gray-400">L</span>
            <span className="text-gray-400">C</span>
            <span className="text-gray-700 dark:text-gray-300">{bar.open?.toLocaleString()}</span>
            <span className="text-emerald-500">{bar.high?.toLocaleString()}</span>
            <span className="text-red-400">{bar.low?.toLocaleString()}</span>
            <span className="text-gray-700 dark:text-gray-300">{bar.close?.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-2 p-4 animate-pulse">
      <div className="flex gap-1 items-end h-full">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-sm"
            style={{ height: `${30 + Math.random() * 60}%` }} />
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StockChart() {
  const { isDark } = useTheme()
  const {
    selectedSymbol, selectedIndexId, chartType, timeframe,
    activeIndicators, isIndex, onHover, onPin, pinnedDate, clearPin,
    activePosition,
  } = useAnalysis()

  const mainRef   = useRef(null)
  const rsiRef    = useRef(null)
  const macdRef   = useRef(null)
  const chartsRef = useRef({})
  const seriesRef = useRef({})
  const moversCache = useRef({})

  const [chartData,   setChartData]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [tooltip,     setTooltip]     = useState(null)
  const [overlayData, setOverlayData] = useState(null)
  const [latestClose, setLatestClose] = useState(null)

  const C = {
    bg:     isDark ? '#030712' : '#ffffff',
    grid:   'transparent',
    text:   isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#111827' : '#f3f4f6',
    up:     '#10b981',
    down:   '#ef4444',
    ma:     '#3b82f6',
    rsi:    '#a78bfa',
    macd:   '#60a5fa',
    signal: '#f59e0b',
  }

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

    const req = isIndex(selectedSymbol)
      ? getIndexChart({ index_id: selectedIndexId, timeframe })
      : getStockChart({ symbol: selectedSymbol, timeframe })

    req.then(r => {
      const data = r.data.data || []
      setChartData(data)
      setLatestClose(data.length ? data[data.length - 1].close : null)
      setLoading(false)
    }).catch(e => { setError(e.response?.data?.error || 'Failed to load data'); setLoading(false) })
  }, [selectedSymbol, selectedIndexId, timeframe])

  // Build charts
  useEffect(() => {
    if (loading || !chartData.length || !mainRef.current) return

    Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
    chartsRef.current = {}; seriesRef.current = {}

    const changeMap = {}
    chartData.forEach(d => { changeMap[d.time] = d.diff_pct ?? d.per_change })

    loadLC().then(({ createChart, CrosshairMode, LineStyle }) => {
      const base = {
        layout:    { background: { color: C.bg }, textColor: C.text, fontSize: 11 },
        attributionLogo: false,
        grid:      { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
        crosshair: { mode: CrosshairMode.Normal,
          vertLine: { width: 1, color: '#363a45', style: LineStyle.Solid },
          horzLine: { width: 1, color: '#363a45', style: LineStyle.Solid } },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.12 } },
        timeScale: { borderColor: C.border, timeVisible: true, fixLeftEdge: true, fixRightEdge: false, rightOffset: 5 },
        handleScroll: true, handleScale: true,
      }

      const main = createChart(mainRef.current, {
        ...base, width: mainRef.current.clientWidth, height: mainRef.current.clientHeight,
      })
      chartsRef.current.main = main

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

      if (activeIndicators.includes('MA')) {
        const ma = calcMA(chartData, 20)
        if (ma.length) {
          const s = main.addLineSeries({ color: '#3b82f680', lineWidth: 1.5, priceLineVisible: false, title: 'MA20' })
          s.setData(ma)
        }
      }

      // Position lines from entry date rightward
      if (activePosition) {
        const { entry_price, sl, tp, entry_date, position: dir } = activePosition
        const entryStr = entry_date ? entry_date.slice(0, 10) : null
        const startIdx = entryStr ? chartData.findIndex(d => d.time >= entryStr) : 0
        const fromData = startIdx >= 0 ? chartData.slice(startIdx) : []

        const addPosLine = (price, color, lineStyle, label) => {
          if (!price || !fromData.length) return
          const s = main.addLineSeries({
            color, lineWidth: 2, lineStyle,
            priceLineVisible: false, lastValueVisible: true,
            title: label, crosshairMarkerVisible: false,
          })
          s.setData(fromData.map(d => ({ time: d.time, value: parseFloat(price) })))
        }
        addPosLine(entry_price, '#60a5fa', 0, 'Entry')
        addPosLine(sl,          '#f87171', 2, 'SL')
        addPosLine(tp,          '#34d399', 2, 'TP')

        if (fromData.length) {
          priceSeries.setMarkers([{
            time: fromData[0].time,
            position: dir === 'SHORT' ? 'aboveBar' : 'belowBar',
            color: '#60a5fa', shape: dir === 'SHORT' ? 'arrowDown' : 'arrowUp',
            text: '', size: 2,
          }])
        }
      }

      // Volume inline
      const volSeries = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
      main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } })
      volSeries.setData(chartData.map(d => ({
        time: d.time, value: d.volume || d.turnover || 0,
        color: d.close >= d.open ? C.up + '44' : C.down + '44',
      })))

      // Hover + click
      main.subscribeCrosshairMove(async param => {
        if (pinnedDate) return
        if (!param.time) { setTooltip(null); setOverlayData(null); onHover(null, null); return }
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })
        const movers = await getMovers(param.time)
        setOverlayData({ date: param.time, movers, pinned: false })
        onHover(param.time, movers)
      })

      main.subscribeClick(async param => {
        if (!param.time) return
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        const movers = await getMovers(param.time)
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })
        setOverlayData({ date: param.time, movers, pinned: true })
        onPin(param.time, movers)
      })

      // RSI sub-pane
      if (activeIndicators.includes('RSI') && rsiRef.current) {
        const rsiData = calcRSI(chartData)
        if (rsiData.length) {
          const rc = createChart(rsiRef.current, {
            ...base, width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight,
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
            ...base, width: macdRef.current.clientWidth, height: macdRef.current.clientHeight,
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

      main.timeScale().fitContent()

      const ro = new ResizeObserver(() => {
        if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth })
        if (rsiRef.current  && chartsRef.current.rsi)  chartsRef.current.rsi.applyOptions({ width: rsiRef.current.clientWidth })
        if (macdRef.current && chartsRef.current.macd) chartsRef.current.macd.applyOptions({ width: macdRef.current.clientWidth })
      })
      ro.observe(mainRef.current)
      return () => ro.disconnect()
    })

    return () => {
      Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
      chartsRef.current = {}
    }
  }, [chartData, isDark, chartType, activeIndicators, activePosition])

  useEffect(() => {
    if (!pinnedDate) setOverlayData(prev => prev ? { ...prev, pinned: false } : null)
  }, [pinnedDate])

  const showRSI  = activeIndicators.includes('RSI')
  const showMACD = activeIndicators.includes('MACD')
  const indCount = (showRSI ? 1 : 0) + (showMACD ? 1 : 0)
  const mainPct  = indCount === 0 ? 100 : indCount === 1 ? 70 : 55

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-[12px] text-gray-400">{error}</p>
    </div>
  )

  return (
    <div className="relative flex flex-col w-full h-full bg-white dark:bg-gray-950">

      {/* ── Embedded HUD — top-left: symbol + price ── */}
      <div className="absolute top-2 left-3 z-30 flex flex-col gap-1.5 pointer-events-none">
        {!loading && <ChartHUDPrice latestClose={latestClose} chartData={chartData} />}
      </div>

      {/* ── Embedded HUD — top bar: search + controls ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-3 py-0.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
        <ChartSymbolSearch />
        <div className="w-px h-4 bg-white/10 shrink-0" />
        <ChartHUDControls />
      </div>

      {/* ── Position badge ── */}
      <PositionBadge position={activePosition} latestClose={latestClose} />

      {/* ── OHLC tooltip on hover ── */}
      <OHLCTooltip bar={tooltip} change={tooltip?.change} />

      {/* ── Movers overlay on hover/click ── */}
      {overlayData?.movers && (
        <MoversOverlay
          movers={overlayData.movers}
          date={overlayData.date}
          pinned={overlayData.pinned}
          onClear={() => { clearPin(); setOverlayData(null); setTooltip(null) }}
        />
      )}

      {/* Unpin hint */}
      {overlayData?.pinned && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="text-[9px] text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
            Click elsewhere to unpin
          </span>
        </div>
      )}

      {loading ? (
        <ChartSkeleton />
      ) : (
        <>
          <div ref={mainRef} style={{ height: `${mainPct}%`, paddingTop: '2px', boxSizing: 'border-box' }} className="w-full" />

          {showRSI && (
            <div className="w-full border-t border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2 px-3 pt-1">
                <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">RSI</span>
                <span className="text-[8px] text-gray-400">14</span>
                <span className="text-[8px] text-gray-300 dark:text-gray-600">· 70 overbought · 30 oversold</span>
              </div>
              <div ref={rsiRef} style={{ height: '88px' }} className="w-full" />
            </div>
          )}

          {showMACD && (
            <div className="w-full border-t border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2 px-3 pt-1">
                <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">MACD</span>
                <span className="text-[8px] text-gray-400">12 / 26 / 9</span>
                <span className="w-2 h-0.5 bg-blue-400 rounded inline-block" />
                <span className="text-[8px] text-gray-400">MACD</span>
                <span className="w-2 h-0.5 bg-amber-400 rounded inline-block" />
                <span className="text-[8px] text-gray-400">Signal</span>
              </div>
              <div ref={macdRef} style={{ height: '88px' }} className="w-full" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
