import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'

async function loadLC() { return import('lightweight-charts') }

const LINE_COLORS = {
  entry: '#3b82f6',
  sl:    '#ef4444',
  tp:    '#22c55e',
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }
function fmtVol(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function BacktestChart({ candles, cursorIndex, positions }) {
  const { isDark } = useTheme()

  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const candleSerRef  = useRef(null)
  const volSerRef     = useRef(null)
  const overlayRefs   = useRef({})   // { [orderId]: { entry, sl, tp } }
  const markerSerRef  = useRef(null) // for entry/exit arrow markers
  const roRef         = useRef(null)

  // Always-fresh refs so async callbacks never close over stale values
  const candlesRef   = useRef(candles)
  const cursorRef    = useRef(cursorIndex)
  const isDarkRef    = useRef(isDark)
  const positionsRef = useRef(positions)
  candlesRef.current   = candles
  cursorRef.current    = cursorIndex
  isDarkRef.current    = isDark
  positionsRef.current = positions

  // OHLCV HUD state (shown top-left)
  const [hud, setHud] = useState(null)

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
    // Update HUD to show the current candle
    const cur = slice[slice.length - 1]
    if (cur) setHud(cur)
  }

  function removeOverlays() {
    Object.values(overlayRefs.current).forEach(g => {
      ['entry', 'sl', 'tp'].forEach(k => {
        if (g[k]) { try { chartRef.current?.removeSeries(g[k]) } catch {} }
      })
    })
    overlayRefs.current = {}
  }

  // Build marker data for all positions (entry + exit arrows)
  function buildMarkers(cdls, idx, pos) {
    const markers = []
    const visibleUntil = cdls[idx]?.date || ''

    for (const p of pos) {
      const entryDate = p.entry_date?.slice(0, 10)
      if (!entryDate || entryDate > visibleUntil) continue

      markers.push({
        time:     entryDate,
        position: 'belowBar',
        color:    '#3b82f6',
        shape:    'arrowUp',
        text:     `BUY ${p.symbol} @${fmt(parseFloat(p.entry_price))}`,
        size:     1,
      })

      if (p.status === 'CLOSED' && p.exit_date) {
        const exitDate = p.exit_date.slice(0, 10)
        if (exitDate <= visibleUntil) {
          const pnl      = parseFloat(p.net_pnl) || 0
          const isProfit = pnl >= 0
          markers.push({
            time:     exitDate,
            position: 'aboveBar',
            color:    isProfit ? '#22c55e' : '#ef4444',
            shape:    'arrowDown',
            text:     `EXIT ${p.symbol} ${isProfit ? '+' : ''}Rs.${fmt(pnl)}`,
            size:     1,
          })
        }
      }
    }

    // Sort by date (required by lightweight-charts)
    markers.sort((a, b) => a.time.localeCompare(b.time))
    return markers
  }

  function paintMarkers(cdls, idx, pos) {
    if (!candleSerRef.current) return
    const markers = buildMarkers(cdls, idx, pos)
    try {
      candleSerRef.current.setMarkers(markers)
    } catch {}
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
        chartRef.current     = null
        candleSerRef.current = null
        volSerRef.current    = null
        markerSerRef.current = null
        overlayRefs.current  = {}
      }

      const el   = containerRef.current
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

      // Update HUD on crosshair move
      chart.subscribeCrosshairMove(param => {
        if (!param || !param.time) return
        const cdls = candlesRef.current
        const c    = cdls.find(x => x.date === param.time)
        if (c) setHud(c)
      })

      // Paint whatever is already loaded
      paintCandles(candlesRef.current, cursorRef.current)
      paintMarkers(candlesRef.current, cursorRef.current, positionsRef.current || [])

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
        markerSerRef.current = null
        overlayRefs.current  = {}
      }
    }
  }, [isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw candles whenever cursor moves ──────────────────────────────────────
  useEffect(() => {
    paintCandles(candles, cursorIndex)
  }, [candles, cursorIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw overlays + markers whenever positions / cursor change ──────────────
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
      g.entry = makeLine(ep, LINE_COLORS.entry + hex, 0)
      if (sl !== null) g.sl = makeLine(sl, LINE_COLORS.sl + hex, 1)
      if (tp !== null) g.tp = makeLine(tp, LINE_COLORS.tp + hex, 1)

      overlayRefs.current[pos.id] = g
    })

    // Paint markers for ALL positions (open + closed visible so far)
    paintMarkers(candles, cursorIndex, positions || [])

  }, [positions, candles, cursorIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── OHLCV HUD ─────────────────────────────────────────────────────────────────
  const curCandle = hud || candles[cursorIndex - 1] || candles[0]
  const isUp = curCandle ? parseFloat(curCandle.close) >= parseFloat(curCandle.open) : true

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Chart container */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* OHLCV HUD — top left overlay */}
      {curCandle && (
        <div className="absolute top-1.5 left-2 z-10 pointer-events-none select-none">
          <div className="flex items-center gap-2 text-[10px] font-mono bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm rounded px-1.5 py-0.5">
            <span className="text-gray-400 dark:text-gray-500">{curCandle.date}</span>
            <span className="text-gray-500 dark:text-gray-400">O <span className={isUp ? 'text-green-600' : 'text-red-500'}>{fmt(curCandle.open)}</span></span>
            <span className="text-gray-500 dark:text-gray-400">H <span className="text-green-600">{fmt(curCandle.high)}</span></span>
            <span className="text-gray-500 dark:text-gray-400">L <span className="text-red-500">{fmt(curCandle.low)}</span></span>
            <span className="text-gray-500 dark:text-gray-400">C <span className={`font-bold ${isUp ? 'text-green-600' : 'text-red-500'}`}>{fmt(curCandle.close)}</span></span>
            <span className="text-gray-400 dark:text-gray-500">Vol {fmtVol(curCandle.volume || curCandle.turnover)}</span>
          </div>
        </div>
      )}

      {/* Legend for SL/TP/Entry lines */}
      <div className="absolute top-1.5 right-2 z-10 pointer-events-none select-none flex gap-2 text-[9px]">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500" /> Entry</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" style={{ borderTop: '1px dashed #ef4444', background: 'none' }} /> SL</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500" style={{ borderTop: '1px dashed #22c55e', background: 'none' }} /> TP</span>
      </div>
    </div>
  )
}
