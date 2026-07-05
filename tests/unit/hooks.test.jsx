// @vitest-environment happy-dom
// (jsdom hits ERR_REQUIRE_ESM here — see vite.config.js test env note; happy-dom doesn't)
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '../../src/hooks/useLocalStorage'

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
