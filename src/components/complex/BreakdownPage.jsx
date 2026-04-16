import { useState, useCallback, useRef, useEffect } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { useTheme } from '../../context/ThemeContext'
import {
  getSectorYear, getSectorHistory,
  getStockReturns, getStockMonthDetail,
  getMarketSymbols,
} from '../../api/index'

// ── Color helpers (shared with InsightPage) ────────────────────────────────────

function cellBg(val, isDark) {
  if (val == null) return isDark ? '#1f2937' : '#f3f4f6'
  if (val >= 10)  return isDark ? '#14532d' : '#bbf7d0'
  if (val >= 3)   return isDark ? '#166534' : '#d1fae5'
  if (val >= 0)   return isDark ? '#1a3a2a' : '#f0fdf4'
  if (val >= -3)  return isDark ? '#3b1a1a' : '#fff0f0'
  if (val >= -10) return isDark ? '#7f1d1d' : '#fecaca'
  return isDark ? '#450a0a' : '#fca5a5'
}

function cellText(val, isDark) {
  if (val == null) return isDark ? '#6b7280' : '#9ca3af'
  if (val >= 3)   return isDark ? '#86efac' : '#166534'
  if (val >= 0)   return isDark ? '#4ade80' : '#15803d'
  if (val >= -3)  return isDark ? '#fca5a5' : '#dc2626'
  return isDark ? '#f87171' : '#991b1b'
}

function fmt(v, decimals = 2) {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(decimals) + '%'
}

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Small candlestick chart ────────────────────────────────────────────────────

function MiniChart({ candles, isDark, height = 140 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !candles?.length) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor:  isDark ? '#9ca3af' : '#6b7280',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isDark ? '#374151' : '#e5e7eb' },
      timeScale:       { borderColor: isDark ? '#374151' : '#e5e7eb', timeVisible: true },
      handleScroll: false,
      handleScale:  false,
    })

    const cs = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    cs.setData(candles)
    chart.timeScale().fitContent()
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [candles, isDark, height])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}

// ── StatRow ────────────────────────────────────────────────────────────────────

function StatRow({ label, value, accent }) {
  const cls = accent === 'green' ? 'text-green-500' : accent === 'red' ? 'text-red-400' : 'text-gray-900 dark:text-white'
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-[10px] font-semibold ${cls}`}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB A — SECTORS heatmap
// ─────────────────────────────────────────────────────────────────────────────

// Sector index ID map (matches backend INDEX_LIST)
const SECTOR_OPTIONS = [
  { id: 12, name: 'NEPSE'              },
  { id: 1,  name: 'Banking'            },
  { id: 2,  name: 'Development Bank'   },
  { id: 3,  name: 'Finance'            },
  { id: 9,  name: 'Microfinance'       },
  { id: 11, name: 'Non-Life Insurance' },
  { id: 6,  name: 'Life Insurance'     },
  { id: 15, name: 'Investment'         },
  { id: 4,  name: 'Hotels & Tourism'   },
  { id: 8,  name: 'Manufacturing'      },
  { id: 13, name: 'Others'             },
  { id: 5,  name: 'Hydropower'         },
  { id: 10, name: 'Mutual Fund'        },
  { id: 14, name: 'Trading'            },
  { id: 16, name: 'Sensitive Index'    },
]

function SectorsTab({ isDark }) {
  const currentYear = new Date().getFullYear()
  const [year,       setYear]      = useState(currentYear)
  const [mode,       setMode]      = useState('year')   // 'year' | 'history'
  const [indexId,    setIndexId]   = useState(null)     // for history mode (numeric id)
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState('')
  const [data,       setData]      = useState(null)
  const [selected,   setSelected]  = useState(null)     // { sector, month, year, value }

  const fetchYear = useCallback(async () => {
    setLoading(true)
    setError('')
    setData(null)
    setSelected(null)
    try {
      const r = await getSectorYear({ year })
      setData(r.data)
    } catch {
      setError('Failed to load sector data')
    } finally {
      setLoading(false)
    }
  }, [year])

  const fetchHistory = useCallback(async () => {
    if (!indexId) return
    setLoading(true)
    setError('')
    setData(null)
    setSelected(null)
    try {
      const r = await getSectorHistory({ index_id: indexId })
      setData(r.data)
    } catch {
      setError('Failed to load sector history')
    } finally {
      setLoading(false)
    }
  }, [indexId])

  useEffect(() => {
    if (mode === 'year') fetchYear()
  }, [mode, fetchYear])

  useEffect(() => {
    if (mode === 'history' && indexId) fetchHistory()
  }, [mode, indexId, fetchHistory])

  // Sidebar: detail for selected cell
  const [cellDetail, setCellDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!selected) { setCellDetail(null); return }
    // show basic info immediately
    setCellDetail({ value: selected.value, sector: selected.sector, year: selected.year, month: selected.month })
  }, [selected])

  // ── Year mode: rows = sectors, cols = months ──
  const renderYearTable = () => {
    if (!data?.sectors) return null
    const rows = data.sectors

    return (
      <table className="w-full border-collapse text-[10px]" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase w-28">Sector</th>
            {MONTHS_EN.map((m, i) => (
              <th key={i} className="px-0.5 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-10">{m}</th>
            ))}
            <th className="px-2 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-14">Annual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.index_id || row.name} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-2 py-0.5 text-[9px] font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[112px]"
                title={row.name}>{row.name}</td>
              {row.months.map((val, mi) => {
                const isSel = selected?.sector === row.name && selected?.month === mi + 1
                return (
                  <td key={mi} className="px-0.5 py-0.5">
                    <div
                      onClick={() => val != null && setSelected(prev =>
                        prev?.sector === row.name && prev?.month === mi + 1
                          ? null : { sector: row.name, month: mi + 1, year, value: val }
                      )}
                      className={`rounded px-0.5 py-0.5 text-center cursor-pointer select-none transition-transform hover:scale-110 text-[9px] ${isSel ? 'ring-2 ring-white scale-110 shadow' : ''}`}
                      style={{ background: cellBg(val, isDark), color: cellText(val, isDark), minWidth: 32 }}
                    >
                      {val != null ? (val > 0 ? '+' : '') + val.toFixed(1) : '—'}
                    </div>
                  </td>
                )
              })}
              <td className="px-1 py-0.5">
                <div className="rounded px-0.5 py-0.5 text-center font-bold text-[9px]"
                  style={{ background: cellBg(row.annual, isDark), color: cellText(row.annual, isDark) }}>
                  {row.annual != null ? (row.annual > 0 ? '+' : '') + row.annual.toFixed(1) : '—'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  // ── History mode: rows = years, cols = months, for one sector ──
  const renderHistoryTable = () => {
    if (!data?.years) return null

    return (
      <table className="w-full border-collapse text-[10px]" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase w-12">Year</th>
            {MONTHS_EN.map((m, i) => (
              <th key={i} className="px-0.5 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-10">{m}</th>
            ))}
            <th className="px-2 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-14">Annual</th>
          </tr>
        </thead>
        <tbody>
          {data.years.map(row => (
            <tr key={row.year} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-2 py-0.5 font-bold text-gray-700 dark:text-gray-200 text-[10px]">{row.year}</td>
              {row.months.map((val, mi) => {
                const isSel = selected?.year === row.year && selected?.month === mi + 1
                return (
                  <td key={mi} className="px-0.5 py-0.5">
                    <div
                      onClick={() => val != null && setSelected(prev =>
                        prev?.year === row.year && prev?.month === mi + 1
                          ? null : { sector, month: mi + 1, year: row.year, value: val }
                      )}
                      className={`rounded px-0.5 py-0.5 text-center cursor-pointer select-none transition-transform hover:scale-110 text-[9px] ${isSel ? 'ring-2 ring-white scale-110 shadow' : ''}`}
                      style={{ background: cellBg(val, isDark), color: cellText(val, isDark), minWidth: 32 }}
                    >
                      {val != null ? (val > 0 ? '+' : '') + val.toFixed(1) : '—'}
                    </div>
                  </td>
                )
              })}
              <td className="px-1 py-0.5">
                <div className="rounded px-0.5 py-0.5 text-center font-bold text-[9px]"
                  style={{ background: cellBg(row.annual, isDark), color: cellText(row.annual, isDark) }}>
                  {row.annual != null ? (row.annual > 0 ? '+' : '') + row.annual.toFixed(1) : '—'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
          {/* Mode toggle */}
          <div className="flex items-center rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-[9px] font-bold">
            <button onClick={() => setMode('year')}
              className={`px-2.5 py-1 transition-colors ${mode === 'year' ? 'bg-indigo-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              By Year
            </button>
            <button onClick={() => setMode('history')}
              className={`px-2.5 py-1 transition-colors ${mode === 'history' ? 'bg-indigo-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              By Sector
            </button>
          </div>

          {mode === 'year' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400">Year</span>
              <input type="number" min={2021} max={currentYear} value={year}
                onChange={e => setYear(parseInt(e.target.value))}
                className="w-16 px-1.5 py-0.5 text-[10px] border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white outline-none" />
              <button onClick={fetchYear}
                className="px-2 py-0.5 text-[9px] font-semibold rounded bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                Load
              </button>
            </div>
          )}

          {mode === 'history' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400">Sector</span>
              <select value={indexId || ''} onChange={e => setIndexId(parseInt(e.target.value))}
                className="px-1.5 py-0.5 text-[10px] border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white outline-none">
                <option value="" disabled>Select…</option>
                {SECTOR_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <span className="ml-auto text-[9px] text-gray-400">
            {data?.note || ''}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {loading && <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">Loading…</div>}
          {error   && <div className="flex items-center justify-center h-32 text-[12px] text-red-400">{error}</div>}
          {!loading && !error && mode === 'year'    && renderYearTable()}
          {!loading && !error && mode === 'history' && !indexId && (
            <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">Select a sector to see its history</div>
          )}
          {!loading && !error && mode === 'history' && indexId && renderHistoryTable()}
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <div className="w-[220px] min-w-[200px] border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900 overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div>
              <div className="text-[10px] font-bold text-gray-800 dark:text-white">{selected.sector}</div>
              <div className="text-[9px] text-gray-400">{MONTHS_EN[selected.month - 1]} {selected.year}</div>
            </div>
            <div className="text-[12px] font-bold" style={{ color: cellText(selected.value, isDark) }}>
              {fmt(selected.value)}
            </div>
            <button onClick={() => setSelected(null)}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
              <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Cell Info</div>
              <StatRow label="Sector" value={selected.sector} />
              <StatRow label="Period" value={`${MONTHS_EN[selected.month - 1]} ${selected.year}`} />
              <StatRow label="Return" value={fmt(selected.value)} accent={selected.value >= 0 ? 'green' : 'red'} />
            </div>
            <div className="mt-3 text-[9px] text-gray-400 text-center">
              Sector index data from NEPSE
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB B — STOCKS heatmap
// ─────────────────────────────────────────────────────────────────────────────

function StocksTab({ isDark }) {
  const [symbols,      setSymbols]      = useState([])
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showList,     setShowList]     = useState(false)
  const [symbol,       setSymbol]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [data,         setData]         = useState(null)
  const [selected,     setSelected]     = useState(null)    // { year, month, value }
  const [panel,        setPanel]        = useState(null)    // detail data
  const [panelLoading, setPanelLoading] = useState(false)

  // Load symbols
  useEffect(() => {
    getMarketSymbols()
      .then(r => setSymbols((r.data.stocks || []).map(s => s.symbol)))
      .catch(() => {})
  }, [])

  const filteredSymbols = symbols
    .filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase()))
    .slice(0, 60)

  const fetchStock = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError('')
    setData(null)
    setSelected(null)
    setPanel(null)
    try {
      const r = await getStockReturns({ symbol })
      setData(r.data)
    } catch {
      setError('Failed to load stock data')
    } finally {
      setLoading(false)
    }
  }, [symbol])

  // Load panel on cell click
  useEffect(() => {
    if (!selected) { setPanel(null); return }
    setPanelLoading(true)
    getStockMonthDetail({ symbol, year: selected.year, month: selected.month })
      .then(r => setPanel(r.data))
      .catch(() => setPanel(null))
      .finally(() => setPanelLoading(false))
  }, [selected?.year, selected?.month, symbol])

  // Escape to close panel
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const years = data?.years || []

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
          {/* Symbol picker */}
          <div className="relative">
            <div onClick={() => setShowList(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer text-[11px] min-w-[120px]">
              <span className={symbol ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400'}>
                {symbol || 'Select stock'}
              </span>
              <svg className="ml-auto w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showList && (
              <div className="absolute z-50 top-full left-0 mt-0.5 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                <input autoFocus value={symbolSearch} onChange={e => setSymbolSearch(e.target.value)}
                  placeholder="Search symbol…"
                  className="w-full px-2 py-1.5 text-[11px] border-b border-gray-100 dark:border-gray-700 bg-transparent outline-none dark:text-white" />
                <div className="max-h-48 overflow-y-auto">
                  {filteredSymbols.map(s => (
                    <div key={s}
                      onClick={() => { setSymbol(s); setShowList(false); setSymbolSearch('') }}
                      className="px-2 py-1 text-[11px] hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-gray-800 dark:text-gray-200 font-semibold">
                      {s}
                    </div>
                  ))}
                  {filteredSymbols.length === 0 && <div className="px-2 py-2 text-[11px] text-gray-400">No results</div>}
                </div>
              </div>
            )}
          </div>

          <button onClick={fetchStock} disabled={!symbol || loading}
            className="px-3 py-1 text-[10px] font-bold rounded-md bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white transition-colors">
            {loading ? 'Loading…' : 'Load'}
          </button>

          {data && (
            <span className="ml-auto text-[9px] text-gray-400">
              {data.years?.length || 0} years of data · Updated {data.latest_date || ''}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {loading && <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">Loading…</div>}
          {error   && <div className="flex items-center justify-center h-32 text-[12px] text-red-400">{error}</div>}
          {!loading && !error && !symbol && (
            <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">Select a stock to view its monthly return heatmap</div>
          )}
          {!loading && !error && symbol && !data && !error && (
            <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">Click Load to fetch data</div>
          )}
          {!loading && data && (
            <table className="w-full border-collapse text-[10px]" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase w-12">Year</th>
                  {MONTHS_EN.map((m, i) => (
                    <th key={i} className="px-0.5 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-10">{m}</th>
                  ))}
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-14">Annual</th>
                </tr>
              </thead>
              <tbody>
                {years.map(row => (
                  <tr key={row.year} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-0.5 font-bold text-gray-700 dark:text-gray-200 text-[10px]">{row.year}</td>
                    {row.months.map((val, mi) => {
                      const isSel = selected?.year === row.year && selected?.month === mi + 1
                      const isNow = row.year === new Date().getFullYear() && (mi + 1) === new Date().getMonth() + 1
                      return (
                        <td key={mi} className="px-0.5 py-0.5">
                          <div
                            onClick={() => val != null && setSelected(prev =>
                              prev?.year === row.year && prev?.month === mi + 1
                                ? null : { year: row.year, month: mi + 1, value: val }
                            )}
                            className={`rounded px-0.5 py-0.5 text-center cursor-pointer select-none transition-transform hover:scale-110 text-[9px]
                              ${isNow  ? 'ring-1 ring-blue-400 animate-pulse' : ''}
                              ${isSel ? 'ring-2 ring-white scale-110 shadow-lg' : ''}`}
                            style={{ background: cellBg(val, isDark), color: cellText(val, isDark), minWidth: 32 }}
                          >
                            {val != null ? (val > 0 ? '+' : '') + val.toFixed(1) : '—'}
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-1 py-0.5">
                      <div className="rounded px-0.5 py-0.5 text-center font-bold text-[9px]"
                        style={{ background: cellBg(row.annual, isDark), color: cellText(row.annual, isDark) }}>
                        {row.annual != null ? (row.annual > 0 ? '+' : '') + row.annual.toFixed(1) : '—'}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Avg row */}
                {data.month_averages?.some(v => v != null) && (
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase">Avg</td>
                    {data.month_averages.map((v, mi) => (
                      <td key={mi} className="px-0.5 py-0.5">
                        <div className="rounded px-0.5 py-0.5 text-center text-[9px] font-semibold opacity-80"
                          style={{ background: cellBg(v, isDark), color: cellText(v, isDark), minWidth: 32 }}>
                          {v != null ? (v > 0 ? '+' : '') + v.toFixed(1) : '—'}
                        </div>
                      </td>
                    ))}
                    <td colSpan={1} />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <div className="w-[260px] min-w-[240px] border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900 overflow-hidden shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div>
              <span className="text-[11px] font-bold text-gray-800 dark:text-white">{symbol}</span>
              <span className="text-[9px] text-gray-400 ml-2">{MONTHS_EN[selected.month - 1]} {selected.year}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold" style={{ color: cellText(selected.value, isDark) }}>
                {fmt(selected.value)}
              </span>
              <button onClick={() => setSelected(null)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs">
                ✕
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[140px] border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-950">
            {panelLoading ? (
              <div className="h-full flex items-center justify-center text-[10px] text-gray-400">Loading…</div>
            ) : panel?.candles?.length ? (
              <MiniChart candles={panel.candles} isDark={isDark} height={140} />
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-gray-400">No chart data</div>
            )}
          </div>

          {/* Stats */}
          {panel?.stats && (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {panel.stats.month_open != null && (
                <div className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">{symbol} Price</div>
                  <StatRow label="Open"         value={panel.stats.month_open?.toFixed(2)} />
                  <StatRow label="Close"        value={panel.stats.month_close?.toFixed(2)} />
                  <StatRow label="High"         value={panel.stats.month_high?.toFixed(2)} />
                  <StatRow label="Low"          value={panel.stats.month_low?.toFixed(2)} />
                  <StatRow label="Return"       value={fmt(selected.value)} accent={selected.value >= 0 ? 'green' : 'red'} />
                  <StatRow label="Trading Days" value={panel.stats.trading_days} />
                </div>
              )}

              {panel.stats.nepse_return != null && (
                <div className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">vs NEPSE</div>
                  <StatRow label="NEPSE return"      value={fmt(panel.stats.nepse_return)} accent={panel.stats.nepse_return >= 0 ? 'green' : 'red'} />
                  <StatRow label="Relative Strength" value={fmt(panel.stats.relative_strength)} accent={(panel.stats.relative_strength || 0) >= 0 ? 'green' : 'red'} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main BreakdownPage
// ─────────────────────────────────────────────────────────────────────────────

export default function BreakdownPage() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState('sectors')  // 'sectors' | 'stocks'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-900">

      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 px-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {[
          { id: 'sectors', label: 'Sectors' },
          { id: 'stocks',  label: 'Stocks' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {tab === 'sectors' && <SectorsTab isDark={isDark} />}
        {tab === 'stocks'  && <StocksTab  isDark={isDark} />}
      </div>
    </div>
  )
}
