// =============================================================================
// useLightweightChart.js — shared lightweight-charts lifecycle.
// One home for the init dance every chart file used to hand-write:
//   delay → dynamic import('lightweight-charts') → createChart → resize listener
//   → cleanup (remove listener + chart.remove()) — with cancellation guards at
//   every await so fast unmounts never touch a dead container.
// Also fixes the old copy-pasted leak: the resize listener is now actually
// removed on unmount (the inline versions returned the remover into the void).
// =============================================================================
// Usage (theme/options stay 100% caller-owned — charts differ deliberately):
//   const { chartRef, ready } = useLightweightChart({
//     containerRef,
//     delayMs: 80,             // preserve each chart's original init delay
//     fallbackWidth: 400,      // preserve each chart's original width fallback
//     buildOptions: () => ({ height, ...themeOptions }),   // no `width` — hook sets it
//     setup: (chart, lc) => {  // add series + subscriptions; store refs here
//       seriesRef.current = chart.addCandlestickSeries(candleSeriesOptions())
//       return () => { seriesRef.current = null }          // optional cleanup
//     },
//     enabled: !fixed,         // false = do nothing (container not rendered)
//   })
// buildOptions/setup are read through latest-refs — inline closures are fine and
// always see fresh props; changing them never re-inits the chart (init-once).

import { useEffect, useRef, useState } from 'react'

export function useLightweightChart({
  containerRef,
  buildOptions,
  setup,
  delayMs = 100,
  fallbackWidth = 400,
  enabled = true,
}) {
  const chartRef = useRef(null)
  const [ready, setReady] = useState(false)

  const buildRef = useRef(buildOptions)
  buildRef.current = buildOptions
  const setupRef = useRef(setup)
  setupRef.current = setup

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let onResize = null
    let setupCleanup = null

    const init = async () => {
      try {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
        if (cancelled || !containerRef.current) return

        const lc = await import('lightweight-charts')
        if (cancelled || !containerRef.current) return

        const chart = lc.createChart(containerRef.current, {
          width: containerRef.current.clientWidth || fallbackWidth,
          ...(buildRef.current ? buildRef.current() : {}),
        })

        onResize = () => {
          if (containerRef.current && chart)
            chart.applyOptions({ width: containerRef.current.clientWidth || fallbackWidth })
        }
        window.addEventListener('resize', onResize)

        chartRef.current = chart
        setupCleanup = setupRef.current?.(chart, lc) || null
        if (!cancelled) setReady(true)
      } catch (err) {
        console.error('Chart init error:', err)
      }
    }

    init()
    return () => {
      cancelled = true
      if (onResize) window.removeEventListener('resize', onResize)
      if (setupCleanup) {
        try {
          setupCleanup()
        } catch {
          /* setup cleanup must never block chart disposal */
        }
      }
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once per mount (matches the inline [] effects this replaces); delay/fallback/refs are init-only
  }, [enabled])

  return { chartRef, ready }
}
