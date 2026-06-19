import { useEffect, useRef, useState } from 'react'
import { getStockChart } from '../../api'

// Timeframe pills shown on a chat chart card (subset of the endpoint's supported set).
const TIMEFRAMES = ['1M', '3M', '6M', '1Y', 'ALL']

// Renders a candlestick chart inside a chat bubble from a card envelope:
//   card.data = { symbol, timeframe, candles:[{time,open,high,low,close}] }
// Reuses lightweight-charts (dynamic import, like NEPSEChart) + the existing getStockChart endpoint
// for timeframe re-requests. Does NOT import StockChart.jsx / useScreen (keeps chat decoupled).
export default function ChartCard({ card }) {
  const { symbol } = card.data
  const initialTf = card.data.timeframe || '1Y'
  const [timeframe, setTimeframe] = useState(initialTf)
  const [candles, setCandles] = useState(card.data.candles || [])
  const [loading, setLoading] = useState(false)
  const elRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)

  // Re-request candles when the user taps a different timeframe pill (read-only; no Groq).
  useEffect(() => {
    if (timeframe === initialTf) return // initial data already provided in the card
    let alive = true
    setLoading(true)
    getStockChart({ symbol, timeframe })
      .then((res) => { if (alive) setCandles(res?.data?.data || []) })
      .catch(() => { if (alive) setCandles([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [timeframe, symbol, initialTf])

  // Draw / redraw the candlestick chart. Dynamic import mirrors NEPSEChart (avoids SSR/test issues).
  useEffect(() => {
    if (!elRef.current || !candles.length) return
    let disposed = false
    let chart
    ;(async () => {
      const { createChart } = await import('lightweight-charts')
      if (disposed || !elRef.current) return
      chart = createChart(elRef.current, {
        height: 220,
        layout: { background: { color: 'transparent' }, textColor: '#9ca3af' },
        grid: { vertLines: { visible: false }, horzLines: { color: '#1f293720' } },
        rightPriceScale: { borderColor: '#e5e7eb' },
        timeScale: { borderColor: '#e5e7eb', timeVisible: false },
      })
      const series = chart.addCandlestickSeries({
        upColor: '#16a34a', downColor: '#dc2626',
        borderUpColor: '#16a34a', borderDownColor: '#dc2626',
        wickUpColor: '#16a34a', wickDownColor: '#dc2626',
      })
      series.setData(candles)
      chart.timeScale().fitContent()
      chartRef.current = chart
      seriesRef.current = series
    })()
    return () => { disposed = true; if (chart) chart.remove(); chartRef.current = null; seriesRef.current = null }
  }, [candles])

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{card.title || symbol}</span>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 text-[11px] rounded ${tf === timeframe ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      {candles.length ? (
        <div ref={elRef} className="w-full" style={{ minHeight: 220 }} />
      ) : (
        <div className="text-xs text-gray-400 py-8 text-center">
          {loading ? 'Loading…' : `No chart data for ${symbol}`}
        </div>
      )}
    </div>
  )
}
