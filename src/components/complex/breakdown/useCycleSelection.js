// =============================================================================
// useCycleSelection.js — Breakdown cycle multi-select (spec §5.3, S2b).
// Two concepts: the SELECTION SET (drives Top Movers + Consistency) and the
// FOCUSED cycle (last-clicked selected cycle; drives right-panel drill-down).
// Default on every new detect run: last 3 bull cycles selected (owner decision
// 2026-07-07 — bulls are what most users want to review first); falls back to
// all cycles selected if there are no bulls (never an empty default).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'

export const cycleKey = (c) => `${c.start_date}|${c.end_date}`

// Shared by initial state + the reset-on-cycles-change effect so the default
// rule only lives in one place (owner decision 2026-07-07).
function defaultKeys(cycles) {
  const bulls = cycles.filter((c) => c.type === 'bull').slice(-3)
  return bulls.length ? bulls.map(cycleKey) : cycles.map(cycleKey)
}

export function useCycleSelection(cycles) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(defaultKeys(cycles)))
  const [focused, setFocused] = useState(null)

  // New detect run (threshold/index change) → reset to the default selection, no focus.
  const cyclesSig = useMemo(() => cycles.map(cycleKey).join(','), [cycles])
  useEffect(() => {
    setSelectedKeys(new Set(defaultKeys(cycles)))
    setFocused(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyclesSig])

  const isSelected = useCallback((c) => selectedKeys.has(cycleKey(c)), [selectedKeys])

  const toggle = useCallback(
    (c) => {
      const key = cycleKey(c)
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        // Side effect in an updater: safe here because both branches below are
        // idempotent under StrictMode double-invocation — do not add non-idempotent logic.
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

  // Owner addition (S3): toolbar Reset — selection back to the default rule
  // (last 3 bulls; all if no bulls), focus cleared.
  const reset = useCallback(() => {
    setKeys(defaultKeys(cycles))
    setFocused(null)
  }, [cyclesSig]) // eslint-disable-line react-hooks/exhaustive-deps

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
    reset,
    selectedCycles,
  }
}
