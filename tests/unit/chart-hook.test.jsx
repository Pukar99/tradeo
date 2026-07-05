// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { useLightweightChart } from '../../src/hooks/useLightweightChart'
import {
  candleSeriesOptions,
  CANDLE_UP,
  CANDLE_DOWN,
} from '../../src/utils/chartTheme'

const removeSpy = vi.fn()
const applyOptionsSpy = vi.fn()
let lastCreateArgs = null

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn((container, options) => {
    lastCreateArgs = { container, options }
    return { remove: removeSpy, applyOptions: applyOptionsSpy }
  }),
}))

function useHarness(hookOpts = {}) {
  const containerRef = useRef(document.createElement('div'))
  return useLightweightChart({ containerRef, delayMs: 0, ...hookOpts })
}

describe('candleSeriesOptions', () => {
  test('expands up/down into the full 6-property block', () => {
    expect(candleSeriesOptions('#111', '#222')).toEqual({
      upColor: '#111',
      downColor: '#222',
      borderUpColor: '#111',
      borderDownColor: '#222',
      wickUpColor: '#111',
      wickDownColor: '#222',
    })
  })
  test('defaults to the dominant pair; extra options merge on top', () => {
    const o = candleSeriesOptions(undefined, undefined, { priceLineVisible: false })
    expect(o.upColor).toBe(CANDLE_UP)
    expect(o.downColor).toBe(CANDLE_DOWN)
    expect(o.priceLineVisible).toBe(false)
  })
})

describe('useLightweightChart', () => {
  beforeEach(() => {
    removeSpy.mockClear()
    applyOptionsSpy.mockClear()
    lastCreateArgs = null
  })

  test('creates chart with buildOptions + width, runs setup, flips ready', async () => {
    const setup = vi.fn(() => undefined)
    const { result } = renderHook(() =>
      useHarness({ fallbackWidth: 640, buildOptions: () => ({ height: 200 }), setup })
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(lastCreateArgs.options).toMatchObject({ height: 200, width: 640 }) // detached div → fallback width
    expect(setup).toHaveBeenCalledTimes(1)
    expect(result.current.chartRef.current).not.toBe(null)
  })

  test('unmount removes the chart and runs setup cleanup', async () => {
    const setupCleanup = vi.fn()
    const { result, unmount } = renderHook(() => useHarness({ setup: () => setupCleanup }))
    await waitFor(() => expect(result.current.ready).toBe(true))
    unmount()
    expect(setupCleanup).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)
  })

  test('enabled=false does nothing', async () => {
    const setup = vi.fn()
    const { result } = renderHook(() => useHarness({ enabled: false, setup }))
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.ready).toBe(false)
    expect(setup).not.toHaveBeenCalled()
  })

  test('fast unmount before init completes never creates a chart', async () => {
    const setup = vi.fn()
    const { unmount } = renderHook(() => useHarness({ delayMs: 30, setup }))
    unmount() // during the delay
    await new Promise((r) => setTimeout(r, 60))
    expect(setup).not.toHaveBeenCalled()
    expect(removeSpy).not.toHaveBeenCalled()
  })
})
