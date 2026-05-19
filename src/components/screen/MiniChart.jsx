import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getIndexChart, getStockChart, getMarketSymbols } from '../../api'

// ── Module-level cache (shared across all MiniChart instances) ────────────────
const _cache    = new Map()  // `sym:tf` or `idx:id:tf` → { data, ts }
const _symCache = { data: null, ts: 0 }
const CACHE_TTL = 5 * 60_000
const SYM_TTL   = 60 * 60_000

const INDEX_LIST = [
  { index_id: 12, name: 'NEPSE' },
  { index_id: 1,  name: 'Commercial Bank' },
  { index_id: 5,  name: 'Hydropower' },
  { index_id: 6,  name: 'Life Insurance' },
]

const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']

async function loadLC() { return import('lightweight-charts') }

// ── Inline symbol search ──────────────────────────────────────────────────────

function MiniSymbolSearch({ symbol, isIdx, onSelect }) {
  const [query,   setQuery]   = useState('')
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState({ stocks: [], indexes: [] })
  const [cursor,  setCursor]  = useState(-1)
  const inputRef        = useRef(null)
  const listRef         = useRef(null)
  const mouseDownInList = useRef(false)

  useEffect(() => {
    if (_symCache.data && Date.now() - _symCache.ts < SYM_TTL) {
      setItems(_symCache.data); return
    }
    getMarketSymbols().then(r => {
      _symCache.data = r.data
      _symCache.ts   = Date.now()
      setItems(r.data)
    }).catch(() => {})
  }, [])

  const allItems = [
    ...items.indexes.map(i => ({ label: i.name, indexId: i.index_id, company_name: null })),
    ...items.stocks.map(s => ({ label: s.symbol, indexId: null, company_name: s.company_name || null })),
  ]

  const q = query.toLowerCase()
  const filtered = query.length < 1
    ? allItems.slice(0, 20)
    : allItems.filter(i =>
        i.label.toLowerCase().includes(q) ||
        (i.company_name && i.company_name.toLowerCase().includes(q))
      ).slice(0, 30)

  function select(item) {
    setQuery('')
    setOpen(false)
    setCursor(-1)
    onSelect(item.label, item.indexId)
  }

  function handleKey(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && cursor >= 0) select(filtered[cursor])
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
    }
  }, [cursor])

  const displayLabel = symbol || '—'

  return (
    <div className="relative">
      <div
        className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-1.5 py-0.5 cursor-pointer"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30) }}
      >
        <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder={displayLabel}
          autoComplete="off"
          className="bg-transparent text-[10px] font-bold text-gray-700 dark:text-gray-200 placeholder-gray-600 dark:placeholder-gray-300 outline-none w-[72px]"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-50 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          <ul ref={listRef}>
            {filtered.map((item, i) => (
              <li
                key={item.label}
                onMouseDown={() => { mouseDownInList.current = true; select(item); mouseDownInList.current = false }}
                className={`px-2.5 py-1.5 cursor-pointer transition-colors ${
                  i === cursor ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.label}</div>
                {item.company_name && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">{item.company_name}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── MiniChart — single chart panel ───────────────────────────────────────────
// Exposes `chartRef` via forwardRef so MultiChartPage can sync crosshair/range.

const MiniChart = forwardRef(function MiniChart({ defaultSymbol = 'NEPSE', defaultIndexId = 12, panelIdx }, ref) {
  const { isDark } = useTheme()

  const [symbol,    setSymbol]    = useState(defaultSymbol)
  const [indexId,   setIndexId]   = useState(defaultIndexId)
  const [isIndex,   setIsIndex]   = useState(defaultIndexId != null)
  const [timeframe, setTimeframe] = useState('1Y')
  const [chartType, setChartType] = useState('candlestick')
  const [chartData, setChartData] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [latestClose, setLatestClose] = useState(null)

  const containerRef = useRef(null)
  const chartInstRef = useRef(null)   // lightweight-charts Chart instance
  const seriesRef    = useRef(null)   // price series
  const isDarkRef    = useRef(isDark)
  isDarkRef.current  = isDark

  // Expose chart instance to parent for sync
  useImperativeHandle(ref, () => ({
    getChart: () => chartInstRef.current,
  }), [])

  // ── Fetch data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    setError(null)
    const cacheKey = isIndex ? `idx:${indexId}:${timeframe}` : `${symbol}:${timeframe}`
    const cached = _cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setChartData(cached.data)
      setLatestClose(cached.latest)
      setLoading(false)
      return
    }
    setLoading(true)
    const req = isIndex
      ? getIndexChart({ index_id: indexId, timeframe })
      : getStockChart({ symbol, timeframe })
    req.then(r => {
      const data   = r.data.data || []
      const latest = data.length > 0 ? data[data.length - 1].close : null
      _cache.set(cacheKey, { data, latest, ts: Date.now() })
      setChartData(data)
      setLatestClose(latest)
      setLoading(false)
    }).catch(() => {
      setError('Failed to load')
      setLoading(false)
    })
  }, [symbol, indexId, isIndex, timeframe])

  // ── Build / rebuild chart ────────────────────────────────────────────────────

  useEffect(() => {
    if (loading || !chartData.length || !containerRef.current) return

    const C = {
      bg:     isDark ? '#030712' : '#ffffff',
      text:   isDark ? '#6b7280' : '#9ca3af',
      border: isDark ? '#111827' : '#f3f4f6',
      up:     '#10b981',
      down:   '#ef4444',
    }

    let chart, cancelled = false

    loadLC().then(({ createChart }) => {
      if (cancelled || !containerRef.current) return

      // Remove previous instance
      if (chartInstRef.current) {
        try { chartInstRef.current.remove() } catch (_) {}
        chartInstRef.current = null
        seriesRef.current    = null
      }

      chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: { background: { color: C.bg }, textColor: C.text },
        grid:   { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: C.border, timeVisible: true },
        crosshair: { mode: 1 },
        handleScroll: true,
        handleScale:  true,
      })

      chartInstRef.current = chart

      const candleData = chartData.map(d => ({
        time:  d.time || d.date,
        open:  +d.open, high: +d.high, low: +d.low, close: +d.close,
      }))

      let priceSeries
      if (chartType === 'line') {
        priceSeries = chart.addLineSeries({ color: C.up, lineWidth: 2, priceLineVisible: false })
        priceSeries.setData(candleData.map(d => ({ time: d.time, value: d.close })))
      } else {
        priceSeries = chart.addCandlestickSeries({
          upColor: C.up, downColor: C.down,
          borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up, wickDownColor: C.down,
          priceLineVisible: false,
        })
        priceSeries.setData(candleData)
      }

      seriesRef.current = priceSeries

      // Volume histogram
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' }, priceScaleId: 'vol',
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      volSeries.setData(chartData.map(d => ({
        time:  d.time || d.date,
        value: +(d.volume || d.turnover || 0),
        color: +d.close >= +d.open ? C.up + '44' : C.down + '44',
      })))

      chart.timeScale().fitContent()

      // ResizeObserver
      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chart) return
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      })
      if (containerRef.current) ro.observe(containerRef.current)

      // Cleanup stored on chart instance for parent to access
      chart._roDisconnect = () => ro.disconnect()
    })

    return () => {
      cancelled = true
      if (chartInstRef.current) {
        try {
          if (chartInstRef.current._roDisconnect) chartInstRef.current._roDisconnect()
          chartInstRef.current.remove()
        } catch (_) {}
        chartInstRef.current = null
        seriesRef.current    = null
      }
    }
  }, [chartData, isDark, chartType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Symbol select ─────────────────────────────────────────────────────────────

  function handleSelect(sym, idxId) {
    setSymbol(sym)
    setIndexId(idxId ?? null)
    setIsIndex(idxId != null)
  }

  // ── Last bar info ─────────────────────────────────────────────────────────────

  const lastBar = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const change  = lastBar ? (lastBar.diff_pct ?? lastBar.per_change ?? null) : null
  const isPos   = parseFloat(change) >= 0
  const close   = latestClose ?? lastBar?.close

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 overflow-hidden">

      {/* ── Header strip ── */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">

        {/* Symbol search */}
        <MiniSymbolSearch symbol={symbol} isIdx={isIndex} onSelect={handleSelect} />

        {/* Price + change */}
        {close != null && (
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-[11px] font-black text-gray-900 dark:text-white tabular-nums">
              {parseFloat(close).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {change != null && (
              <span className={`text-[10px] font-bold whitespace-nowrap ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
                {isPos ? '▲' : '▼'}{Math.abs(parseFloat(change)).toFixed(2)}%
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Chart type toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded p-0.5">
          {[['candlestick', '≡'], ['line', '╱']].map(([type, icon]) => (
            <button key={type} onClick={() => setChartType(type)}
              title={type}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                chartType === type
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
              {icon}
            </button>
          ))}
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className={`px-1 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart area ── */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-red-400">{error}</div>
        )}
        {/* Symbol label watermark */}
        {!loading && !error && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="text-[10px] font-bold text-gray-300 dark:text-gray-700">{symbol}</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
})

export default MiniChart
