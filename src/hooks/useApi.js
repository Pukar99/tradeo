// =============================================================================
// useApi.js — The one shared home for the fetch → loading → error → data dance.
// Replaces the hand-rolled useState(loading)/try/catch/finally blocks in components.
// =============================================================================
// Usage:
//   const { data, loading, error, refetch, setData } = useApi(
//     async () => (await getPortfolio()).data,
//     [accountId]
//   )
// - fetcher: async fn returning the FINAL value to store (unwrap axios .data yourself).
// - deps: reactive inputs; changing them reloads (same contract as useEffect deps).
// - opts.enabled=false skips fetching (e.g., waiting for auth/params).
// - Cancellations are silent (isCanceled); errors become safe user text (apiError).
// - Stale responses are dropped via a sequence guard, so fast dep changes never
//   overwrite fresh data with an older response.

import { useState, useEffect, useCallback, useRef } from 'react'
import { isCanceled, apiError } from '../utils/format'

export function useApi(fetcher, deps = [], { enabled = true, initial = null } = {}) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(!!enabled)
  const [error, setError] = useState('')
  const seq = useRef(0)

  // Latest-ref pattern: refetch always calls the newest fetcher without needing it
  // in the dep list (an inline `async () => …` fetcher changes identity every render).
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    setError('')
    try {
      const result = await fetcherRef.current()
      if (id === seq.current) setData(result)
    } catch (err) {
      if (id === seq.current && !isCanceled(err)) setError(apiError(err))
    } finally {
      if (id === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps forwarded from caller (useEffect contract); fetcher read via ref
  }, deps)

  useEffect(() => {
    if (!enabled) return
    refetch()
    const guard = seq // ref object copied for cleanup (counter, not a DOM node)
    return () => {
      guard.current++ // drop any in-flight response when deps change/unmount
    }
  }, [enabled, refetch])

  return { data, loading, error, refetch, setData }
}
