import { useState, useEffect, useCallback, useRef } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { API } from '../../api'

const STRUCTURE_CONFIG = {
  UPTREND:   { color: '#22c55e', label: 'UPTREND',   bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-600 dark:text-green-400'   },
  DOWNTREND: { color: '#ef4444', label: 'DOWNTREND', bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-600 dark:text-red-400'       },
  RANGING:   { color: '#f59e0b', label: 'RANGING',   bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-600 dark:text-amber-400'   },
  UNCLEAR:   { color: '#94a3b8', label: 'UNCLEAR',   bg: 'bg-gray-50 dark:bg-gray-900',        border: 'border-gray-200 dark:border-gray-700',     text: 'text-gray-500 dark:text-gray-400'     },
}

const LABEL_COLORS = {
  HH: '#22c55e', HL: '#86efac',
  LH: '#f97316', LL: '#ef4444',
  SH: '#94a3b8', SL: '#94a3b8',
}

const LOOKBACK_OPTIONS = [
  { value: 60,  label: '60d'  },
  { value: 120, label: '120d' },
  { value: 180, label: '180d' },
  { value: 252, label: '1Y'   },
]

export default function SwingStructurePage() {
  const [symbols,      setSymbols]      = useState([])
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showList,     setShowList]     = useState(false)
  const [symbol,       setSymbol]       = useState('')
  const [lookback,     setLookback]     = useState(120)
  const [swingN,       setSwingN]       = useState(3)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [data,         setData]         = useState(null)

  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)
  const candleRef         = useRef(null)

  useEffect(() => {
    API.get('/api/backtest/symbols')
      .then(r => setSymbols(r.data.symbols || []))
      .catch(() => {})
  }, [])

  const filteredSymbols = symbols
    .filter(s => s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()))
    .slice(0, 50)

  // Init chart
  useEffect(() => {
    if (!chartContainerRef.current) return
    const chart = createChart(chartContainerRef.current, {
      width:  chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: '#64748b' },
      grid:   { vertLines: { color: 'rgba(100,116,139,0.1)' }, horzLines: { color: 'rgba(100,116,139,0.1)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(100,116,139,0.2)' },
      timeScale:       { borderColor: 'rgba(100,116,139,0.2)', timeVisible: true },
    })
    candleRef.current = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    })
    ro.observe(chartContainerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [])

  // Paint chart when data arrives
  useEffect(() => {
    if (!data || !candleRef.current || !chartRef.current) return

    candleRef.current.setData(data.chart_candles.map(c => ({
      time: c.date, open: c.open, high: c.high, low: c.low, close: c.close,
    })))

    // SR zone lines
    // Remove previous lines by rebuilding series — add price lines
    data.sr_zones.slice(0, 8).forEach(zone => {
      candleRef.current.createPriceLine({
        price:     zone.price,
        color:     zone.type === 'R' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)',
        lineWidth: 1,
        lineStyle: 2, // dashed
        title:     `${zone.type} ${zone.touches}×`,
        axisLabelVisible: false,
      })
    })

    // Swing markers
    const markers = [
      ...data.swing_highs.map(h => ({
        time: h.date, position: 'aboveBar',
        color: LABEL_COLORS[h.label] || '#94a3b8',
        shape: 'arrowDown', text: h.label, size: 1,
      })),
      ...data.swing_lows.map(l => ({
        time: l.date, position: 'belowBar',
        color: LABEL_COLORS[l.label] || '#94a3b8',
        shape: 'arrowUp', text: l.label, size: 1,
      })),
    ].sort((a, b) => a.time.localeCompare(b.time))

    candleRef.current.setMarkers(markers)
  }, [data])

  const handleScan = useCallback(async () => {
    if (!symbol) return setError('Select a symbol')
    setError('')
    setLoading(true)
    setData(null)
    try {
      const r = await API.get('/api/structure/swings', {
        params: { symbol, lookback, n: swingN },
      })
      setData(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load structure')
    } finally {
      setLoading(false)
    }
  }, [symbol, lookback, swingN])

  const cfg = data ? STRUCTURE_CONFIG[data.structure] || STRUCTURE_CONFIG.UNCLEAR : null

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[200px] min-w-[180px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Swing Structure
          </div>

          {/* Symbol */}
          <div className="relative">
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</label>
            <div onClick={() => setShowList(v => !v)}
              className="mt-0.5 flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer text-[11px]">
              <span className={symbol ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400'}>
                {symbol || 'Select symbol'}
              </span>
              <svg className="ml-auto w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showList && (
              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                <input autoFocus value={symbolSearch} onChange={e => setSymbolSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full px-2 py-1.5 text-[11px] border-b border-gray-100 dark:border-gray-700 bg-transparent outline-none dark:text-white" />
                <div className="max-h-40 overflow-y-auto">
                  {filteredSymbols.map(s => (
                    <div key={s.symbol} onClick={() => { setSymbol(s.symbol); setShowList(false); setSymbolSearch('') }}
                      className="px-2 py-1 text-[11px] hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-gray-800 dark:text-gray-200">
                      <span className="font-semibold">{s.symbol}</span>
                      <span className="text-gray-400 ml-2 text-[9px]">{s.total_days}d</span>
                    </div>
                  ))}
                  {filteredSymbols.length === 0 && <div className="px-2 py-2 text-[11px] text-gray-400">No results</div>}
                </div>
              </div>
            )}
          </div>

          {/* Lookback */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lookback</label>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {LOOKBACK_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setLookback(opt.value)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                    lookback === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Swing sensitivity */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sensitivity</label>
              <span className="text-[10px] font-bold text-blue-600">{swingN} bars</span>
            </div>
            <input type="range" min="2" max="7" step="1" value={swingN}
              onChange={e => setSwingN(parseInt(e.target.value))}
              className="w-full mt-1 accent-blue-500" />
            <div className="text-[9px] text-gray-400">Bars each side to confirm swing</div>
          </div>

          {error && <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>}

          <button onClick={handleScan} disabled={loading || !symbol}
            className="w-full py-2 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
            {loading ? 'Loading…' : 'Analyze Structure'}
          </button>

          {/* Label legend */}
          <div className="mt-auto">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Labels</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {Object.entries(LABEL_COLORS).filter(([k]) => k !== 'SH' && k !== 'SL').map(([label, color]) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[9px] text-gray-500 dark:text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER: Chart ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <div ref={chartContainerRef} className="flex-1 min-h-0" />
        {!data && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[12px] text-gray-400">Select a symbol to map swing structure</span>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[220px] border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-y-auto">
        {data && cfg ? (
          <div className="flex flex-col gap-4 p-3">

            {/* Structure badge */}
            <div className={`rounded-xl border p-3 ${cfg.border} ${cfg.bg}`}>
              <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Structure</div>
              <div className={`text-[20px] font-black ${cfg.text}`}>{cfg.label}</div>
              <div className="text-[9px] text-gray-400 mt-1">{data.symbol} · {data.latest_date}</div>
            </div>

            {/* Alert */}
            {data.structure_alert && (
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="text-amber-500 text-[13px] shrink-0 mt-0.5">⚠</span>
                <span className="text-[10px] text-amber-800 dark:text-amber-300 leading-tight">{data.structure_alert}</span>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Swing Highs" value={data.swing_highs.length} />
              <Stat label="Swing Lows"  value={data.swing_lows.length}  />
              <Stat label="S/R Zones"   value={data.sr_zones.length}    />
              <Stat label="Latest Close" value={`Rs. ${data.latest_close.toLocaleString()}`} />
            </div>

            {/* Recent swings */}
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recent Swings</div>
              <div className="flex flex-col gap-1">
                {[...data.recent_swings].reverse().slice(0, 8).map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold px-1 rounded" style={{
                        backgroundColor: (LABEL_COLORS[s.label] || '#94a3b8') + '22',
                        color: LABEL_COLORS[s.label] || '#94a3b8',
                      }}>
                        {s.label}
                      </span>
                      <span className="text-[9px] text-gray-400">{s.date}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                      Rs. {s.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* S/R zones */}
            {data.sr_zones.length > 0 && (
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Key S/R Zones</div>
                <div className="flex flex-col gap-1">
                  {data.sr_zones.slice(0, 8).map((z, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1 rounded ${z.type === 'R' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                          {z.type}
                        </span>
                        <span className="text-[9px] text-gray-400">{z.touches}× tested</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                        Rs. {z.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400 text-center px-4">
            {loading ? 'Analyzing…' : 'Analyze a symbol to see swing structure'}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
    </div>
  )
}
