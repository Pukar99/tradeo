import { useState, useCallback, useRef, useEffect } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import axios from 'axios'

const API = axios.create({ baseURL: 'http://localhost:5000' })
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

const SIGNAL_COLORS = {
  ACCUMULATION: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  DISTRIBUTION:  { bg: 'bg-red-100 dark:bg-red-900/30',   text: 'text-red-700 dark:text-red-400' },
  BREAKOUT:      { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  FAKEOUT:       { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  NEUTRAL:       { bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-500 dark:text-gray-400' },
}

function SignalBadge({ type }) {
  const c = SIGNAL_COLORS[type] || SIGNAL_COLORS.NEUTRAL
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${c.bg} ${c.text}`}>
      {type}
    </span>
  )
}

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 w-6 text-right">{score}</span>
    </div>
  )
}

export default function InsightPage() {
  const [symbols,      setSymbols]      = useState([])
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showList,     setShowList]     = useState(false)
  const [symbol,       setSymbol]       = useState('')
  const [from,         setFrom]         = useState('')
  const [to,           setTo]           = useState('')
  const [spikeMult,    setSpikeMult]    = useState(2.0)
  const [lookback,     setLookback]     = useState(60)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [result,       setResult]       = useState(null)
  const [selected,     setSelected]     = useState(null)  // selected signal date

  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)
  const candleSeriesRef   = useRef(null)
  const volumeSeriesRef   = useRef(null)
  const markersRef        = useRef([])

  // Load symbols
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
      layout: {
        background: { color: 'transparent' },
        textColor:  '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(100,116,139,0.1)' },
        horzLines: { color: 'rgba(100,116,139,0.1)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(100,116,139,0.2)' },
      timeScale:       { borderColor: 'rgba(100,116,139,0.2)', timeVisible: true },
    })

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor:      '#22c55e',
      downColor:    '#ef4444',
      borderVisible: false,
      wickUpColor:  '#22c55e',
      wickDownColor:'#ef4444',
    })

    volumeSeriesRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: 'rgba(100,116,139,0.3)',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } })

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

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // Paint chart when result arrives
  useEffect(() => {
    if (!result || !candleSeriesRef.current) return

    const candles = result.chart_series.map(c => ({
      time:  c.date,
      open:  c.close, high: c.close, low: c.close, close: c.close, // fallback
    }))

    // Fetch OHLCV for chart (chart_series only has close)
    // We'll rebuild from signals + chart_series
    // For now, use close as OHLC approximation — good enough for signal overlay
    candleSeriesRef.current.setData(
      result.chart_series.map(c => ({
        time: c.date, open: c.close, high: c.close, low: c.close, close: c.close,
      }))
    )

    // Volume bars — amber on spike signals
    const signalDates = new Set(result.signals.map(s => s.date))
    volumeSeriesRef.current.setData(
      result.chart_series.map(c => ({
        time:  c.date,
        value: c.volume,
        color: signalDates.has(c.date) ? 'rgba(245,158,11,0.7)' : 'rgba(100,116,139,0.3)',
      }))
    )

    // Markers for signals
    const markers = result.signals.map(s => ({
      time:     s.date,
      position: 'aboveBar',
      color:    s.type === 'ACCUMULATION' ? '#22c55e'
              : s.type === 'DISTRIBUTION'  ? '#ef4444'
              : s.type === 'BREAKOUT'      ? '#3b82f6'
              : s.type === 'FAKEOUT'       ? '#f97316'
              : '#94a3b8',
      shape:  s.type === 'DISTRIBUTION' ? 'arrowDown' : 'arrowUp',
      text:   s.type.slice(0, 3),
      size:   1,
    })).sort((a, b) => a.time.localeCompare(b.time))

    candleSeriesRef.current.setMarkers(markers)
  }, [result])

  const handleScan = useCallback(async () => {
    if (!symbol) return setError('Select a symbol')
    setError('')
    setLoading(true)
    setResult(null)
    setSelected(null)
    try {
      const params = { symbol, spike_mult: spikeMult, lookback }
      if (from) params.from = from
      if (to)   params.to   = to
      const r = await API.get('/api/insight/signals', { params })
      setResult(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch signals')
    } finally {
      setLoading(false)
    }
  }, [symbol, from, to, spikeMult, lookback])

  const selectedSignal = selected && result?.signals.find(s => s.date === selected)

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[220px] min-w-[200px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Insight — Proxy Signals
          </div>

          {/* Symbol */}
          <div className="relative">
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</label>
            <div
              onClick={() => setShowList(v => !v)}
              className="mt-0.5 flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer text-[11px]"
            >
              <span className={symbol ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400'}>
                {symbol || 'Select symbol'}
              </span>
              <svg className="ml-auto w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showList && (
              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                <input
                  autoFocus
                  value={symbolSearch}
                  onChange={e => setSymbolSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full px-2 py-1.5 text-[11px] border-b border-gray-100 dark:border-gray-700 bg-transparent outline-none dark:text-white"
                />
                <div className="max-h-40 overflow-y-auto">
                  {filteredSymbols.map(s => (
                    <div
                      key={s.symbol}
                      onClick={() => { setSymbol(s.symbol); setShowList(false); setSymbolSearch('') }}
                      className="px-2 py-1 text-[11px] hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-gray-800 dark:text-gray-200"
                    >
                      <span className="font-semibold">{s.symbol}</span>
                      <span className="text-gray-400 ml-2 text-[9px]">{s.total_days}d</span>
                    </div>
                  ))}
                  {filteredSymbols.length === 0 && (
                    <div className="px-2 py-2 text-[11px] text-gray-400">No results</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {/* Volume Spike Multiplier */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Vol Spike ×
              </label>
              <span className="text-[10px] font-bold text-amber-600">{spikeMult.toFixed(1)}×</span>
            </div>
            <input type="range" min="1.2" max="5" step="0.1"
              value={spikeMult}
              onChange={e => setSpikeMult(parseFloat(e.target.value))}
              className="w-full mt-1 accent-amber-500"
            />
          </div>

          {/* Lookback */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Lookback
              </label>
              <span className="text-[10px] font-bold text-blue-600">{lookback}d</span>
            </div>
            <input type="range" min="10" max="252" step="5"
              value={lookback}
              onChange={e => setLookback(parseInt(e.target.value))}
              className="w-full mt-1 accent-blue-500"
            />
          </div>

          {error && (
            <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>
          )}

          <button
            onClick={handleScan}
            disabled={loading}
            className="mt-auto w-full py-2 text-[11px] font-bold rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors"
          >
            {loading ? 'Scanning…' : 'Scan Signals'}
          </button>

          <div className="text-[9px] text-gray-400 text-center leading-tight">
            Volume + ATR proxy analysis
          </div>
        </div>
      </div>

      {/* ── CENTER: Chart ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div ref={chartContainerRef} className="flex-1 min-h-0" />

        {!result && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[12px] text-gray-400">Select a symbol and scan to see signals</span>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="w-[280px] min-w-[240px] border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col h-full overflow-y-auto">

          {/* Summary strip */}
          {result && (
            <div className="flex gap-2 p-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex-1 text-center">
                <div className="text-[16px] font-bold text-gray-900 dark:text-white">{result.total_signals}</div>
                <div className="text-[9px] text-gray-400 uppercase">Signals</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-[16px] font-bold text-green-600">
                  {result.signals.filter(s => s.type === 'ACCUMULATION').length}
                </div>
                <div className="text-[9px] text-gray-400 uppercase">Accum</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-[16px] font-bold text-red-500">
                  {result.signals.filter(s => s.type === 'DISTRIBUTION').length}
                </div>
                <div className="text-[9px] text-gray-400 uppercase">Distrib</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-[16px] font-bold text-blue-600">
                  {result.signals.filter(s => s.type === 'BREAKOUT').length}
                </div>
                <div className="text-[9px] text-gray-400 uppercase">Break</div>
              </div>
            </div>
          )}

          {/* Selected signal detail */}
          {selectedSignal && (
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{selectedSignal.date}</div>
                <SignalBadge type={selectedSignal.type} />
              </div>
              <ScoreBar score={selectedSignal.score} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                <Stat label="Close"      value={`Rs. ${selectedSignal.close.toFixed(2)}`} />
                <Stat label="Vol Ratio"  value={`${selectedSignal.vol_ratio}×`} color="amber" />
                <Stat label="Volume"     value={fmtVol(selectedSignal.volume)} />
                <Stat label="Avg Vol"    value={fmtVol(selectedSignal.avg_volume)} />
                {selectedSignal.vwap && <Stat label="VWAP" value={`Rs. ${selectedSignal.vwap}`} />}
                <Stat label="20D High"   value={selectedSignal.is_20d_high ? 'Yes' : 'No'}
                  color={selectedSignal.is_20d_high ? 'green' : null} />
              </div>
              <button onClick={() => setSelected(null)} className="mt-2 text-[9px] text-gray-400 hover:text-gray-600">
                ✕ Clear selection
              </button>
            </div>
          )}

          {/* Signal list */}
          {result && result.signals.length > 0 ? (
            <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900 shrink-0">
                All Signals ({result.total_signals})
              </div>
              {[...result.signals].reverse().map(s => (
                <div
                  key={s.date}
                  onClick={() => setSelected(s.date === selected ? null : s.date)}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    selected === s.date ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <SignalBadge type={s.type} />
                      <span className="text-[9px] text-gray-400">{s.date}</span>
                    </div>
                    <ScoreBar score={s.score} />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-semibold text-amber-600">{s.vol_ratio}×</div>
                    <div className="text-[9px] text-gray-400">vol</div>
                  </div>
                </div>
              ))}
            </div>
          ) : result ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
              No signals found — try lowering the spike multiplier
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400 text-center px-6">
              {loading ? 'Scanning…' : 'Run a scan to see proxy signals'}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stat({ label, value, color }) {
  const textColor = color === 'green' ? 'text-green-600 dark:text-green-400'
                  : color === 'amber' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-900 dark:text-white'
  return (
    <div>
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-[10px] font-semibold ${textColor}`}>{value}</div>
    </div>
  )
}

function fmtVol(v) {
  if (!v) return '—'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
