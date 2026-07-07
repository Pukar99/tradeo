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
  test('defaults to last-3-bulls selected, no focus; resets on cycles change', () => {
    const { result, rerender } = renderHook(({ c }) => useCycleSelection(c), {
      initialProps: { c: CYC },
    })
    // CYC has 2 bulls (idx 0, 2) + 1 bear (idx 1). Last-3-bulls of 2 bulls = both bulls.
    expect(result.current.selectedKeys.size).toBe(2)
    expect(result.current.isSelected(CYC[0])).toBe(true)
    expect(result.current.isSelected(CYC[2])).toBe(true)
    expect(result.current.isSelected(CYC[1])).toBe(false)
    expect(result.current.focused).toBeNull()
    act(() => result.current.toggle(CYC[0]))
    rerender({ c: CYC.slice(0, 2) }) // new detect run — 1 bull + 1 bear
    // Default rule re-applied: only the bull's key is selected.
    expect(result.current.selectedKeys.size).toBe(1)
    expect(result.current.isSelected(CYC[0])).toBe(true)
    expect(result.current.focused).toBeNull()
  })

  test('toggle: deselect; re-select focuses; deselect focused clears focus', () => {
    const { result } = renderHook(() => useCycleSelection(CYC))
    // Default is last-3-bulls, so the bear (CYC[1]) starts unselected.
    expect(result.current.isSelected(CYC[1])).toBe(false)
    act(() => result.current.toggle(CYC[1])) // select bear → focused
    expect(result.current.isSelected(CYC[1])).toBe(true)
    expect(result.current.focused).toEqual(CYC[1])
    act(() => result.current.toggle(CYC[1])) // deselect the focused one → clears focus
    expect(result.current.isSelected(CYC[1])).toBe(false)
    expect(result.current.focused).toBeNull()
    act(() => result.current.toggle(CYC[1])) // re-select → focused again
    expect(result.current.focused).toEqual(CYC[1])
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

  test('reset: returns to the default (last-3-bulls) selection and clears focus', () => {
    const { result } = renderHook(() => useCycleSelection(CYC))
    act(() => result.current.clear())
    expect(result.current.selectedKeys.size).toBe(0)
    act(() => result.current.reset())
    // CYC has 2 bulls (idx 0, 2) — default rule selects both, no bear.
    expect(result.current.selectedKeys.size).toBe(2)
    expect(result.current.isSelected(CYC[0])).toBe(true)
    expect(result.current.isSelected(CYC[2])).toBe(true)
    expect(result.current.isSelected(CYC[1])).toBe(false)
    expect(result.current.focused).toBeNull()
  })
})
