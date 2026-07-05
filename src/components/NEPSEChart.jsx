// =============================================================================
// NEPSEChart.jsx — NEPSE index candlestick chart
// =============================================================================
// Sections:
//   1. NEPSEMiniChart — single panel, pre-fetched data, no internal API call
//   2. NEPSEChart     — full chart with range selector; fixed=true = dual daily/weekly panels
// =============================================================================

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { getNepseChart as _getNepseChartCached, getNepseWeeklyChart } from '../utils/globalCache'
import { useTheme } from '../context/ThemeContext'
import { useLightweightChart } from '../hooks/useLightweightChart'
import { candleSeriesOptions } from '../utils/chartTheme'

const ranges = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: 'All', value: 'all' },
]

// =============================================================================
// 1. NEPSE MINI CHART
// =============================================================================

const NEPSEMiniChart = memo(function NEPSEMiniChart({
  data,
  label,
  height = 200,
  onCrosshairMove,
  syncTime,
  onRangeChange,
  syncRange,
}) {
  const chartContainerRef = useRef(null)
  const seriesRef = useRef(null)
  const dataRef = useRef(data)
  const { isDark } = useTheme()
  const [hovered, setHovered] = useState(null) // { date, o, h, l, c } from crosshair

  // Keep dataRef always current without triggering chart reinit
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const getThemeOptions = (dark) => ({
    layout: {
      background: { color: dark ? 'rgba(17,24,39,0)' : 'rgba(255,255,255,0)' },
      textColor: dark ? '#6b7280' : '#9ca3af',
      fontSize: 10,
    },
    rightPriceScale: { borderColor: dark ? '#1f2937' : '#e5e7eb' },
    timeScale: { borderColor: dark ? '#1f2937' : '#e5e7eb' },
  })

  // Init chart once — never destroyed on theme change (theme effect below updates colors)
  const { chartRef, ready: chartReady } = useLightweightChart({
    containerRef: chartContainerRef,
    delayMs: 80,
    fallbackWidth: 400,
    buildOptions: () => ({
      height,
      ...getThemeOptions(isDark),
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: {
        borderColor: isDark ? '#1f2937' : '#e5e7eb',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: isDark ? '#1f2937' : '#e5e7eb',
        timeVisible: true,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: { mode: 1 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      watermark: { visible: false },
    }),
    setup: (chart) => {
      const series = chart.addCandlestickSeries(
        candleSeriesOptions(undefined, undefined, { priceLineVisible: false })
      )

      chart.subscribeCrosshairMove((param) => {
        if (!param.time) {
          setHovered(null)
          onCrosshairMove?.(null)
          return
        }
        const d = param.seriesData?.get(series)
        if (!d) return
        setHovered({ date: param.time, o: d.open, h: d.high, l: d.low, c: d.close })
        onCrosshairMove?.(param.time)
      })

      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) onRangeChange?.(range)
      })

      seriesRef.current = series
      return () => {
        seriesRef.current = null
      }
    },
  })

  const applyData = (d) => {
    if (!d || d.length === 0 || !seriesRef.current || !chartRef.current) return
    seriesRef.current.setData(d)
    const BARS = 28
    const from = d.length > BARS ? d[d.length - BARS].time : d[0].time
    const to = d[d.length - 1].time
    chartRef.current.timeScale().setVisibleRange({ from, to })
    chartRef.current.timeScale().scrollToPosition(2, false)
  }

  // Theme change — update colors only, keep data intact, no refetch
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.applyOptions(getThemeOptions(isDark))
  }, [isDark, chartRef]) // chartRef is a stable ref from useLightweightChart

  // Load data when it arrives or updates
  useEffect(() => {
    if (!chartReady) return
    applyData(data)
  }, [chartReady, data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync crosshair from sibling chart
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return
    if (syncTime == null) {
      chartRef.current.clearCrosshairPosition()
    } else {
      chartRef.current.setCrosshairPosition(0, syncTime, seriesRef.current)
    }
  }, [syncTime, chartRef])

  // Sync visible time range from sibling chart — guard null values and empty data
  useEffect(() => {
    if (!chartRef.current || !syncRange) return
    if (!syncRange.from || !syncRange.to) return
    if (!dataRef.current || dataRef.current.length === 0) return
    try {
      chartRef.current.timeScale().setVisibleRange(syncRange)
    } catch (_) {}
  }, [syncRange, chartRef])

  const last = data?.[data.length - 1]
  const prev = data?.[data.length - 2]
  const change = last && prev ? (((last.close - prev.close) / prev.close) * 100).toFixed(2) : null
  const isPos = parseFloat(change ?? 0) >= 0

  // What to show in the header: crosshair data if hovering, else last candle
  const display =
    hovered ??
    (last ? { date: last.time, o: last.open, h: last.high, l: last.low, c: last.close } : null)
  const displayChange = hovered
    ? (() => {
        // For hovered candle, % change = (close - open) / open
        const pct = display ? (((display.c - display.o) / display.o) * 100).toFixed(2) : null
        return pct
      })()
    : change
  const displayIsPos = parseFloat(displayChange ?? 0) >= 0

  return (
    <div className="flex flex-col">
      {/* Header: label + OHLC in one line — crosshair updates live, falls back to last bar */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5 min-w-0">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest shrink-0">
          {label}
        </span>
        {display && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
            {/* Date — only show on hover */}
            {hovered && (
              <span className="text-[9px] text-gray-400 tabular-nums shrink-0">{hovered.date}</span>
            )}
            {/* O H L in muted small */}
            <span className="text-[9px] text-gray-400 tabular-nums whitespace-nowrap">
              O
              <span className="text-gray-500 dark:text-gray-400 ml-0.5">
                {display.o.toFixed(0)}
              </span>{' '}
              H
              <span className="text-gray-500 dark:text-gray-400 ml-0.5">
                {display.h.toFixed(0)}
              </span>{' '}
              L
              <span className="text-gray-500 dark:text-gray-400 ml-0.5">
                {display.l.toFixed(0)}
              </span>
            </span>
            {/* C highlighted */}
            <span
              className={`text-[10px] font-bold tabular-nums ${displayIsPos ? 'text-green-500' : 'text-red-500'}`}
            >
              {display.c.toFixed(2)}
            </span>
            {/* % change pill */}
            {displayChange && (
              <span
                className={`text-[9px] font-semibold px-1 py-0.5 rounded-full tabular-nums ${displayIsPos ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-500'}`}
              >
                {displayIsPos ? '+' : ''}
                {displayChange}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        {(!data || data.length === 0) && (
          <div
            className="absolute inset-0 z-10 flex flex-col justify-center px-4 py-4 space-y-2 animate-pulse bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm"
            style={{ height }}
          >
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full" />
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height }} />
        <style>{`.tv-lightweight-charts a[href*="tradingview"] { display: none !important; }`}</style>
      </div>
    </div>
  )
})

// =============================================================================
// 2. NEPSE CHART
// =============================================================================

function NEPSEChart({ fixed = false }) {
  const { isDark } = useTheme()
  const [range, setRange] = useState('1y')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [hoveredMovers, setHoveredMovers] = useState(null)
  const [latestDate, setLatestDate] = useState('')
  const chartContainerRef = useRef(null)
  const seriesRef = useRef(null)
  const moversRef = useRef({})

  // Normal (single) mode chart — enabled:false in fixed mode (container never rendered).
  // Hook lives BEFORE the fixed-mode early return so hooks stay unconditional.
  const { chartRef, ready: chartReady } = useLightweightChart({
    containerRef: chartContainerRef,
    delayMs: 100,
    fallbackWidth: 800,
    enabled: !fixed,
    buildOptions: () => ({
      height: 350,
      layout: {
        background: { color: isDark ? '#111827' : '#ffffff' },
        textColor: isDark ? '#d1d5db' : '#374151',
      },
      grid: {
        vertLines: { color: 'transparent' },
        horzLines: { color: 'transparent' },
      },
      rightPriceScale: { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
      timeScale: { borderColor: isDark ? '#4b5563' : '#e5e7eb' },
    }),
    setup: (chart) => {
      const candleSeries = chart.addCandlestickSeries(candleSeriesOptions())

      chart.subscribeCrosshairMove((param) => {
        if (!param.time) {
          setTooltip(null)
          setHoveredMovers(null)
          return
        }
        const data = param.seriesData?.get(candleSeries)
        if (!data) return
        setTooltip({
          date: param.time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          change: (((data.close - data.open) / data.open) * 100).toFixed(2),
        })
        setHoveredMovers(moversRef.current[param.time] || null)
      })

      seriesRef.current = candleSeries
      return () => {
        seriesRef.current = null
      }
    },
  })

  // Fixed mode — daily + weekly side-by-side, auto-loads on mount, crosshair synced
  const [dailyData, setDailyData] = useState(null)
  const [weeklyData, setWeeklyData] = useState(null)
  const [dailySync, setDailySync] = useState(null)
  const [weeklySync, setWeeklySync] = useState(null)
  const [dailyRange, setDailyRange] = useState(null)
  const [weeklyRange, setWeeklyRange] = useState(null)
  const rangeSyncLockRef = useRef(false)

  useEffect(() => {
    if (!fixed) return
    _getNepseChartCached('1y')
      .then((res) => setDailyData(res.data.data))
      .catch(() => {})
    getNepseWeeklyChart()
      .then((res) => setWeeklyData(res.data.data))
      .catch(() => {})
  }, [fixed])

  // Mobile view tab: 'daily' | 'weekly'
  const [mobileTab, setMobileTab] = useState('daily')

  const handleMobileTabSwitch = (tab) => {
    // Clear stale range so the newly-mounted chart doesn't receive an invalid syncRange
    setDailyRange(null)
    setWeeklyRange(null)
    setMobileTab(tab)
  }

  // Stable identities so the memoized NEPSEMiniChart children don't re-render on
  // every crosshair/range sync state change. Refs + setState are stable → [] deps.
  const handleDailyRange = useCallback((r) => {
    if (rangeSyncLockRef.current) return
    rangeSyncLockRef.current = true
    setWeeklyRange(r)
    setTimeout(() => {
      rangeSyncLockRef.current = false
    }, 50)
  }, [])
  const handleWeeklyRange = useCallback((r) => {
    if (rangeSyncLockRef.current) return
    rangeSyncLockRef.current = true
    setDailyRange(r)
    setTimeout(() => {
      rangeSyncLockRef.current = false
    }, 50)
  }, [])

  if (fixed) {
    return (
      <div className="hp-card bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm overflow-hidden">
        {/* Mobile toggle — D / W pill, hidden on desktop */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0 lg:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            NEPSE
          </span>
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {[
              { id: 'daily', label: 'Daily' },
              { id: 'weekly', label: 'Weekly' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => handleMobileTabSwitch(t.id)}
                aria-pressed={mobileTab === t.id}
                aria-label={`Show ${t.label} NEPSE chart`}
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  mobileTab === t.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: side-by-side; Mobile: single panel based on tab */}
        <div className="hidden lg:grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
          <NEPSEMiniChart
            data={dailyData}
            label="Daily"
            height={200}
            onCrosshairMove={setWeeklySync}
            syncTime={dailySync}
            onRangeChange={handleDailyRange}
            syncRange={dailyRange}
          />
          <NEPSEMiniChart
            data={weeklyData}
            label="Weekly"
            height={200}
            onCrosshairMove={setDailySync}
            syncTime={weeklySync}
            onRangeChange={handleWeeklyRange}
            syncRange={weeklyRange}
          />
        </div>
        <div className="lg:hidden">
          {mobileTab === 'daily' ? (
            <NEPSEMiniChart
              data={dailyData}
              label="Daily"
              height={180}
              onCrosshairMove={setWeeklySync}
              syncTime={dailySync}
              onRangeChange={handleDailyRange}
              syncRange={dailyRange}
            />
          ) : (
            <NEPSEMiniChart
              data={weeklyData}
              label="Weekly"
              height={180}
              onCrosshairMove={setDailySync}
              syncTime={weeklySync}
              onRangeChange={handleWeeklyRange}
              syncRange={weeklyRange}
            />
          )}
        </div>
      </div>
    )
  }

  // Normal (single) mode — data load per range (chart itself is created by the
  // useLightweightChart call above, which runs unconditionally with enabled=!fixed)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!chartReady) return
    setLoading(true)
    _getNepseChartCached(range)
      .then((res) => {
        const chartData = res.data.data
        moversRef.current = res.data.movers || {}
        if (seriesRef.current) {
          seriesRef.current.setData(chartData)
          chartRef.current?.timeScale().fitContent()
        }
        if (chartData.length > 0) {
          const lastCandle = chartData[chartData.length - 1]
          const prevCandle = chartData[chartData.length - 2]
          const last = lastCandle.close
          const first = chartData[0].close
          setLatestDate(lastCandle.time)
          setStats({
            first,
            last,
            change: prevCandle
              ? (((lastCandle.close - prevCandle.close) / prevCandle.close) * 100).toFixed(2)
              : '0.00',
            periodChange: (((last - first) / first) * 100).toFixed(2),
            high: Math.max(...chartData.map((d) => d.high)),
            low: Math.min(...chartData.map((d) => d.low)),
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [range, chartReady, chartRef])

  const isPositive = parseFloat(stats?.change) >= 0
  const isPeriodPositive = parseFloat(stats?.periodChange) >= 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">NEPSE Index</h2>
            {latestDate && (
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                Data up to {latestDate}
              </span>
            )}
          </div>
          {stats && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.last.toFixed(2)}
              </span>
              <span
                className={`text-sm font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}
              >
                {isPositive ? '+' : ''}
                {stats.change}% last day
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPeriodPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}
              >
                {isPeriodPositive ? '+' : ''}
                {stats.periodChange}% ({range.toUpperCase()})
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              aria-label={`Show ${r.label} range`}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${range === r.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="flex gap-4 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            High: <span className="text-green-600 font-medium">{stats.high.toFixed(2)}</span>
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Low: <span className="text-red-500 font-medium">{stats.low.toFixed(2)}</span>
          </span>
        </div>
      )}

      <div className="relative" style={{ minHeight: '350px' }}>
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-10"
            style={{ minHeight: '350px' }}
          >
            <p className="text-sm text-gray-400">Loading chart...</p>
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }} />

        {tooltip && (
          <div className="absolute top-2 left-2 bg-gray-900 text-white rounded-lg p-2 text-xs z-20 pointer-events-none">
            <p className="font-medium mb-1">{tooltip.date}</p>
            <p>
              O: <span className="text-gray-300">{tooltip.open}</span>
            </p>
            <p>
              H: <span className="text-green-400">{tooltip.high}</span>
            </p>
            <p>
              L: <span className="text-red-400">{tooltip.low}</span>
            </p>
            <p>
              C:{' '}
              <span className={parseFloat(tooltip.change) >= 0 ? 'text-green-400' : 'text-red-400'}>
                {tooltip.close}
              </span>
            </p>
            <p>
              Chg:{' '}
              <span className={parseFloat(tooltip.change) >= 0 ? 'text-green-400' : 'text-red-400'}>
                {parseFloat(tooltip.change) >= 0 ? '+' : ''}
                {tooltip.change}%
              </span>
            </p>
          </div>
        )}

        {hoveredMovers && (
          <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-xs z-20 pointer-events-none shadow-lg w-64">
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Top Movers — {tooltip?.date}
            </p>
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
