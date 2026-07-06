// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react'
import { describe, test, expect, beforeEach } from 'vitest'
import {
  DataLabControlsProvider,
  useDataLabControls,
} from '../../src/components/datalab/DataLabControls'

const wrapper = ({ children }) => <DataLabControlsProvider>{children}</DataLabControlsProvider>

beforeEach(() => sessionStorage.clear())

describe('DataLabControls', () => {
  test('defaults: empty symbol, threshold 10', () => {
    const { result } = renderHook(() => useDataLabControls(), { wrapper })
    expect(result.current.symbol).toBe('')
    expect(result.current.threshold).toBe(10)
  })
  test('setSymbol uppercases + persists; setThreshold clamps 5..50 + persists', () => {
    const { result } = renderHook(() => useDataLabControls(), { wrapper })
    act(() => result.current.setSymbol('nabil'))
    expect(result.current.symbol).toBe('NABIL')
    expect(sessionStorage.getItem('tradeo_datalab_symbol')).toBe('NABIL')
    act(() => result.current.setThreshold(99))
    expect(result.current.threshold).toBe(50)
    act(() => result.current.setThreshold(1))
    expect(result.current.threshold).toBe(5)
    expect(sessionStorage.getItem('tradeo_datalab_threshold')).toBe('5')
  })
  test('throws outside provider (guards silent misuse)', () => {
    expect(() => renderHook(() => useDataLabControls())).toThrow()
  })
})
