// @vitest-environment happy-dom
// (jsdom hits ERR_REQUIRE_ESM here — see vite.config.js test env note; happy-dom doesn't)
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useApi } from '../../src/hooks/useApi'
import { useDebounce } from '../../src/hooks/useDebounce'
import { useLocalStorage } from '../../src/hooks/useLocalStorage'
import { useMediaQuery } from '../../src/hooks/useMediaQuery'

describe('useApi', () => {
  test('success: loading → data', async () => {
    const { result } = renderHook(() => useApi(async () => ({ n: 42 }), []))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ n: 42 })
    expect(result.current.error).toBe('')
  })

  test('failure: safe error text, no data', async () => {
    const { result } = renderHook(() =>
      useApi(async () => {
        throw { response: { data: { error: 'Symbol not found' } } }
      }, [])
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Symbol not found')
    expect(result.current.data).toBe(null)
  })

  test('cancellation is silent (no error)', async () => {
    const { result } = renderHook(() =>
      useApi(async () => {
        throw { name: 'AbortError' }
      }, [])
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('')
  })

  test('enabled=false does not fetch', async () => {
    const fetcher = vi.fn(async () => 1)
    const { result } = renderHook(() => useApi(fetcher, [], { enabled: false }))
    expect(result.current.loading).toBe(false)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('refetch reloads and setData patches locally', async () => {
    let n = 0
    const { result } = renderHook(() => useApi(async () => ++n, []))
    await waitFor(() => expect(result.current.data).toBe(1))
    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toBe(2)
    act(() => result.current.setData(99))
    expect(result.current.data).toBe(99)
  })
})

describe('useDebounce', () => {
  test('only settles after the delay', async () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    })
    expect(result.current).toBe('a')
    rerender({ v: 'ab' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a') // not yet
    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('ab')
    vi.useRealTimers()
  })
})

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear())

  test('default when empty; JSON round-trip on set', () => {
    const { result } = renderHook(() => useLocalStorage('k1', 'candle'))
    expect(result.current[0]).toBe('candle')
    act(() => result.current[1]('line'))
    expect(result.current[0]).toBe('line')
    expect(localStorage.getItem('k1')).toBe('"line"')
  })

  test('legacy RAW string values survive (backward-compat read)', () => {
    localStorage.setItem('k2', 'candle') // old code stored raw, not JSON
    const { result } = renderHook(() => useLocalStorage('k2', 'fallback'))
    expect(result.current[0]).toBe('candle')
  })

  test('stored JSON objects parse', () => {
    localStorage.setItem('k3', JSON.stringify({ a: 1 }))
    const { result } = renderHook(() => useLocalStorage('k3', null))
    expect(result.current[0]).toEqual({ a: 1 })
  })
})

describe('useMediaQuery', () => {
  test('reflects matchMedia and reacts to change events', () => {
    let listener = null
    const mql = {
      matches: false,
      addEventListener: (_ev, fn) => {
        listener = fn
      },
      removeEventListener: () => {},
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql)
    )
    const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'))
    expect(result.current).toBe(false)
    act(() => listener({ matches: true }))
    expect(result.current).toBe(true)
    vi.unstubAllGlobals()
  })
})
