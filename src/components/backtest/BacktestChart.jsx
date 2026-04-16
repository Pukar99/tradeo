import { useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'

async function loadLC() { return import('lightweight-charts') }

const COLORS = {
  entry: '#3b82f6',
  sl:    '#ef4444',
  tp:    '#22c55e',
}

export default function BacktestChart({ candles, cursorIndex, positions }) {
  const { isDark } = useTheme()

  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const candleSerRef  = useRef(null)
  const volSerRef     = useRef(null)
  const overlayRefs   = useRef({})   // { [orderId]: { entry, sl, tp } }
  const roRef         = useRef(null)

  // Always-fresh refs so async callbacks never close over stale values
  const candlesRef   = useRef(candles)
  const cursorRef    = useRef(cursorIndex)
  const isDarkRef    = useRef(isDark)
  candlesRef.current = candles
  cursorRef.current  = cursorIndex
  isDarkRef.current  = isDark

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function paintCandles(cdls, idx) {
    if (!candleSerRef.current || !cdls?.length) return
    const slice      = cdls.slice(0, Math.max(idx + 1, 1))
    const candleData = slice.map(c => ({ time: c.date, open: +c.open, high: +c.high, low: +c.low, close: +c.close }))
    const volData    = slice.map(c => ({
      time: c.date, value: +(c.volume || c.turnover || 0),
      color: +c.close >= +c.open ? '#22c55e40' : '#ef444440',
    }))
    candleSerRef.current.setData(candleData)
    if (volSerRef.current) volSerRef.current.setData(volData)
    if (chartRef.current) chartRef.current.timeScale().scrollToPosition(3, false)
  }

  function removeOverlays() {
    Object.values(overlayRefs.current).forEach(g => {
      ['entry', 'sl', 'tp'].forEach(k => {
        if (g[k]) { try { chartRef.current?.removeSeries(g[k]) } catch {} }
      })
    })
    overlayRefs.current = {}
  }

  // ── Init / re-init on theme change ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    loadLC().then(LC => {
      if (cancelled || !containerRef.current) return

      // Destroy old chart if re-initialising (theme change)
      if (chartRef.current) {
        roRef.current?.disconnect()
        chartRef.current.remove()
        chartRef.current   = null
        candleSerRef.current = null
        volSerRef.current    = null
        overlayRefs.current  = {}
      }

      const el  = containerRef.current
      const dark = isDarkRef.current

      const chart = LC.createChart(el, {
        width:  el.offsetWidth  || 800,
        height: el.offsetHeight || 500,
        layout: {
          background: { color: dark ? '#030712' : '#ffffff' },
          textColor:  dark ? '#9ca3af' : '#374151',
        },
        grid: {
          vertLines: { color: dark ? '#111827' : '#f3f4f6' },
          horzLines: { color: dark ? '#111827' : '#f3f4f6' },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: dark ? '#1f2937' : '#e5e7eb' },
        timeScale: {
          borderColor:  dark ? '#1f2937' : '#e5e7eb',
          timeVisible:  true,
          rightOffset:  3,
        },
        attributionLogo: false,
      })

      const candleSer = chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      })

      const volSer = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } })

      chartRef.current     = chart
      candleSerRef.current = candleSer
      volSerRef.current    = volSer

      // Paint whatever is already loaded
      paintCandles(candlesRef.current, cursorRef.current)

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chartRef.current) return
        chartRef.current.applyOptions({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      })
      ro.observe(el)
      roRef.current = ro
    })

    return () => {
      cancelled = true
      roRef.current?.disconnect()
      roRef.current = null
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current     = null
        candleSerRef.current = null
        volSerRef.current    = null
        overlayRefs.current  = {}
      }
    }
  }, [isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw candles whenever cursor moves ──────────────────────────────────────
  useEffect(() => {
    paintCandles(candles, cursorIndex)
  }, [candles, cursorIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw overlays whenever positions / cursor change ────────────────────────
  useEffect(() => {
    if (!chartRef.current || !candleSerRef.current) return

    removeOverlays()

    const openPositions = (positions || []).filter(p => p.status === 'OPEN' || p.status === 'PARTIAL')

    openPositions.forEach(pos => {
      if (!chartRef.current) return
      const entryDate = pos.entry_date?.slice(0, 10)
      const ep        = +pos.entry_price
      const sl        = pos.sl ? +pos.sl : null
      const tp        = pos.tp ? +pos.tp : null
      const opacity   = pos.settled ? 1 : 0.5
      const hex       = Math.round(opacity * 255).toString(16).padStart(2, '0')

      const sliceForPos = candles.slice(0, cursorIndex + 1).filter(c => c.date >= entryDate)
      if (!sliceForPos.length) return

      const makeLine = (price, color, lineStyle) => {
        const s = chartRef.current.addLineSeries({
          color, lineWidth: 1, lineStyle,
          priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        s.setData(sliceForPos.map(c => ({ time: c.date, value: price })))
        return s
      }

      const g = {}
      g.entry = makeLine(ep, COLORS.entry + hex, 0)
      if (sl !== null) g.sl = makeLine(sl, COLORS.sl + hex, 1)
      if (tp !== null) g.tp = makeLine(tp, COLORS.tp + hex, 1)

      overlayRefs.current[pos.id] = g
    })

  }, [positions, candles, cursorIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
