import { useState, useCallback, useRef, useEffect } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import axios from 'axios'

const API = axios.create({ baseURL: 'http://localhost:5000' })
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

// ── Condition definitions ─────────────────────────────────────────────────────

const CONDITION_TYPES = [
  { value: 'PRICE_ABOVE_N_HIGH',  label: 'Price > N-day High',   params: [{ key: 'n', label: 'Days', default: 20, min: 5, max: 252 }] },
  { value: 'PRICE_BELOW_N_LOW',   label: 'Price < N-day Low',    params: [{ key: 'n', label: 'Days', default: 20, min: 5, max: 252 }] },
  { value: 'PRICE_ABOVE_SMA',     label: 'Price > SMA',          params: [{ key: 'period', label: 'Period', default: 20, min: 5, max: 200 }] },
  { value: 'PRICE_BELOW_SMA',     label: 'Price < SMA',          params: [{ key: 'period', label: 'Period', default: 20, min: 5, max: 200 }] },
  { value: 'VOLUME_ABOVE_AVG',    label: 'Volume > Avg × mult',  params: [{ key: 'lookback', label: 'Lookback', default: 20, min: 5, max: 60 }, { key: 'multiplier', label: 'Mult', default: 1.5, min: 0.5, max: 5, step: 0.1 }] },
  { value: 'VOLUME_BELOW_AVG',    label: 'Volume < Avg × mult',  params: [{ key: 'lookback', label: 'Lookback', default: 20, min: 5, max: 60 }, { key: 'multiplier', label: 'Mult', default: 0.7, min: 0.1, max: 1, step: 0.05 }] },
  { value: 'BULLISH_CANDLE',      label: 'Bullish Candle',        params: [] },
  { value: 'BEARISH_CANDLE',      label: 'Bearish Candle',        params: [] },
  { value: 'NEAR_52W_HIGH',       label: 'Within X% of 52W High', params: [{ key: 'pct', label: '% from high', default: 5, min: 1, max: 20 }] },
  { value: 'CONSECUTIVE_UP',      label: 'N Consecutive Up',      params: [{ key: 'n', label: 'Days', default: 3, min: 2, max: 10 }] },
  { value: 'CONSECUTIVE_DOWN',    label: 'N Consecutive Down',    params: [{ key: 'n', label: 'Days', default: 3, min: 2, max: 10 }] },
]

function defaultParams(type) {
  const def = CONDITION_TYPES.find(c => c.value === type)
  if (!def) return {}
  return def.params.reduce((acc, p) => ({ ...acc, [p.key]: p.default }), {})
}

let _condId = 0
function newCond() {
  return { _id: ++_condId, type: 'PRICE_ABOVE_N_HIGH', ...defaultParams('PRICE_ABOVE_N_HIGH') }
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function initChart(container) {
  const chart = createChart(container, {
    width:  container.clientWidth,
    height: container.clientHeight,
    layout: { background: { color: 'transparent' }, textColor: '#64748b' },
    grid:   { vertLines: { color: 'rgba(100,116,139,0.1)' }, horzLines: { color: 'rgba(100,116,139,0.1)' } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'rgba(100,116,139,0.2)' },
    timeScale:       { borderColor: 'rgba(100,116,139,0.2)', timeVisible: true },
  })
  return chart
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BreakdownPage() {
  const [symbols,      setSymbols]      = useState([])
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showList,     setShowList]     = useState(false)
  const [symbol,       setSymbol]       = useState('')
  const [from,         setFrom]         = useState('')
  const [to,           setTo]           = useState('')
  const [lookahead,    setLookahead]    = useState(10)
  const [conditions,   setConditions]   = useState([newCond()])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [result,       setResult]       = useState(null)
  const [selected,     setSelected]     = useState(null)

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

  // Chart init
  useEffect(() => {
    if (!chartContainerRef.current) return
    const chart = initChart(chartContainerRef.current)
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

  // Paint chart when result arrives — fetch OHLCV separately for proper candles
  useEffect(() => {
    if (!result || !candleRef.current) return

    API.get('/api/backtest/ohlcv', {
      params: { symbol: result.symbol, from: result.matches[0]?.date || from, to: to || undefined }
    }).then(r => {
      if (!candleRef.current) return
      candleRef.current.setData(r.data.candles.map(c => ({
        time: c.date, open: c.open, high: c.high, low: c.low, close: c.close,
      })))

      const markers = result.matches
        .filter(m => m.complete)
        .map(m => ({
          time:     m.date,
          position: 'aboveBar',
          color:    m.outcome_pct > 0 ? '#22c55e' : '#ef4444',
          shape:    'circle',
          text:     m.outcome_pct > 0 ? `+${m.outcome_pct}%` : `${m.outcome_pct}%`,
          size:     1,
        }))
        .sort((a, b) => a.time.localeCompare(b.time))

      candleRef.current.setMarkers(markers)
    }).catch(() => {})
  }, [result])

  // Condition editor handlers
  const addCondition = () => setConditions(prev => [...prev, newCond()])
  const removeCondition = (id) => setConditions(prev => prev.filter(c => c._id !== id))
  const updateCondition = (id, key, value) => setConditions(prev =>
    prev.map(c => c._id === id ? { ...c, [key]: value } : c)
  )
  const changeConditionType = (id, type) => setConditions(prev =>
    prev.map(c => c._id === id ? { _id: id, type, ...defaultParams(type) } : c)
  )

  const handleScan = useCallback(async () => {
    if (!symbol)           return setError('Select a symbol')
    if (!conditions.length) return setError('Add at least one condition')
    setError('')
    setLoading(true)
    setResult(null)
    setSelected(null)
    try {
      // Strip internal _id before sending
      const cleanConditions = conditions.map(({ _id, ...rest }) => rest)
      const r = await API.post('/api/breakdown/scan', {
        symbol, from: from || undefined, to: to || undefined,
        conditions: cleanConditions, lookahead,
      })
      setResult(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to scan')
    } finally {
      setLoading(false)
    }
  }, [symbol, from, to, conditions, lookahead])

  const selectedMatch = selected != null && result?.matches[selected]

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[220px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Breakdown — Pattern Scanner
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
                    <div key={s.symbol}
                      onClick={() => { setSymbol(s.symbol); setShowList(false); setSymbolSearch('') }}
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

          {/* Date Range */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">From (optional)</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">To (optional)</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {/* Lookahead */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lookahead</label>
              <span className="text-[10px] font-bold text-indigo-600">{lookahead}d</span>
            </div>
            <input type="range" min="3" max="60" step="1" value={lookahead}
              onChange={e => setLookahead(parseInt(e.target.value))}
              className="w-full mt-1 accent-indigo-500" />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Conditions (AND)
              </label>
              {conditions.length < 4 && (
                <button onClick={addCondition}
                  className="text-[9px] text-blue-600 hover:text-blue-800 font-semibold">+ Add</button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {conditions.map((cond) => {
                const def = CONDITION_TYPES.find(c => c.value === cond.type)
                return (
                  <div key={cond._id} className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-1 mb-1.5">
                      <select
                        value={cond.type}
                        onChange={e => changeConditionType(cond._id, e.target.value)}
                        className="flex-1 text-[10px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white px-1 py-0.5 outline-none"
                      >
                        {CONDITION_TYPES.map(ct => (
                          <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                      </select>
                      {conditions.length > 1 && (
                        <button onClick={() => removeCondition(cond._id)}
                          className="text-gray-400 hover:text-red-500 text-[11px] leading-none px-0.5">✕</button>
                      )}
                    </div>
                    {def?.params.map(p => (
                      <div key={p.key} className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-400 w-14 shrink-0">{p.label}</span>
                        <input
                          type="number"
                          min={p.min}
                          max={p.max}
                          step={p.step || 1}
                          value={cond[p.key] ?? p.default}
                          onChange={e => updateCondition(cond._id, p.key, parseFloat(e.target.value))}
                          className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>
          )}

          <button onClick={handleScan} disabled={loading}
            className="mt-auto w-full py-2 text-[11px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors">
            {loading ? 'Scanning…' : 'Find Instances'}
          </button>

          <div className="text-[9px] text-gray-400 text-center leading-tight">
            Full history scan · outcome measured at {lookahead}d
          </div>
        </div>
      </div>

      {/* ── CENTER: Chart ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <div ref={chartContainerRef} className="flex-1 min-h-0" />
        {!result && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[12px] text-gray-400">Build conditions and scan to find historical instances</span>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="w-[280px] min-w-[240px] border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col h-full overflow-y-auto">

          {result && (
            <>
              {/* Stats */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {result.symbol} · {result.total_matches} instances · {result.lookahead}d lookahead
                </div>

                {result.stats.sample_warning && (
                  <div className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 mb-2">
                    ⚠ Small sample ({result.complete_count} complete) — not statistically significant
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <StatBox
                    label="Win Rate"
                    value={result.stats.win_rate != null ? `${result.stats.win_rate}%` : '—'}
                    color={result.stats.win_rate >= 60 ? 'green' : result.stats.win_rate >= 40 ? 'amber' : 'red'}
                  />
                  <StatBox
                    label="Exp. Value"
                    value={result.stats.expected_value != null ? `${result.stats.expected_value > 0 ? '+' : ''}${result.stats.expected_value}%` : '—'}
                    color={result.stats.expected_value > 0 ? 'green' : 'red'}
                  />
                  <StatBox
                    label="Avg Win"
                    value={result.stats.avg_win_pct != null ? `+${result.stats.avg_win_pct}%` : '—'}
                    color="green"
                  />
                  <StatBox
                    label="Avg Loss"
                    value={result.stats.avg_loss_pct != null ? `${result.stats.avg_loss_pct}%` : '—'}
                    color="red"
                  />
                  <StatBox
                    label="Best Case"
                    value={result.stats.best_case_pct != null ? `+${result.stats.best_case_pct}%` : '—'}
                    color="green"
                  />
                  <StatBox
                    label="Worst Case"
                    value={result.stats.worst_case_pct != null ? `${result.stats.worst_case_pct}%` : '—'}
                    color="red"
                  />
                </div>
              </div>

              {/* Histogram */}
              {result.histogram.length > 0 && (
                <div className="p-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Outcome Distribution</div>
                  <div className="flex flex-col gap-0.5">
                    {result.histogram.map((bin, i) => {
                      const maxCount = Math.max(...result.histogram.map(b => b.count))
                      const pct = maxCount > 0 ? (bin.count / maxCount) * 100 : 0
                      const isWin = bin.lo >= 0
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-20 text-[8px] text-gray-400 text-right shrink-0">{bin.lo > 0 ? '+' : ''}{bin.lo}%</div>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                            <div
                              className={`h-full rounded ${isWin ? 'bg-green-400' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-4 text-[9px] text-gray-400">{bin.count}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Matches list */}
              <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900 shrink-0">
                Instances ({result.matches.length})
              </div>
              <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800 overflow-y-auto">
                {result.matches.map((m, i) => (
                  <div
                    key={i}
                    onClick={() => setSelected(i === selected ? null : i)}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      selected === i ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{m.date}</div>
                      {m.exit_date && (
                        <div className="text-[9px] text-gray-400">→ {m.exit_date}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {m.complete && m.outcome_pct != null ? (
                        <span className={`text-[11px] font-bold ${m.outcome_pct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {m.outcome_pct > 0 ? '+' : ''}{m.outcome_pct}%
                        </span>
                      ) : (
                        <span className="text-[9px] text-gray-400">incomplete</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!result && (
            <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400 text-center px-6">
              {loading ? 'Scanning history…' : 'Scan to see all historical instances of your pattern'}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }) {
  const textColor = color === 'green' ? 'text-green-600 dark:text-green-400'
                  : color === 'red'   ? 'text-red-500 dark:text-red-400'
                  : color === 'amber' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-2">
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-[14px] font-bold ${textColor}`}>{value}</div>
    </div>
  )
}
