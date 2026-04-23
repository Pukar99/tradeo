import { useState, useEffect, useCallback, useRef } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { API } from '../../api'

const STATE_CONFIG = {
  COMPRESSED: { color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800',    text: 'text-blue-700 dark:text-blue-400',   label: 'COMPRESSED' },
  NORMAL:     { color: '#64748b', bg: 'bg-gray-50 dark:bg-gray-900',        border: 'border-gray-200 dark:border-gray-700',    text: 'text-gray-600 dark:text-gray-300',   label: 'NORMAL'      },
  EXPANDED:   { color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400',label: 'EXPANDED'   },
}

const LOOKBACK_OPTIONS = [
  { value: 60,  label: '60d'  },
  { value: 120, label: '120d' },
  { value: 180, label: '180d' },
  { value: 252, label: '1Y'   },
]

export default function VolatilityMapPage() {
  const [symbols,      setSymbols]      = useState([])
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showList,     setShowList]     = useState(false)
  const [symbol,       setSymbol]       = useState('')
  const [lookback,     setLookback]     = useState(120)
  const [compThresh,   setCompThresh]   = useState(0.7)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [data,         setData]         = useState(null)

  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)
  const priceRef          = useRef(null)
  const atrRef            = useRef(null)

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

    priceRef.current = chart.addAreaSeries({
      lineColor:   '#3b82f6',
      topColor:    'rgba(59,130,246,0.1)',
      bottomColor: 'rgba(59,130,246,0)',
      lineWidth:   2,
    })

    atrRef.current = chart.addLineSeries({
      color:       '#f97316',
      lineWidth:   1,
      priceScaleId: 'atr',
    })
    chart.priceScale('atr').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 }, borderVisible: false })

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

  // Paint chart
  useEffect(() => {
    if (!data || !priceRef.current || !atrRef.current) return

    priceRef.current.setData(
      data.chart_series.map(c => ({ time: c.date, value: c.close }))
    )

    atrRef.current.setData(
      data.chart_series.filter(c => c.atr != null).map(c => ({ time: c.date, value: c.atr }))
    )

    // Compression zone markers on price
    const markers = []
    data.compression_periods.forEach(p => {
      markers.push({
        time: p.start_date, position: 'belowBar',
        color: '#3b82f6', shape: 'circle', text: '◉', size: 0,
      })
    })
    // Current compression
    if (data.current_state === 'COMPRESSED' && data.chart_series.length) {
      markers.push({
        time:     data.chart_series[data.chart_series.length - 1].date,
        position: 'belowBar',
        color:    '#3b82f6',
        shape:    'arrowUp',
        text:     'COMP',
        size:     1,
      })
    }
    priceRef.current.setMarkers(markers.sort((a, b) => a.time.localeCompare(b.time)))
  }, [data])

  const handleScan = useCallback(async () => {
    if (!symbol) return setError('Select a symbol')
    setError('')
    setLoading(true)
    setData(null)
    try {
      const r = await API.get('/api/volatility/clusters', {
        params: { symbol, lookback, comp_threshold: compThresh },
      })
      setData(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load volatility data')
    } finally {
      setLoading(false)
    }
  }, [symbol, lookback, compThresh])

  const cfg = data ? STATE_CONFIG[data.current_state] || STATE_CONFIG.NORMAL : null

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[200px] min-w-[180px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Volatility Map
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

          {/* Compression threshold */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comp. Threshold</label>
              <span className="text-[10px] font-bold text-blue-600">{compThresh}×</span>
            </div>
            <input type="range" min="0.4" max="0.9" step="0.05"
              value={compThresh}
              onChange={e => setCompThresh(parseFloat(e.target.value))}
              className="w-full mt-1 accent-blue-500" />
            <div className="text-[9px] text-gray-400">ATR below {compThresh}× avg = compressed</div>
          </div>

          {error && <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>}

          <button onClick={handleScan} disabled={loading || !symbol}
            className="w-full py-2 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
            {loading ? 'Loading…' : 'Map Volatility'}
          </button>

          <div className="mt-auto text-[9px] text-gray-400 text-center leading-tight">
            ATR(14) compression and expansion clusters
          </div>
        </div>
      </div>

      {/* ── CENTER: Chart ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <div ref={chartContainerRef} className="flex-1 min-h-0" />
        {data && (
          <div className="absolute top-2 left-3 text-[9px] text-gray-400 pointer-events-none">
            {data.symbol} · Blue line = price · Orange line = ATR (lower panel)
          </div>
        )}
        {!data && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[12px] text-gray-400">Select a symbol to map volatility clusters</span>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[220px] border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-y-auto">
        {data && cfg ? (
          <div className="flex flex-col gap-4 p-3">

            {/* State badge */}
            <div className={`rounded-xl border p-3 ${cfg.border} ${cfg.bg}`}>
              <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Current State</div>
              <div className={`text-[20px] font-black ${cfg.text}`}>{cfg.label}</div>
              {data.compression_streak > 0 && (
                <div className="text-[9px] text-blue-600 dark:text-blue-400 mt-1 font-semibold">
                  {data.compression_streak} consecutive compressed days
                </div>
              )}
              <div className="text-[9px] text-gray-400 mt-1">{data.symbol} · {data.latest_date}</div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
              <Metric label="ATR" value={data.current_atr ?? '—'} sub="14-period" />
              <Metric
                label="ATR Percentile"
                value={data.atr_percentile != null ? `${data.atr_percentile}th` : '—'}
                color={data.atr_percentile <= 20 ? 'blue' : data.atr_percentile >= 80 ? 'orange' : null}
                sub="vs 252d history"
              />
              <Metric label="Compressions" value={data.compression_count} sub={`in ${data.lookback}d`} />
              <Metric
                label="Avg Expansion"
                value={data.avg_post_expansion != null ? `+${data.avg_post_expansion}%` : '—'}
                color="orange"
                sub="post-compression"
              />
            </div>

            {/* Alert when compressed */}
            {data.current_state === 'COMPRESSED' && (
              <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <span className="text-blue-500 text-[13px] shrink-0 mt-0.5">◉</span>
                <div>
                  <div className="text-[10px] font-bold text-blue-800 dark:text-blue-300">Low volatility compression</div>
                  <div className="text-[9px] text-blue-700 dark:text-blue-400 mt-0.5 leading-tight">
                    {data.avg_post_expansion != null
                      ? `Historically followed by +${data.avg_post_expansion}% ATR expansion within 10 days.`
                      : 'Compression often precedes expansion — watch for breakout.'}
                  </div>
                </div>
              </div>
            )}

            {/* Compression periods */}
            {data.compression_periods.length > 0 && (
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Compression Periods
                </div>
                <div className="flex flex-col gap-1">
                  {data.compression_periods.slice(-6).reverse().map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800">
                      <div>
                        <div className="text-[9px] text-gray-500">{p.start_date} → {p.end_date}</div>
                        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300">{p.length}d compressed</div>
                      </div>
                      {p.post_expansion_pct != null && (
                        <span className={`text-[10px] font-bold ${p.post_expansion_pct > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          +{p.post_expansion_pct}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400 text-center px-4">
            {loading ? 'Mapping…' : 'Map a symbol to see volatility clusters'}
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, sub, color }) {
  const textColor = color === 'blue'   ? 'text-blue-600 dark:text-blue-400'
                  : color === 'orange' ? 'text-orange-600 dark:text-orange-400'
                  : color === 'green'  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-[13px] font-bold mt-0.5 ${textColor}`}>{value}</div>
      {sub && <div className="text-[8px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
