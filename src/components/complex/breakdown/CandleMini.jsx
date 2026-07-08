// =============================================================================
// CandleMini.jsx — real lightweight-charts mini candle chart for Compare's
// "2 lines" mode (owner eyeball 2026-07-07: "make it the best chart to view,
// can scroll like the real chart but with mini view, preserve the specialty
// features like the red highlights").
//
// Transplanted from the deleted PerformanceChart.jsx (git show 1581178~1) —
// MiniCandle (was ~L128-273), AutoMiniCandle (was ~L276-296), and the
// crosshair + timescale sync retry-loop (was ~L465-542, the `sub()` pattern)
// adapted into the exported useSyncedCharts(aRef, bRef, enabled) hook.
//
// New on top of the recovered original: per-bar cycle-zone tinting (dimmed
// outside [startDate, endDate], full color inside — colors copied verbatim
// from charts.jsx's SVG PriceChart in-zone/out-of-zone logic) plus start/end
// boundary markers via setMarkers.
// =============================================================================
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useTheme } from '../../../context/ThemeContext'
import { candleSeriesOptions } from '../../../utils/chartTheme'

async function loadLC() {
  return import('lightweight-charts')
}

// In-zone candle colors — verbatim from the recovered PerformanceChart.jsx (UP/DOWN consts).
const UP = '#10b981'
const DOWN = '#ef4444'
// Dimmed (out-of-zone) candle colors — verbatim from charts.jsx PriceChart, lines 208-212.
const DIM_UP_LIGHT = '#bbf7d0'
const DIM_UP_DARK = '#1d4a34'
const DIM_UP_WICK_LIGHT = '#16a34a'
const DIM_UP_WICK_DARK = '#22c55e'
const DIM_DOWN_LIGHT = '#fecaca'
const DIM_DOWN_DARK = '#4a1d1d'
const DIM_DOWN_WICK_LIGHT = '#dc2626'
const DIM_DOWN_WICK_DARK = '#ef4444'

// ── Inline candlestick chart — exposes chart instance via ref for cursor sync ──
export const MiniCandle = forwardRef(function MiniCandle(
  { data, height = 360, startDate, endDate, type = 'bear' },
  fwdRef
) {
  const { isDark } = useTheme()
  const domRef = useRef(null)
  const chartR = useRef(null)
  const seriesR = useRef(null)

  useImperativeHandle(
    fwdRef,
    () => ({
      getChart: () => chartR.current,
      getSeries: () => seriesR.current,
    }),
    []
  )

  useEffect(() => {
    if (!domRef.current || !height) return
    let cancelled = false

    if (chartR.current) {
      try {
        chartR.current._ro?.disconnect()
        chartR.current.remove()
      } catch (_) {}
      chartR.current = null
      seriesR.current = null
    }

    // Match card bg exactly
    const bg = isDark ? '#111827' : '#ffffff'
    const tx = isDark ? '#64748b' : '#94a3b8'
    const br = isDark ? '#1f2937' : '#e2e8f0'
    const w = domRef.current.clientWidth || 400

    loadLC().then(({ createChart }) => {
      if (cancelled || !domRef.current) return

      const chart = createChart(domRef.current, {
        width: w,
        height,
        layout: { background: { color: bg }, textColor: tx, fontSize: 10, attributionLogo: false },
        grid: { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        crosshair: {
          mode: 1,
          vertLine: {
            color: isDark ? '#475569' : '#94a3b8',
            width: 1,
            style: 3,
            labelVisible: true,
          },
          horzLine: {
            color: isDark ? '#475569' : '#94a3b8',
            width: 1,
            style: 3,
            labelVisible: true,
          },
        },
        rightPriceScale: { borderColor: br, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: br, timeVisible: true, barSpacing: 8, minBarSpacing: 3 },
        handleScroll: true,
        handleScale: true,
      })
      chartR.current = chart

      if (data?.length) {
        const s = chart.addCandlestickSeries(
          candleSeriesOptions(UP, DOWN, {
            wickUpColor: UP + 'cc',
            wickDownColor: DOWN + 'cc',
            priceLineVisible: false,
          })
        )

        // Per-bar zone tinting: inside [startDate, endDate] gets full UP/DOWN
        // color, outside gets the dimmed variant (owner's "red highlights").
        const hasZone = startDate != null && endDate != null
        const bars = data.map((d) => {
          const open = +(d.open ?? d.close)
          const close = +d.close
          const high = +(d.high ?? Math.max(open, close))
          const low = +(d.low ?? Math.min(open, close))
          const isUp = close >= open
          const inZone = !hasZone || (d.date >= startDate && d.date <= endDate)
          let color, wick
          if (inZone) {
            color = isUp ? UP : DOWN
            wick = color
          } else {
            color = isUp ? (isDark ? DIM_UP_DARK : DIM_UP_LIGHT) : isDark ? DIM_DOWN_DARK : DIM_DOWN_LIGHT
            wick = isUp
              ? isDark
                ? DIM_UP_WICK_DARK
                : DIM_UP_WICK_LIGHT
              : isDark
                ? DIM_DOWN_WICK_DARK
                : DIM_DOWN_WICK_LIGHT
          }
          return {
            time: d.date,
            open,
            high,
            low,
            close,
            color,
            borderColor: color,
            wickColor: wick,
          }
        })
        s.setData(bars)
        seriesR.current = s

        // Boundary markers at the zone edges (start = bull/emerald, end = bear/red —
        // matches PriceChart's zoneColor: type === 'bull' ? '#10b981' : '#ef4444').
        if (hasZone && data.length) {
          const startIdx = data.findIndex((d) => d.date >= startDate)
          const endIdx = data.findIndex((d) => d.date >= endDate)
          const markers = []
          if (startIdx >= 0) {
            const b = bars[startIdx]
            markers.push({
              time: b.time,
              position: 'belowBar',
              color: '#10b981',
              shape: 'arrowUp',
              text: b.close.toFixed(2),
            })
          }
          if (endIdx >= 0 && endIdx !== startIdx) {
            const b = bars[endIdx]
            markers.push({
              time: b.time,
              position: 'aboveBar',
              color: '#ef4444',
              shape: 'arrowDown',
              text: b.close.toFixed(2),
            })
          }
          if (markers.length) s.setMarkers(markers.sort((a, b) => a.time.localeCompare(b.time)))
        }

        // Volume bars — bottom 20% of chart, only if data has turnover
        const hasTov = data.some((d) => (d.turnover || 0) > 0)
        if (hasTov) {
          chart.applyOptions({
            rightPriceScale: { borderColor: br, scaleMargins: { top: 0.08, bottom: 0.22 } },
          })
          const vol = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'vol',
          })
          chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
          vol.setData(
            data.map((d) => ({
              time: d.date,
              value: d.turnover || 0,
              color:
                +d.close >= +(d.open ?? d.close)
                  ? isDark
                    ? 'rgba(16,185,129,0.18)'
                    : 'rgba(16,185,129,0.15)'
                  : isDark
                    ? 'rgba(239,68,68,0.18)'
                    : 'rgba(239,68,68,0.15)',
            }))
          )
        }

        chart.timeScale().fitContent()
      }

      if (cancelled || !domRef.current) return
      const ro = new ResizeObserver(() => {
        if (domRef.current && chartR.current)
          chartR.current.applyOptions({ width: domRef.current.clientWidth })
      })
      ro.observe(domRef.current)
      chart._ro = ro
    })

    return () => {
      cancelled = true
      if (chartR.current) {
        try {
          chartR.current._ro?.disconnect()
          chartR.current.remove()
        } catch (_) {}
        chartR.current = null
        seriesR.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isDark, height, startDate, endDate, type])

  return (
    <div className="relative w-full" style={{ height }}>
      {!data?.length && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400">
          No data
        </div>
      )}
      <div ref={domRef} style={{ width: '100%', height }} />
    </div>
  )
})

// ── Wrapper that measures its container height and passes px to MiniCandle ───
export const AutoMiniCandle = forwardRef(function AutoMiniCandle(
  { data, startDate, endDate, type },
  ref
) {
  const wrapRef = useRef(null)
  const [h, setH] = useState(300)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const px = Math.floor(e.contentRect.height)
      if (px > 0) setH(px)
    })
    ro.observe(el)
    const initial = Math.floor(el.clientHeight)
    if (initial > 0) setH(initial)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrapRef} className="w-full h-full">
      <MiniCandle ref={ref} data={data} height={h} startDate={startDate} endDate={endDate} type={type} />
    </div>
  )
})

// ── Synced crosshair + timescale across two MiniCandle instances ─────────────
// Adapted from PerformanceChart.jsx's CycleDetail sync effect (was ~L465-542),
// hardened 2026-07-08 (owner: "sync not working"): MiniCandle RECREATES its
// chart whenever data/height/theme change — and height settles right after
// first paint via AutoMiniCandle's ResizeObserver — so the original one-shot
// retry wired instances that were immediately replaced. This version WATCHES:
// it re-wires whenever EITHER chart instance changes and keeps watching while
// enabled, so crosshair + date/zoom sync survive live use.
export function useSyncedCharts(aRef, bRef, enabled) {
  const syncingRef = useRef(false)
  useEffect(() => {
    if (!enabled) return
    let unsubs = []
    let lastAc = null
    let lastBc = null
    let cancelled = false

    function wire() {
      if (cancelled) return
      const ac = aRef.current?.getChart()
      const bc = bRef.current?.getChart()
      const as = aRef.current?.getSeries()
      const bs = bRef.current?.getSeries()
      if (!ac || !bc || !as || !bs) return
      if (ac === lastAc && bc === lastBc && unsubs.length) return // still wired
      unsubs.forEach((fn) => {
        try {
          fn()
        } catch (_) {}
      })
      unsubs = []
      lastAc = ac
      lastBc = bc

      function sub(src, tgt, srcS, tgtS) {
        const u = src.subscribeCrosshairMove((p) => {
          if (syncingRef.current) return
          syncingRef.current = true
          try {
            if (!p.time || !p.point) tgt.clearCrosshairPosition()
            else {
              const bar = p.seriesData?.get(srcS)
              const price = bar?.close ?? bar?.value ?? null
              if (price != null) tgt.setCrosshairPosition(price, p.time, tgtS)
            }
          } catch (_) {}
          syncingRef.current = false
        })
        if (u) unsubs.push(u)
      }
      sub(ac, bc, as, bs)
      sub(bc, ac, bs, as)

      const uA = ac.timeScale().subscribeVisibleLogicalRangeChange((r) => {
        if (syncingRef.current || !r) return
        syncingRef.current = true
        bc.timeScale().setVisibleLogicalRange(r)
        syncingRef.current = false
      })
      const uB = bc.timeScale().subscribeVisibleLogicalRangeChange((r) => {
        if (syncingRef.current || !r) return
        syncingRef.current = true
        ac.timeScale().setVisibleLogicalRange(r)
        syncingRef.current = false
      })
      if (uA) unsubs.push(uA)
      if (uB) unsubs.push(uB)
    }
    wire()
    // 400ms watcher: cheap no-op when instances are unchanged; re-wires after
    // any chart recreation (data switch, height settle, theme flip).
    const iv = setInterval(wire, 400)
    return () => {
      cancelled = true
      clearInterval(iv)
      unsubs.forEach((fn) => {
        try {
          fn()
        } catch (_) {}
      })
      unsubs = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, aRef, bRef])
}
