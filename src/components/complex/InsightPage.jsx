import { useState, useCallback, useRef, useEffect } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { useTheme } from '../../context/ThemeContext'
import { getMonthlyReturns, getMonthDetail } from '../../api/index'

// ── Color helpers ──────────────────────────────────────────────────────────────

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

function fmt(v) {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%'
}

// ── MonthChart (lightweight-charts candlestick) ────────────────────────────────

function MonthChart({ candles, isDark }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !candles?.length) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor:  isDark ? '#9ca3af' : '#6b7280',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        horzLines:  { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isDark ? '#374151' : '#e5e7eb' },
      timeScale:       { borderColor: isDark ? '#374151' : '#e5e7eb', timeVisible: true },
      handleScroll: false,
      handleScale:  false,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor:       '#22c55e',
      downColor:     '#ef4444',
      borderVisible: false,
      wickUpColor:   '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeries.setData(candles)

    const volSeries = chart.addHistogramSeries({
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
      color:        'rgba(100,116,139,0.4)',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } })
    volSeries.setData(candles.map(c => ({ time: c.time, value: c.volume || 0, color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)' })))

    // High/Low markers
    const maxC = candles.reduce((a, b) => (b.high > a.high ? b : a))
    const minC = candles.reduce((a, b) => (b.low  < a.low  ? b : a))
    candleSeries.setMarkers([
      { time: maxC.time, position: 'aboveBar', color: '#22c55e', shape: 'arrowDown', text: `H ${maxC.high}` },
      { time: minC.time, position: 'belowBar', color: '#ef4444', shape: 'arrowUp',   text: `L ${minC.low}` },
    ].sort((a, b) => a.time.localeCompare(b.time)))

    chart.timeScale().fitContent()
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [candles, isDark])

  return <div ref={containerRef} className="w-full h-full" />
}

// ── YoY SVG line chart ─────────────────────────────────────────────────────────

function YoYChart({ data, isDark }) {
  if (!data?.current_year) return null
  const { current_year, prev_year, months_current, months_prev, avg_by_month } = data
  const W = 380, H = 120, PL = 24, PR = 10, PT = 10, PB = 20

  const allVals = [...(months_current || []), ...(months_prev || []), ...(avg_by_month || [])]
    .filter(v => v != null)
  if (!allVals.length) return null

  const minV = Math.min(...allVals, 0) - 2
  const maxV = Math.max(...allVals, 0) + 2
  const range = maxV - minV || 1

  const xScale = (i) => PL + (i / 11) * (W - PL - PR)
  const yScale = (v) => PT + ((maxV - v) / range) * (H - PT - PB)

  function toPath(arr) {
    const pts = arr.map((v, i) => v != null ? `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}` : null).filter(Boolean)
    return pts.length ? `M ${pts.join(' L ')}` : ''
  }

  const MONTH_SHORT = ['J','F','M','A','M','J','J','A','S','O','N','D']
  const zero = yScale(0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* zero line */}
      <line x1={PL} x2={W - PR} y1={zero} y2={zero}
        stroke={isDark ? '#374151' : '#d1d5db'} strokeDasharray="3,2" strokeWidth={1} />
      {/* avg */}
      {avg_by_month && <path d={toPath(avg_by_month)} fill="none" stroke={isDark ? '#6b7280' : '#9ca3af'} strokeWidth={1.2} strokeDasharray="4,3" />}
      {/* prev year */}
      {months_prev && <path d={toPath(months_prev)} fill="none" stroke={isDark ? '#60a5fa' : '#3b82f6'} strokeWidth={1.4} opacity={0.6} />}
      {/* current year */}
      {months_current && <path d={toPath(months_current)} fill="none" stroke={isDark ? '#34d399' : '#10b981'} strokeWidth={2} />}
      {/* month labels */}
      {MONTH_SHORT.map((m, i) => (
        <text key={m + i} x={xScale(i)} y={H - 4} textAnchor="middle"
          fontSize={8} fill={isDark ? '#6b7280' : '#9ca3af'}>{m}</text>
      ))}
      {/* legend */}
      <circle cx={PL + 2} cy={8} r={3} fill={isDark ? '#34d399' : '#10b981'} />
      <text x={PL + 8} y={11} fontSize={8} fill={isDark ? '#d1d5db' : '#374151'}>{current_year}</text>
      {prev_year && <>
        <circle cx={PL + 50} cy={8} r={3} fill={isDark ? '#60a5fa' : '#3b82f6'} />
        <text x={PL + 56} y={11} fontSize={8} fill={isDark ? '#d1d5db' : '#374151'}>{prev_year}</text>
      </>}
      <line x1={PL + 98} x2={PL + 110} y1={8} y2={8}
        stroke={isDark ? '#6b7280' : '#9ca3af'} strokeDasharray="3,2" strokeWidth={1.2} />
      <text x={PL + 113} y={11} fontSize={8} fill={isDark ? '#6b7280' : '#9ca3af'}>Avg</text>
    </svg>
  )
}

// ── StatRow ────────────────────────────────────────────────────────────────────

function StatRow({ label, value, accent }) {
  const accClass = accent === 'green' ? 'text-green-500' : accent === 'red' ? 'text-red-400' : 'text-gray-900 dark:text-white'
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-[10px] font-semibold ${accClass}`}>{value}</span>
    </div>
  )
}

// ── InsightPanels (right side) ─────────────────────────────────────────────────

function InsightPanels({ data, selectedCell, isDark }) {
  if (!data) return (
    <div className="flex-1 flex items-center justify-center text-[11px] text-gray-400 text-center px-4">
      Click a cell to explore month detail
    </div>
  )

  const { month_averages, month_win_rates, best_years, worst_years, current_streak } = data
  const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // Best / worst month by avg
  const avgArr = month_averages || []
  const bestMonthIdx  = avgArr.indexOf(Math.max(...avgArr.filter(v => v != null)))
  const worstMonthIdx = avgArr.indexOf(Math.min(...avgArr.filter(v => v != null)))

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full text-[10px]">

      {/* Seasonality panel */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Monthly Seasonality (Avg %)
        </div>
        <div className="p-2 grid grid-cols-4 gap-1">
          {(month_averages || []).map((v, i) => (
            <div key={i}
              className={`rounded p-1 text-center ${selectedCell?.month === i + 1 ? 'ring-1 ring-blue-400' : ''}`}
              style={{ background: cellBg(v, isDark) }}>
              <div className="text-[8px] opacity-70">{MONTHS_EN[i]}</div>
              <div className="text-[10px] font-bold" style={{ color: cellText(v, isDark) }}>
                {v != null ? (v > 0 ? '+' : '') + v.toFixed(1) : '—'}
              </div>
            </div>
          ))}
        </div>
        {bestMonthIdx >= 0 && (
          <div className="px-3 pb-2 flex gap-2 text-[9px]">
            <span className="text-green-500">↑ Best: {MONTHS_EN[bestMonthIdx]} ({avgArr[bestMonthIdx] > 0 ? '+' : ''}{avgArr[bestMonthIdx]?.toFixed(1)}%)</span>
            <span className="text-red-400 ml-auto">↓ Worst: {MONTHS_EN[worstMonthIdx]} ({avgArr[worstMonthIdx]?.toFixed(1)}%)</span>
          </div>
        )}
      </div>

      {/* Win-rate panel */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Win Rate by Month
        </div>
        <div className="p-2 flex flex-col gap-0.5">
          {(month_win_rates || []).map((wr, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-6 text-[9px] text-gray-500">{MONTHS_EN[i].slice(0,1)}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${wr || 0}%` }} />
              </div>
              <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 w-7 text-right">{wr != null ? wr + '%' : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Streak */}
      {current_streak && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Current Streak</div>
          <div className={`text-lg font-bold ${current_streak.type === 'up' ? 'text-green-500' : 'text-red-400'}`}>
            {current_streak.type === 'up' ? '▲' : '▼'} {current_streak.count} month{current_streak.count !== 1 ? 's' : ''}
          </div>
          <div className="text-[9px] text-gray-400">{current_streak.type === 'up' ? 'Positive' : 'Negative'} run</div>
        </div>
      )}

      {/* Best / Worst years */}
      {(best_years?.length > 0 || worst_years?.length > 0) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Top Years
          </div>
          <div className="p-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8px] text-green-500 font-bold mb-1">BEST</div>
              {(best_years || []).slice(0, 5).map(y => (
                <div key={y.year} className="flex justify-between text-[9px]">
                  <span className="text-gray-500">{y.year}</span>
                  <span className="text-green-500 font-semibold">+{y.annual?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[8px] text-red-400 font-bold mb-1">WORST</div>
              {(worst_years || []).slice(0, 5).map(y => (
                <div key={y.year} className="flex justify-between text-[9px]">
                  <span className="text-gray-500">{y.year}</span>
                  <span className="text-red-400 font-semibold">{y.annual?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SidePanel (center-right, slides in on cell click) ─────────────────────────

function SidePanel({ cell, onClose, isDark }) {
  const [loading, setLoading]   = useState(false)
  const [candles, setCandles]   = useState(null)
  const [monthData, setMonthData] = useState(null)

  useEffect(() => {
    if (!cell) return
    setLoading(true)
    setCandles(null)
    setMonthData(null)
    getMonthDetail({ year: cell.year, month: cell.month })
      .then(r => {
        setCandles(r.data.candles || [])
        setMonthData(r.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cell?.year, cell?.month])

  // Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!cell) return null

  const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthName = MONTHS_EN[cell.month - 1]
  const bg = cellBg(cell.value, isDark)
  const tx = cellText(cell.value, isDark)

  return (
    <div className="w-[300px] min-w-[260px] flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: bg }} />
          <span className="text-[11px] font-bold text-gray-900 dark:text-white">
            {monthName} {cell.year}
          </span>
          <span className="text-[11px] font-bold" style={{ color: tx }}>
            {fmt(cell.value)}
          </span>
        </div>
        <button onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs">
          ✕
        </button>
      </div>

      {/* Chart */}
      <div className="h-[160px] shrink-0 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        {loading ? (
          <div className="h-full flex items-center justify-center text-[10px] text-gray-400">Loading…</div>
        ) : candles?.length ? (
          <MonthChart candles={candles} isDark={isDark} />
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-gray-400">No chart data</div>
        )}
      </div>

      {/* Stats */}
      {monthData && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {monthData.open != null && (
            <div className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">NEPSE Index</div>
              <StatRow label="Open"   value={monthData.open?.toFixed(2)} />
              <StatRow label="Close"  value={monthData.close?.toFixed(2)} />
              <StatRow label="High"   value={monthData.high?.toFixed(2)} />
              <StatRow label="Low"    value={monthData.low?.toFixed(2)} />
              <StatRow label="Return" value={fmt(cell.value)}
                accent={cell.value >= 0 ? 'green' : 'red'} />
            </div>
          )}
          {monthData.trading_days != null && (
            <div className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Activity</div>
              <StatRow label="Trading Days" value={monthData.trading_days} />
              <StatRow label="Up Days"      value={monthData.up_days} accent="green" />
              <StatRow label="Down Days"    value={monthData.down_days} accent="red" />
            </div>
          )}
          {monthData.avg_month != null && (
            <div className="rounded-md border border-gray-100 dark:border-gray-800 p-2">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Historical ({monthName})</div>
              <StatRow label="Avg Return"  value={fmt(monthData.avg_month)} accent={monthData.avg_month >= 0 ? 'green' : 'red'} />
              <StatRow label="Win Rate"    value={monthData.win_rate_month != null ? monthData.win_rate_month + '%' : '—'} />
              <StatRow label="vs Avg"      value={cell.value != null && monthData.avg_month != null
                ? fmt(cell.value - monthData.avg_month) : '—'}
                accent={cell.value >= monthData.avg_month ? 'green' : 'red'} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main InsightPage ───────────────────────────────────────────────────────────

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_NP = ['Bai','Jes','Asa','Shr','Bha','Asw','Kar','Man','Pou','Mag','Fal','Cha']

export default function InsightPage() {
  const { isDark } = useTheme()
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [data,     setData]     = useState(null)
  const [useNP,    setUseNP]    = useState(false)
  const [selected, setSelected] = useState(null)  // { year, month, value }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await getMonthlyReturns()
      setData(r.data)
    } catch (e) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const MONTH_LABELS = useNP ? MONTHS_NP : MONTHS_EN
  const years = data?.years || []
  const today = new Date()
  const currentYear  = today.getFullYear()
  const currentMonth = today.getMonth() + 1  // 1-indexed

  const handleCellClick = useCallback((year, month, value) => {
    setSelected(prev =>
      prev?.year === year && prev?.month === month ? null : { year, month, value }
    )
  }, [])

  const handleClosePanel = useCallback(() => setSelected(null), [])

  // YoY data for panels
  const yoyData = (() => {
    if (!data?.years?.length) return null
    const latest = data.years[0]
    const prev   = data.years[1]
    const getMonths = (y) => data.years.find(yr => yr.year === y.year)?.months
    const cur = data.years.find(y => y.year === currentYear)
    const prv = data.years.find(y => y.year === currentYear - 1)
    return {
      current_year: cur?.year,
      prev_year:    prv?.year,
      months_current: cur?.months,
      months_prev:    prv?.months,
      avg_by_month:   data.month_averages,
    }
  })()

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 bg-white dark:bg-gray-900">

      {/* ── LEFT: Heatmap table ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
            NEPSE Monthly Returns
          </div>
          <span className="text-[10px] text-gray-400">{data?.latest_data_date ? `Updated ${data.latest_data_date}` : ''}</span>

          <div className="ml-auto flex items-center gap-2">
            {/* EN / NP toggle */}
            <div className="flex items-center rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-[9px] font-bold">
              <button
                onClick={() => setUseNP(false)}
                className={`px-2 py-1 transition-colors ${!useNP ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                EN
              </button>
              <button
                onClick={() => setUseNP(true)}
                className={`px-2 py-1 transition-colors ${useNP ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                NP
              </button>
            </div>

            <button onClick={fetchData}
              className="px-2.5 py-1 text-[9px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              ↻
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {loading && (
            <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">Loading…</div>
          )}
          {error && !loading && (
            <div className="flex items-center justify-center h-32 text-[12px] text-red-400">{error}</div>
          )}
          {!loading && !error && data && (
            <table className="w-full border-collapse text-[10px]" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest w-14">Year</th>
                  {MONTH_LABELS.map((m, i) => (
                    <th key={i} className="px-1 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-10">{m}</th>
                  ))}
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest w-14">Annual</th>
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold text-gray-400 uppercase w-12">Label</th>
                </tr>
              </thead>
              <tbody>
                {years.map(row => (
                  <tr key={row.year} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-0.5 font-bold text-gray-700 dark:text-gray-200 text-[10px]">{row.year}</td>
                    {row.months.map((val, mi) => {
                      const isCurrentCell = row.year === currentYear && (mi + 1) === currentMonth
                      const isSelected    = selected?.year === row.year && selected?.month === (mi + 1)
                      const bg = cellBg(val, isDark)
                      const tx = cellText(val, isDark)
                      return (
                        <td key={mi} className="px-0.5 py-0.5">
                          <div
                            onClick={() => val != null && handleCellClick(row.year, mi + 1, val)}
                            className={`
                              rounded px-1 py-0.5 text-center cursor-pointer select-none transition-transform hover:scale-110
                              ${isCurrentCell ? 'ring-1 ring-blue-400 animate-pulse' : ''}
                              ${isSelected    ? 'ring-2 ring-white shadow-lg scale-110' : ''}
                            `}
                            style={{ background: bg, color: tx, minWidth: 36 }}
                          >
                            {val != null ? (val > 0 ? '+' : '') + val.toFixed(1) : '—'}
                          </div>
                        </td>
                      )
                    })}
                    {/* Annual */}
                    <td className="px-1 py-0.5">
                      <div className="rounded px-1 py-0.5 text-center font-bold"
                        style={{ background: cellBg(row.annual, isDark), color: cellText(row.annual, isDark) }}>
                        {row.annual != null ? (row.annual > 0 ? '+' : '') + row.annual.toFixed(1) : '—'}
                      </div>
                    </td>
                    {/* Label */}
                    <td className="px-1 py-0.5 text-center">
                      {row.label && (
                        <span className={`text-[8px] font-bold rounded px-1.5 py-0.5 ${
                          row.label === 'BULL' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                          row.label === 'BEAR' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {row.label}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Average row */}
                {data.month_averages?.some(v => v != null) && (
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="px-2 py-1 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Avg</td>
                    {(data.month_averages || []).map((v, mi) => (
                      <td key={mi} className="px-0.5 py-0.5">
                        <div className="rounded px-1 py-0.5 text-center text-[9px] font-semibold opacity-80"
                          style={{ background: cellBg(v, isDark), color: cellText(v, isDark), minWidth: 36 }}>
                          {v != null ? (v > 0 ? '+' : '') + v.toFixed(1) : '—'}
                        </div>
                      </td>
                    ))}
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* YoY Chart strip */}
        {yoyData?.months_current && (
          <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-2">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Year-over-Year</div>
            <YoYChart data={yoyData} isDark={isDark} />
          </div>
        )}
      </div>

      {/* ── RIGHT: Insight panels ────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[220px] border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden">
        <InsightPanels data={data} selectedCell={selected} isDark={isDark} />
      </div>

      {/* ── SIDE PANEL (slides in) ────────────────────────────────────────── */}
      {selected && (
        <SidePanel cell={selected} onClose={handleClosePanel} isDark={isDark} />
      )}

    </div>
  )
}
