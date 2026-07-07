// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { useCycleSelection, cycleKey } from '../../src/components/complex/breakdown/useCycleSelection'

const CYC = [
  { start_date: '2020-01-01', end_date: '2020-06-01', type: 'bull' },
  { start_date: '2020-06-01', end_date: '2021-01-01', type: 'bear' },
  { start_date: '2021-01-01', end_date: '2021-08-01', type: 'bull' },
]

describe('useCycleSelection', () => {
  test('defaults to all selected, no focus; resets on cycles change', () => {
    const { result, rerender } = renderHook(({ c }) => useCycleSelection(c), {
      initialProps: { c: CYC },
    })
    expect(result.current.selectedKeys.size).toBe(3)
    expect(result.current.focused).toBeNull()
    act(() => result.current.toggle(CYC[0]))
    rerender({ c: CYC.slice(0, 2) }) // new detect run
    expect(result.current.selectedKeys.size).toBe(2)
    expect(result.current.focused).toBeNull()
  })

  test('toggle: deselect; re-select focuses; deselect focused clears focus', () => {
    const { result } = renderHook(() => useCycleSelection(CYC))
    act(() => result.current.toggle(CYC[1])) // all→deselect bear
    expect(result.current.isSelected(CYC[1])).toBe(false)
    act(() => result.current.toggle(CYC[1])) // re-select → focused
    expect(result.current.focused).toEqual(CYC[1])
    act(() => result.current.toggle(CYC[1])) // deselect the focused one
    expect(result.current.isSelected(CYC[1])).toBe(false)
    expect(result.current.focused).toBeNull()
  })

  test('quick chips: bulls / bears / last bull / clear', () => {
    const { result } = renderHook(() => useCycleSelection(CYC))
    act(() => result.current.selectBears())
    expect([...result.current.selectedKeys]).toEqual([cycleKey(CYC[1])])
    act(() => result.current.selectBulls())
    expect(result.current.selectedKeys.size).toBe(2)
    act(() => result.current.selectLastBull())
    expect([...result.current.selectedKeys]).toEqual([cycleKey(CYC[2])])
    act(() => result.current.clear())
    expect(result.current.selectedKeys.size).toBe(0)
    expect(result.current.selectedCycles).toEqual([])
  })
})
