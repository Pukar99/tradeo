// =============================================================================
// useFetch.js — Reusable data-fetch hook with StrictMode-safe cancellation
// =============================================================================
// - setTimeout(0) lets StrictMode cleanup fire before the request fires,
//   preventing double-invoke from triggering two real API calls.
// - cancelledRef prevents stale state updates after unmount.
// - Returns { data, loading, error, refetch } — identical shape every time.
// - getFn must be stable (useCallback-wrapped by caller).
// - skip: true → don't fire (use for conditional fetching).
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { isCanceled, apiError } from '../utils/format'

export function useFetch(getFn, deps = [], { skip = false } = {}) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error,   setError]   = useState(null)
  const cancelledRef = useRef(false)

  const run = useCallback(() => {
    if (skip) { setLoading(false); return }
    cancelledRef.current = false
    setLoading(true)
    setError(null)

    let timer
    timer = setTimeout(() => {
      if (cancelledRef.current) return
      getFn()
        .then(res => {
          if (!cancelledRef.current) setData(res.data ?? res)
        })
        .catch(err => {
          if (!cancelledRef.current && !isCanceled(err)) setError(apiError(err))
        })
        .finally(() => {
          if (!cancelledRef.current) setLoading(false)
        })
    }, 0)

    return () => {
      cancelledRef.current = true
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps])

  useEffect(() => {
    const cleanup = run()
    return () => {
      cancelledRef.current = true
      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  return { data, loading, error, refetch: run }
}
