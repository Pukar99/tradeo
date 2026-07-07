// =============================================================================
// useCycleSelection.js — Breakdown cycle multi-select (spec §5.3, S2b).
// Two concepts: the SELECTION SET (drives Top Movers + Consistency) and the
// FOCUSED cycle (last-clicked selected cycle; drives right-panel drill-down).
// Default on every new detect run: all cycles selected, nothing focused.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'

export const cycleKey = (c) => `${c.start_date}|${c.end_date}`

export function useCycleSelection(cycles) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(cycles.map(cycleKey)))
  const [focused, setFocused] = useState(null)

  // New detect run (threshold/index change) → reset to all-selected, no focus.
  const cyclesSig = useMemo(() => cycles.map(cycleKey).join(','), [cycles])
  useEffect(() => {
    setSelectedKeys(new Set(cycles.map(cycleKey)))
    setFocused(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyclesSig])

  const isSelected = useCallback((c) => selectedKeys.has(cycleKey(c)), [selectedKeys])

  const toggle = useCallback(
    (c) => {
      const key = cycleKey(c)
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
          setFocused((f) => (f && cycleKey(f) === key ? null : f))
        } else {
          next.add(key)
          setFocused(c)
        }
        return next
      })
    },
    []
  )

  const setKeys = (keys) => setSelectedKeys(new Set(keys))
  const selectAll = useCallback(() => setKeys(cycles.map(cycleKey)), [cyclesSig]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectBulls = useCallback(
    () => setKeys(cycles.filter((c) => c.type === 'bull').map(cycleKey)),
    [cyclesSig] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const selectBears = useCallback(
    () => setKeys(cycles.filter((c) => c.type === 'bear').map(cycleKey)),
    [cyclesSig] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const selectLastBull = useCallback(() => {
    const bulls = cycles.filter((c) => c.type === 'bull')
    setKeys(bulls.length ? [cycleKey(bulls[bulls.length - 1])] : [])
  }, [cyclesSig]) // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback(() => {
    setKeys([])
    setFocused(null)
  }, [])

  const selectedCycles = useMemo(
    () => cycles.filter((c) => selectedKeys.has(cycleKey(c))),
    [cyclesSig, selectedKeys] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return {
    selectedKeys,
    focused,
    setFocused,
    isSelected,
    toggle,
    selectAll,
    selectBulls,
    selectBears,
    selectLastBull,
    clear,
    selectedCycles,
  }
}
