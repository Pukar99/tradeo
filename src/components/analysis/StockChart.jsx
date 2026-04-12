import { useEffect, useRef, useState, useContext } from 'react'
import { ThemeContext } from '../../context/ThemeContext'
import { useAnalysis } from '../../context/AnalysisContext'
import { getIndexChart, getStockChart } from '../../api'

// ── Client-side indicator calculations ───────────────────────────────────────

function calcMA(data, period = 20) {
  return data.map((d, i) => {
    if (i < period - 1) return null
    const avg = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period
    return { time: d.time, value: parseFloat(avg.toFixed(2)) }
  }).filter(Boolean)
}

function calcRSI(data, period = 14) {
  if (data.length < period + 1) return []
  const results = []
  let gains = 0, losses = 0

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close
    if (diff >= 0) gains += diff; else losses -= diff
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const diff = data[i].close - data[i - 1].close
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
    }
    const rs  = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi = parseFloat((100 - 100 / (1 + rs)).toFixed(2))
    results.push({ time: data[i].time, value: rsi })
  }
  return results
}

function calcMACD(data, fast = 12, slow = 26, signal = 9) {
  if (data.length < slow + signal) return { macd: [], signal: [], hist: [] }

  function ema(arr, period) {
    const k   = 2 / (period + 1)
    const out = [arr[0]]
    for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k))
    return out
  }

  const closes   = data.map(d => d.close)
  const emaFast  = ema(closes, fast)
  const emaSlow  = ema(closes, slow)
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]).slice(slow - 1)
  const times    = data.map(d => d.time).slice(slow - 1)
  const sigLine  = ema(macdLine, signal)

  const macdOut  = macdLine.map((v, i) => ({ time: times[i], value: parseFloat(v.toFixed(2)) }))
  const sigOut   = sigLine.map((v, i)  => ({ time: times[i], value: parseFloat(v.toFixed(2)) }))
  const histOut  = macdLine.map((v, i) => ({ time: times[i], value: parseFloat((v - sigLine[i]).toFixed(2)) }))

  return { macd: macdOut, signal: sigOut, hist: histOut }
}

// ── Chart panel helper ────────────────────────────────────────────────────────

async function loadLightweightCharts() {
  const mod = await import('lightweight-charts')
  return mod
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StockChart() {
  const { isDark }     = useContext(ThemeContext)
  const { selectedSymbol, selectedIndexId, chartType, timeframe, activeIndicators, isIndex } = useAnalysis()

  const mainRef  = useRef(null)
  const rsiRef   = useRef(null)
  const macdRef  = useRef(null)

  const chartsRef = useRef({})   // { main, rsi, macd } — LW chart instances
  const seriesRef = useRef({})   // { candle/line, volume, ma, rsi, macdLine, macdSig, macdHist }

  const [chartData, setChartData]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [latestDate, setLatestDate] = useState(null)
  const [tooltip, setTooltip]       = useState(null)

  const COLORS = {
    bg:       isDark ? '#111827' : '#ffffff',
    grid:     isDark ? '#1f2937' : '#f3f4f6',
    text:     isDark ? '#9ca3af' : '#6b7280',
    border:   isDark ? '#1f2937' : '#e5e7eb',
    up:       '#10b981',
    down:     '#f87171',
    ma:       '#3b82f6',
    rsi:      '#a78bfa',
    macd:     '#60a5fa',
    signal:   '#f59e0b',
    histUp:   '#10b981',
    histDown: '#f87171',
  }

  // ── Fetch data when symbol/timeframe changes ──────────────────────────────
  useEffect(() => {
    setLoading(true)
    setError(null)
    const sym = selectedSymbol

    const req = isIndex(sym)
      ? getIndexChart({ index_id: selectedIndexId, timeframe })
      : getStockChart({ symbol: sym, timeframe })

    req
      .then(r => {
        setChartData(r.data.data || [])
        setLatestDate(r.data.latestDate)
        setLoading(false)
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load chart data')
        setLoading(false)
      })
  }, [selectedSymbol, selectedIndexId, timeframe])

  // ── Init / rebuild charts when data or theme changes ─────────────────────
  useEffect(() => {
    if (loading || !chartData.length || !mainRef.current) return

    // Destroy old charts
    Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
    chartsRef.current = {}
    seriesRef.current = {}

    loadLightweightCharts().then(({ createChart, CrosshairMode }) => {
      const baseOpts = {
        layout:     { background: { color: COLORS.bg }, textColor: COLORS.text },
        grid:       { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
        crosshair:  { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: COLORS.border },
        timeScale:  { borderColor: COLORS.border, timeVisible: true },
        handleScroll:   true,
        handleScale:    true,
      }

      // ── Main chart ──────────────────────────────────────────────────────
      const mainChart = createChart(mainRef.current, {
        ...baseOpts,
        width:  mainRef.current.clientWidth,
        height: mainRef.current.clientHeight,
      })
      chartsRef.current.main = mainChart

      let priceSeries
      if (chartType === 'candlestick') {
        priceSeries = mainChart.addCandlestickSeries({
          upColor: COLORS.up, downColor: COLORS.down,
          borderUpColor: COLORS.up, borderDownColor: COLORS.down,
          wickUpColor: COLORS.up, wickDownColor: COLORS.down,
        })
        priceSeries.setData(chartData)
      } else {
        priceSeries = mainChart.addLineSeries({ color: COLORS.ma, lineWidth: 2 })
        priceSeries.setData(chartData.map(d => ({ time: d.time, value: d.close })))
      }
      seriesRef.current.price = priceSeries

      // MA overlay
      if (activeIndicators.includes('MA')) {
        const maData = calcMA(chartData, 20)
        if (maData.length) {
          const maSeries = mainChart.addLineSeries({ color: COLORS.ma, lineWidth: 1.5, priceLineVisible: false })
          maSeries.setData(maData)
          seriesRef.current.ma = maSeries
        }
      }

      // Volume (on main chart, separate scale)
      const volSeries = mainChart.addHistogramSeries({
        color: COLORS.grid, priceFormat: { type: 'volume' },
        priceScaleId: 'vol', scaleMargins: { top: 0.85, bottom: 0 },
      })
      mainChart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      volSeries.setData(chartData.map(d => ({
        time:  d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? COLORS.up + '55' : COLORS.down + '55',
      })))
      seriesRef.current.volume = volSeries

      // Crosshair tooltip
      mainChart.subscribeCrosshairMove(param => {
        if (!param.time || !param.seriesData) { setTooltip(null); return }
        const bar = param.seriesData.get(priceSeries)
        if (!bar) { setTooltip(null); return }
        setTooltip({
          time:  param.time,
          open:  bar.open  ?? bar.value,
          high:  bar.high  ?? bar.value,
          low:   bar.low   ?? bar.value,
          close: bar.close ?? bar.value,
        })
      })

      // ── RSI panel ────────────────────────────────────────────────────────
      if (activeIndicators.includes('RSI') && rsiRef.current) {
        const rsiData = calcRSI(chartData)
        if (rsiData.length) {
          const rsiChart = createChart(rsiRef.current, {
            ...baseOpts,
            width:  rsiRef.current.clientWidth,
            height: rsiRef.current.clientHeight,
            rightPriceScale: { ...baseOpts.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
          })
          chartsRef.current.rsi = rsiChart
          const rsiSeries = rsiChart.addLineSeries({ color: COLORS.rsi, lineWidth: 1.5, priceLineVisible: false })
          rsiSeries.setData(rsiData)
          // Overbought/oversold lines
          rsiChart.addLineSeries({ color: '#f87171', lineWidth: 1, priceLineVisible: false, lineStyle: 2 })
            .setData(rsiData.map(d => ({ time: d.time, value: 70 })))
          rsiChart.addLineSeries({ color: '#10b981', lineWidth: 1, priceLineVisible: false, lineStyle: 2 })
            .setData(rsiData.map(d => ({ time: d.time, value: 30 })))
          seriesRef.current.rsi = rsiSeries
          // Sync time scale
          mainChart.timeScale().subscribeVisibleLogicalRangeChange(r => {
            if (r) rsiChart.timeScale().setVisibleLogicalRange(r)
          })
        }
      }

      // ── MACD panel ───────────────────────────────────────────────────────
      if (activeIndicators.includes('MACD') && macdRef.current) {
        const { macd, signal, hist } = calcMACD(chartData)
        if (macd.length) {
          const macdChart = createChart(macdRef.current, {
            ...baseOpts,
            width:  macdRef.current.clientWidth,
            height: macdRef.current.clientHeight,
          })
          chartsRef.current.macd = macdChart
          macdChart.addLineSeries({ color: COLORS.macd, lineWidth: 1.5, priceLineVisible: false }).setData(macd)
          macdChart.addLineSeries({ color: COLORS.signal, lineWidth: 1.5, priceLineVisible: false }).setData(signal)
          macdChart.addHistogramSeries({ priceLineVisible: false }).setData(
            hist.map(d => ({ ...d, color: d.value >= 0 ? COLORS.histUp : COLORS.histDown }))
          )
          mainChart.timeScale().subscribeVisibleLogicalRangeChange(r => {
            if (r) macdChart.timeScale().setVisibleLogicalRange(r)
          })
        }
      }

      // Fit all
      mainChart.timeScale().fitContent()

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (mainRef.current)  mainChart.applyOptions({ width: mainRef.current.clientWidth })
        if (rsiRef.current && chartsRef.current.rsi)  chartsRef.current.rsi.applyOptions({ width: rsiRef.current.clientWidth })
        if (macdRef.current && chartsRef.current.macd) chartsRef.current.macd.applyOptions({ width: macdRef.current.clientWidth })
      })
      ro.observe(mainRef.current)
      return () => ro.disconnect()
    })

    return () => {
      Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
      chartsRef.current = {}
    }
  }, [chartData, isDark, chartType, activeIndicators])

  const showRSI  = activeIndicators.includes('RSI')
  const showMACD = activeIndicators.includes('MACD')

  // Height distribution
  const indicatorCount = (showRSI ? 1 : 0) + (showMACD ? 1 : 0)
  const mainPct = indicatorCount === 0 ? 100 : indicatorCount === 1 ? 70 : 55

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col w-full h-full">
      {/* OHLC tooltip */}
      {tooltip && (
        <div className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[10px] space-y-0.5 pointer-events-none">
          <div className="text-gray-400">{tooltip.time}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-700 dark:text-gray-200">
            <span className="text-gray-400">O</span><span>{tooltip.open?.toLocaleString()}</span>
            <span className="text-gray-400">H</span><span className="text-emerald-500">{tooltip.high?.toLocaleString()}</span>
            <span className="text-gray-400">L</span><span className="text-red-400">{tooltip.low?.toLocaleString()}</span>
            <span className="text-gray-400">C</span><span>{tooltip.close?.toLocaleString()}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/50 dark:bg-gray-900/50">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Main chart */}
      <div ref={mainRef} style={{ height: `${mainPct}%` }} className="w-full" />

      {/* RSI panel */}
      {showRSI && (
        <div className="w-full border-t border-gray-100 dark:border-gray-800">
          <div className="px-2 pt-1 text-[9px] font-semibold text-purple-400 uppercase tracking-widest">RSI 14</div>
          <div ref={rsiRef} style={{ height: '80px' }} className="w-full" />
        </div>
      )}

      {/* MACD panel */}
      {showMACD && (
        <div className="w-full border-t border-gray-100 dark:border-gray-800">
          <div className="px-2 pt-1 text-[9px] font-semibold text-blue-400 uppercase tracking-widest">MACD 12/26/9</div>
          <div ref={macdRef} style={{ height: '80px' }} className="w-full" />
        </div>
      )}
    </div>
  )
}
