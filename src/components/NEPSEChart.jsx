import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const ranges = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: 'All', value: 'all' },
]

function NEPSEChart() {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const moversRef = useRef({})
  const [range, setRange] = useState('1y')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [hoveredMovers, setHoveredMovers] = useState(null)
  const [chartReady, setChartReady] = useState(false)
  const [latestDate, setLatestDate] = useState('')

  useEffect(() => {
    let cancelled = false

    const initChart = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (cancelled || !chartContainerRef.current) return

        const LW = await import('lightweight-charts')
        const { createChart } = LW

        if (cancelled || !chartContainerRef.current) return

        const width = chartContainerRef.current.clientWidth || 800

        const chart = createChart(chartContainerRef.current, {
          width: width,
          height: 350,
          layout: {
            background: { color: '#ffffff' },
            textColor: '#374151',
          },
          grid: {
            vertLines: { color: '#f3f4f6' },
            horzLines: { color: '#f3f4f6' },
          },
          rightPriceScale: { borderColor: '#e5e7eb' },
          timeScale: { borderColor: '#e5e7eb' },
        })

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        })

        chart.subscribeCrosshairMove((param) => {
          if (!param.time) {
            setTooltip(null)
            setHoveredMovers(null)
            return
          }
          const data = param.seriesData?.get(candleSeries)
          if (!data) return
          const dateStr = param.time
          setTooltip({
            date: dateStr,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            change: (((data.close - data.open) / data.open) * 100).toFixed(2)
          })
          setHoveredMovers(moversRef.current[dateStr] || null)
        })

        const handleResize = () => {
          if (chartContainerRef.current && chart) {
            chart.applyOptions({
              width: chartContainerRef.current.clientWidth || 800
            })
          }
        }
        window.addEventListener('resize', handleResize)

        chartRef.current = chart
        seriesRef.current = candleSeries

        if (!cancelled) setChartReady(true)

        return () => window.removeEventListener('resize', handleResize)

      } catch (err) {
        console.error('Chart init error:', err)
      }
    }

    initChart()

    return () => {
      cancelled = true
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!chartReady) return
    setLoading(true)

    axios.get(`http://localhost:5000/api/market/nepse-chart?range=${range}`)
      .then(res => {
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

          const dailyChange = prevCandle
            ? ((lastCandle.close - prevCandle.close) / prevCandle.close * 100).toFixed(2)
            : '0.00'

          const periodChange = ((last - first) / first * 100).toFixed(2)
          const high = Math.max(...chartData.map(d => d.high))
          const low = Math.min(...chartData.map(d => d.low))

          setStats({
            first,
            last,
            change: dailyChange,
            periodChange,
            high,
            low
          })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Fetch error:', err)
        setLoading(false)
      })
  }, [range, chartReady])

  const isPositive = parseFloat(stats?.change) >= 0
  const isPeriodPositive = parseFloat(stats?.periodChange) >= 0

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              NEPSE Index
            </h2>
            {latestDate && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Data up to {latestDate}
              </span>
            )}
          </div>
          {stats && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-2xl font-bold text-gray-900">
                {stats.last.toFixed(2)}
              </span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                isPositive
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-500'
              }`}>
                {isPositive ? '+' : ''}{stats.change}% last day
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isPeriodPositive
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-500'
            }`}>
              {isPeriodPositive ? '+' : ''}{stats.periodChange}% ({range.toUpperCase()})
            </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                range === r.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="flex gap-4 mb-2">
          <span className="text-xs text-gray-500">
            High: <span className="text-green-600 font-medium">
              {stats.high.toFixed(2)}
            </span>
          </span>
          <span className="text-xs text-gray-500">
            Low: <span className="text-red-500 font-medium">
              {stats.low.toFixed(2)}
            </span>
          </span>
        </div>
      )}

      <div className="relative" style={{ minHeight: '350px' }}>
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-white z-10"
            style={{ minHeight: '350px' }}
          >
            <p className="text-sm text-gray-400">Loading chart...</p>
          </div>
        )}

        <div
          ref={chartContainerRef}
          style={{ width: '100%', height: '350px' }}
        />

        {tooltip && (
          <div className="absolute top-2 left-2 bg-gray-900 text-white rounded-lg p-2 text-xs z-20 pointer-events-none">
            <p className="font-medium mb-1">{tooltip.date}</p>
            <p>O: <span className="text-gray-300">{tooltip.open}</span></p>
            <p>H: <span className="text-green-400">{tooltip.high}</span></p>
            <p>L: <span className="text-red-400">{tooltip.low}</span></p>
            <p>C: <span className={
              parseFloat(tooltip.change) >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }>{tooltip.close}</span></p>
            <p>Chg: <span className={
              parseFloat(tooltip.change) >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }>
              {parseFloat(tooltip.change) >= 0 ? '+' : ''}{tooltip.change}%
            </span></p>
          </div>
        )}

        {hoveredMovers && (
          <div className="absolute top-2 right-2 bg-white border border-gray-200 rounded-lg p-3 text-xs z-20 pointer-events-none shadow-lg w-64">
            <p className="font-semibold text-gray-700 mb-2">
              Top Movers — {tooltip?.date}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-green-600 font-medium mb-1">Gainers</p>
                {hoveredMovers.gainers?.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex justify-between gap-1">
                    <span className="text-gray-700 font-medium">{s.s}</span>
                    <span className="text-green-500">+{s.p}%</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-red-500 font-medium mb-1">Losers</p>
                {hoveredMovers.losers?.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex justify-between gap-1">
                    <span className="text-gray-700 font-medium">{s.s}</span>
                    <span className="text-red-500">{s.p}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-gray-400 mt-1 text-center">
              {hoveredMovers.total} stocks traded
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default NEPSEChart