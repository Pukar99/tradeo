import { useEffect, useRef, useState } from 'react'
import { API } from '../api'
import { useTheme } from '../context/ThemeContext'

const ranges = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: 'All', value: 'all' },
]

// ── Single chart panel — receives pre-fetched data, no internal API call ─────
function NEPSEMiniChart({ data, label, height = 200 }) {
  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)
  const seriesRef         = useRef(null)
  const dataRef           = useRef(data)
  const { isDark }        = useTheme()
  const [tooltip, setTooltip]       = useState(null)
  const [chartReady, setChartReady] = useState(false)

  // Keep dataRef always current without triggering chart reinit
  useEffect(() => { dataRef.current = data }, [data])

  const getThemeOptions = (dark) => ({
    layout: {
      background: { color: dark ? '#111827' : '#f9fafb' },
      textColor:  dark ? '#6b7280' : '#9ca3af',
      fontSize: 10,
    },
    rightPriceScale: { borderColor: dark ? '#1f2937' : '#e5e7eb' },
    timeScale:        { borderColor: dark ? '#1f2937' : '#e5e7eb' },
  })

  const applyData = (d) => {
    if (!d || d.length === 0 || !seriesRef.current || !chartRef.current) return
    seriesRef.current.setData(d)
    const BARS = 15
    const from = d.length > BARS ? d[d.length - BARS].time : d[0].time
    const to   = d[d.length - 1].time
    chartRef.current.timeScale().setVisibleRange({ from, to })
    chartRef.current.timeScale().scrollToPosition(2, false)
  }

  // Init chart once — never destroyed on theme change
  useEffect(() => {
    let cancelled = false

    const initChart = async () => {
      try {
        await new Promise(r => setTimeout(r, 80))
        if (cancelled || !chartContainerRef.current) return

        const { createChart } = await import('lightweight-charts')
        if (cancelled || !chartContainerRef.current) return

        const chart = createChart(chartContainerRef.current, {
          width:  chartContainerRef.current.clientWidth || 400,
          height,
          ...getThemeOptions(isDark),
          grid:         { vertLines: { visible: false }, horzLines: { visible: false } },
          rightPriceScale: { borderColor: isDark ? '#1f2937' : '#e5e7eb', scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale:    { borderColor: isDark ? '#1f2937' : '#e5e7eb', timeVisible: true, fixLeftEdge: false, fixRightEdge: false },
          crosshair:    { mode: 1 },
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
          handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
          watermark:    { visible: false },
        })

        const series = chart.addCandlestickSeries({
          upColor: '#22c55e', downColor: '#ef4444',
          borderUpColor: '#22c55e', borderDownColor: '#ef4444',
          wickUpColor: '#22c55e', wickDownColor: '#ef4444',
          priceLineVisible: false,
        })

        chart.subscribeCrosshairMove(param => {
          if (!param.time) { setTooltip(null); return }
          const d = param.seriesData?.get(series)
          if (!d) return
          setTooltip({ date: param.time, o: d.open, h: d.high, l: d.low, c: d.close })
        })

        const onResize = () => {
          if (chartContainerRef.current && chart)
            chart.applyOptions({ width: chartContainerRef.current.clientWidth || 400 })
        }
        window.addEventListener('resize', onResize)
        chartRef.current  = chart
        seriesRef.current = series

        if (!cancelled) {
          setChartReady(true)
          // Load any data that arrived before chart was ready
          applyData(dataRef.current)
        }

        return () => window.removeEventListener('resize', onResize)
      } catch (err) { console.error('Chart init error:', err) }
    }

    initChart()
    return () => {
      cancelled = true
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; seriesRef.current = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Theme change — update colors only, keep data intact, no refetch
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.applyOptions(getThemeOptions(isDark))
  }, [isDark])

  // Load data when it arrives or updates
  useEffect(() => {
    if (!chartReady) return
    applyData(data)
  }, [chartReady, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const last   = data?.[data.length - 1]
  const prev   = data?.[data.length - 2]
  const change = last && prev ? ((last.close - prev.close) / prev.close * 100).toFixed(2) : null
  const isPos  = parseFloat(change ?? 0) >= 0

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
        {last && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">{last.close.toFixed(2)}</span>
            {change && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isPos ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-500'}`}>
                {isPos ? '+' : ''}{change}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        {(!data || data.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ height }}>
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height }} />

        {tooltip && (
          <div className="absolute top-1.5 left-1.5 bg-gray-900/95 text-white rounded-md px-2 py-1 text-[10px] z-20 pointer-events-none font-mono">
            <span className="text-gray-400 mr-1">{tooltip.date}</span>
            <span className="text-gray-300">O</span> {tooltip.o.toFixed(2)}
            {' '}<span className="text-green-400">H</span> {tooltip.h.toFixed(2)}
            {' '}<span className="text-red-400">L</span> {tooltip.l.toFixed(2)}
            {' '}<span className="text-blue-300">C</span> {tooltip.c.toFixed(2)}
          </div>
        )}

        <style>{`.tv-lightweight-charts a[href*="tradingview"] { display: none !important; }`}</style>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
function NEPSEChart({ fixed = false }) {
  const { isDark } = useTheme()
  const [range, setRange] = useState('1y')
  const [loading, setLoading]           = useState(true)
  const [stats, setStats]               = useState(null)
  const [tooltip, setTooltip]           = useState(null)
  const [hoveredMovers, setHoveredMovers] = useState(null)
  const [chartReady, setChartReady]     = useState(false)
  const [latestDate, setLatestDate]     = useState('')
  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)
  const seriesRef         = useRef(null)
  const moversRef         = useRef({})

  // ── Fixed (dual side-by-side) mode — single fetch, data passed as props ────
  const [dailyData,  setDailyData]  = useState(null)
  const [weeklyData, setWeeklyData] = useState(null)

  useEffect(() => {
    if (!fixed) return
    Promise.all([
      API.get('/api/market/nepse-chart?range=1y'),
      API.get('/api/market/index-chart?index_id=12&timeframe=2Y&aggregate=week'),
    ]).then(([d, w]) => {
      setDailyData(d.data.data)
      setWeeklyData(w.data.data)
    }).catch(() => {})
  }, [fixed])

  if (fixed) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <h3 className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-widest">NEPSE Index</h3>
          <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600">Daily · Weekly</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
          <NEPSEMiniChart data={dailyData}  label="Daily"  height={210} />
          <NEPSEMiniChart data={weeklyData} label="Weekly" height={210} />
        </div>
      </div>
    )
  }

  // ── Normal (single) mode — full chart with range selector ──────────────────
  useEffect(() => {
    let cancelled = false

    const initChart = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (cancelled || !chartContainerRef.current) return

        const { createChart } = await import('lightweight-charts')
        if (cancelled || !chartContainerRef.current) return

        const chart = createChart(chartContainerRef.current, {
          width:  chartContainerRef.current.clientWidth || 800,
          height: 350,
          layout: {
            background: { color: isDark ? '#1f2937' : '#ffffff' },
            textColor:  isDark ? '#d1d5db' : '#374151',
          },
          grid: {
            vertLines: { color: isDark ? '#374151' : '#f3f4f6' },
            horzLines: { color: isDark ? '#374151' : '#f3f4f6' },
          },
          rightPriceScale: { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
          timeScale:        { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
        })

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#22c55e', downColor: '#ef4444',
          borderUpColor: '#22c55e', borderDownColor: '#ef4444',
          wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        })

        chart.subscribeCrosshairMove(param => {
          if (!param.time) { setTooltip(null); setHoveredMovers(null); return }
          const data = param.seriesData?.get(candleSeries)
          if (!data) return
          setTooltip({ date: param.time, open: data.open, high: data.high, low: data.low, close: data.close, change: (((data.close - data.open) / data.open) * 100).toFixed(2) })
          setHoveredMovers(moversRef.current[param.time] || null)
        })

        const handleResize = () => {
          if (chartContainerRef.current && chart)
            chart.applyOptions({ width: chartContainerRef.current.clientWidth || 800 })
        }
        window.addEventListener('resize', handleResize)
        chartRef.current = chart; seriesRef.current = candleSeries
        if (!cancelled) setChartReady(true)
        return () => window.removeEventListener('resize', handleResize)
      } catch (err) { console.error('Chart init error:', err) }
    }

    initChart()
    return () => {
      cancelled = true
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; seriesRef.current = null }
    }
  }, [isDark])

  useEffect(() => {
    if (!chartReady) return
    setLoading(true)
    API.get(`/api/market/nepse-chart?range=${range}`)
      .then(res => {
        const chartData = res.data.data
        moversRef.current = res.data.movers || {}
        if (seriesRef.current) { seriesRef.current.setData(chartData); chartRef.current?.timeScale().fitContent() }
        if (chartData.length > 0) {
          const lastCandle = chartData[chartData.length - 1]
          const prevCandle = chartData[chartData.length - 2]
          const last = lastCandle.close; const first = chartData[0].close
          setLatestDate(lastCandle.time)
          setStats({
            first, last,
            change: prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close * 100).toFixed(2) : '0.00',
            periodChange: ((last - first) / first * 100).toFixed(2),
            high: Math.max(...chartData.map(d => d.high)),
            low:  Math.min(...chartData.map(d => d.low)),
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [range, chartReady])

  const isPositive = parseFloat(stats?.change) >= 0
  const isPeriodPositive = parseFloat(stats?.periodChange) >= 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">NEPSE Index</h2>
            {latestDate && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">Data up to {latestDate}</span>}
          </div>
          {stats && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.last.toFixed(2)}</span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{isPositive ? '+' : ''}{stats.change}% last day</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPeriodPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{isPeriodPositive ? '+' : ''}{stats.periodChange}% ({range.toUpperCase()})</span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {ranges.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${range === r.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="flex gap-4 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">High: <span className="text-green-600 font-medium">{stats.high.toFixed(2)}</span></span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Low: <span className="text-red-500 font-medium">{stats.low.toFixed(2)}</span></span>
        </div>
      )}

      <div className="relative" style={{ minHeight: '350px' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-10" style={{ minHeight: '350px' }}>
            <p className="text-sm text-gray-400">Loading chart...</p>
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }} />

        {tooltip && (
          <div className="absolute top-2 left-2 bg-gray-900 text-white rounded-lg p-2 text-xs z-20 pointer-events-none">
            <p className="font-medium mb-1">{tooltip.date}</p>
            <p>O: <span className="text-gray-300">{tooltip.open}</span></p>
            <p>H: <span className="text-green-400">{tooltip.high}</span></p>
            <p>L: <span className="text-red-400">{tooltip.low}</span></p>
            <p>C: <span className={parseFloat(tooltip.change) >= 0 ? 'text-green-400' : 'text-red-400'}>{tooltip.close}</span></p>
            <p>Chg: <span className={parseFloat(tooltip.change) >= 0 ? 'text-green-400' : 'text-red-400'}>{parseFloat(tooltip.change) >= 0 ? '+' : ''}{tooltip.change}%</span></p>
          </div>
        )}

        {hoveredMovers && (
          <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-xs z-20 pointer-events-none shadow-lg w-64">
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Top Movers — {tooltip?.date}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-green-600 font-medium mb-1">Gainers</p>
                {hoveredMovers.gainers?.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex justify-between gap-1">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{s.s}</span>
                    <span className="text-green-500">+{s.p}%</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-red-500 font-medium mb-1">Losers</p>
                {hoveredMovers.losers?.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex justify-between gap-1">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{s.s}</span>
                    <span className="text-red-500">{s.p}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-gray-400 mt-1 text-center">{hoveredMovers.total} stocks traded</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default NEPSEChart
