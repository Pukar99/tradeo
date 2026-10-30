// =============================================================================
// useCycleInsights.js — fetches Breakdown's cycle insights for the SELECTED
// cycles (one POST /cycle-analytics, debounced 400ms, abortable — Rule 45).
// Lifted out of the old CycleAnalyticsCards so both the center insights card
// and the right-panel stock deep dive read the same payload.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { getCycleAnalytics } from '../../../utils/globalCache'
import { cycleKey } from './useCycleSelection'

export function useCycleInsights(selectedCycles, indexId, sectorIndex) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ctrlRef = useRef(null)

  const sig = `${selectedCycles.map(cycleKey).join(',')}|${indexId}|${sectorIndex || ''}`

  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.abort()
    if (!selectedCycles.length) {
      setData(null)
      setLoading(false)
      setError('')
      return
    }
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      try {
        const r = await getCycleAnalytics({
          cycles: selectedCycles.map(({ start_date, end_date, type }) => ({
            start_date,
            end_date,
            type,
          })),
          index_id: indexId,
          ...(sectorIndex ? { sector_index: sectorIndex } : {}),
          n: 15,
        })
        if (ctrl.signal.aborted) return
        setData(r.data)
      } catch {
        if (ctrl.signal.aborted) return
        setError('Failed to load cycle analytics')
      }
      if (!ctrl.signal.aborted) setLoading(false)
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  return { data, loading, error, dismissError: () => setError('') }
}
