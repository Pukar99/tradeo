// === insight/charts.jsx — MonthChart, StockMiniChartPopover, SectorMomentumSpark ===
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getStockChart } from '../../../api/index'
import { isCanceled } from '../../../utils/format'
import { loadLC } from './helpers'

// ─── Month OHLC chart (interactive) ───────────────────────────────────────────
export function MonthChart({ candles, dark }) {
  const ref = useRef(null)
  const cRef = useRef(null)
  const roRef = useRef(null)

  // For 1-day months (holidays), lightweight-charts can't lay out a single
  // candle nicely — it collapses to the right edge. Fall back to a friendly stat card.
  const singleDay = candles?.length === 1 ? candles[0] : null

  useEffect(() => {
    const el = ref.current
    if (!el || !candles?.length || candles.length === 1) return
    let cancelled = false
    loadLC().then(({ createChart, CrosshairMode }) => {
      if (cancelled || !ref.current) return

      const chart = createChart(el, {
        width: el.clientWidth || 400,
        height: el.clientHeight || 200,
        layout: {
          background: { color: 'transparent' },
          textColor: dark ? '#94a3b8' : '#64748b',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 10,
          // Hides the TradingView attribution logo — must live INSIDE layout
          // (LayoutOptions.attributionLogo); at the options root it is ignored.
          attributionLogo: false,
        },
        watermark: { visible: false },
        grid: {
          vertLines: { color: 'transparent' },
          horzLines: { color: 'transparent' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: dark ? '#334155' : '#e2e8f0',
          minimumWidth: 50,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        leftPriceScale: { visible: false },
        timeScale: {
          borderColor: dark ? '#334155' : '#e2e8f0',
          timeVisible: false,
          tickMarkFormatter: () => '',
          // Constrain candle width — without this they stretch absurdly wide on short months.
          barSpacing: 8,
          minBarSpacing: 4,
          rightOffset: 1,
        },
        handleScroll: true,
        handleScale: true,
      })

      const cs = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })
      cs.setData(
        candles.map((c) => ({
          time: c.date,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      )

      const hasTov = candles.some((c) => (c.turnover || 0) > 0)
      if (hasTov) {
        const hs = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
        })
        chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        hs.setData(
          candles.map((c) => ({
            time: c.date,
            value: c.turnover || 0,
            color: c.close >= c.open ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          }))
        )
      }

      // High/low markers — small circles, no text label.
      // The price card below the chart already shows H/L numerically.
      if (candles.length >= 2) {
        const hi = candles.reduce((a, b) => (b.high > a.high ? b : a))
        const lo = candles.reduce((a, b) => (b.low < a.low ? b : a))
        const mkrs = [
          { time: hi.date, position: 'aboveBar', color: '#22c55e', shape: 'circle', size: 0.6 },
        ]
        if (lo.date !== hi.date)
          mkrs.push({
            time: lo.date,
            position: 'belowBar',
            color: '#ef4444',
            shape: 'circle',
            size: 0.6,
          })
        cs.setMarkers(mkrs.sort((a, b) => a.time.localeCompare(b.time)))
      }

      chart.timeScale().fitContent()
      cRef.current = chart

      const ro = new ResizeObserver(() => {
        if (ref.current && cRef.current) {
          cRef.current.applyOptions({
            width: ref.current.clientWidth,
            height: ref.current.clientHeight,
          })
          cRef.current.timeScale().fitContent()
        }
      })
      roRef.current = ro
      ro.observe(el)
    })
    return () => {
      cancelled = true
      roRef.current?.disconnect()
      roRef.current = null
      cRef.current?.remove()
      cRef.current = null
    }
  }, [candles, dark])

  // Single-day fallback — show OHLC summary instead of a degenerate chart
  if (singleDay) {
    const c = singleDay
    const isUp = c.close >= c.open
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center gap-1.5 px-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {c.date} · single trading day
        </div>
        <div
          className={`text-[20px] font-black tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {c.close.toFixed(2)}
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-500 dark:text-gray-400">
            O{' '}
            <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">
              {c.open.toFixed(2)}
            </span>
          </span>
          <span className="text-emerald-500">
            H <span className="font-bold tabular-nums">{c.high.toFixed(2)}</span>
          </span>
          <span className="text-red-500">
            L <span className="font-bold tabular-nums">{c.low.toFixed(2)}</span>
          </span>
        </div>
      </div>
    )
  }

  return <div ref={ref} className="w-full h-full" />
}

// ─── Stock Mini-Chart Popover — 3-month candles on stock click ───────────────
export function StockMiniChartPopover({ symbol, anchorRect, onClose, dark }) {
  const [candles, setCandles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const chartHostRef = useRef(null)
  const cRef = useRef(null)

  useEffect(() => {
    if (!symbol) return
    const ctrl = new AbortController()
    setLoading(true)
    setCandles(null)
    setError(null)
    getStockChart({ symbol, timeframe: '3M' }, { signal: ctrl.signal })
      // Payload shape: { symbol, timeframe, latestDate, data: [{ time, open, high, low, close, … }] }
      // — rows key the date as `time`, so normalize to `date` for the chart code below.
      .then((r) => {
        if (ctrl.signal.aborted) return
        const rows = Array.isArray(r.data?.data) ? r.data.data : []
        setCandles(
          rows.map((c) => ({
            date: c.time,
            open: +c.open,
            high: +c.high,
            low: +c.low,
            close: +c.close,
          }))
        )
      })
      .catch((err) => {
        if (!ctrl.signal.aborted && !isCanceled(err)) setError('Failed to load chart')
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [symbol])

  // Close on Escape, click outside, or scroll OUTSIDE the popover
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    function onClick(e) {
      if (chartHostRef.current && !chartHostRef.current.contains(e.target)) onClose()
    }
    // Only dismiss when scroll happens outside the popover. lightweight-charts
    // can emit scroll events on its internal canvas during pan/zoom; without this
    // guard the popover would close itself when the user interacts with the chart.
    function onScroll(e) {
      if (chartHostRef.current && chartHostRef.current.contains(e.target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    window.addEventListener('scroll', onScroll, true) // capture: catch scrollable ancestors
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  // Draw chart
  useEffect(() => {
    if (!candles?.length || !chartHostRef.current) return
    let cancelled = false
    loadLC().then(({ createChart }) => {
      if (cancelled || !chartHostRef.current) return
      const chart = createChart(chartHostRef.current, {
        width: chartHostRef.current.clientWidth || 360,
        height: 180,
        layout: {
          background: { color: 'transparent' },
          textColor: dark ? '#94a3b8' : '#64748b',
          fontSize: 9,
          attributionLogo: false,
        },
        grid: { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        rightPriceScale: { borderColor: dark ? '#334155' : '#e2e8f0' },
        timeScale: {
          borderColor: dark ? '#334155' : '#e2e8f0',
          timeVisible: false,
          tickMarkFormatter: () => '',
        },
        handleScroll: false,
        handleScale: false,
      })
      const cs = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })
      cs.setData(
        candles.map((c) => ({
          time: c.date,
          open: +c.open,
          high: +c.high,
          low: +c.low,
          close: +c.close,
        }))
      )
      chart.timeScale().fitContent()
      cRef.current = chart
    })
    return () => {
      cancelled = true
      cRef.current?.remove()
      cRef.current = null
    }
  }, [candles, dark])

  // Fixed sidebar placement — anchored to the LEFT of the right-panel (which is on the
  // right of the screen). This way the popover stays visible even when the panel scrolls.
  if (!anchorRect) return null
  // Clamp to viewport — 380px hard width overflowed narrow phones
  const POP_W = Math.min(380, window.innerWidth - 16)
  const POP_H = 240
  const margin = 12
  // Position to the LEFT of the right panel. The right panel starts at anchorRect.right's
  // owning panel's left edge — but we don't have that ref. Use the anchor row's left edge
  // (which equals the panel's left edge minus its padding) as the anchor.
  const left = Math.max(8, anchorRect.left - POP_W - margin)
  // Vertically center on the clicked row — a fixed top teleported the popover
  // away from the click. Clamp below the navbar and above the viewport bottom.
  let top = anchorRect.top + anchorRect.height / 2 - POP_H / 2
  top = Math.max(64, Math.min(top, window.innerHeight - POP_H - 8))

  const first = candles?.[0]?.close
  const last = candles?.[candles.length - 1]?.close
  const change = first && last ? ((last - first) / first) * 100 : null
  const changeColor = change == null ? '#9ca3af' : change >= 0 ? '#22c55e' : '#ef4444'

  return createPortal(
    <div
      ref={chartHostRef}
      className="fixed z-[100] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ left, top, width: POP_W, height: POP_H }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-black text-gray-800 dark:text-gray-100">{symbol}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">3-Mo</span>
          {change != null && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: changeColor }}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm leading-none"
        >
          ×
        </button>
      </div>
      <div style={{ height: 180 }} className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400">
            {error}
          </div>
        )}
        {!loading && !error && !candles?.length && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
            No data
          </div>
        )}
      </div>
    </div>,
    document.getElementById('portal-root') || document.body
  )
}

// ─── 3-month sparkline (sector momentum) ──────────────────────────────────────
export function SectorMomentumSpark({ values, height = 16, width = 44 }) {
  const valid = (values || []).filter((v) => v != null)
  if (valid.length < 2) {
    // Loading placeholder — pulse a thin horizontal line instead of a `—` glyph
    return (
      <div style={{ width, height }} className="flex items-center justify-center shrink-0">
        <div className="h-px w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
      </div>
    )
  }
  const min = Math.min(...valid, 0)
  const max = Math.max(...valid, 0)
  const range = max - min || 1
  const lastVal = values[values.length - 1]
  const stroke = lastVal == null ? '#9ca3af' : lastVal >= 0 ? '#22c55e' : '#ef4444'
  const pts = values
    .map((v, i) =>
      v != null
        ? `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * height}`
        : null
    )
    .filter(Boolean)
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
