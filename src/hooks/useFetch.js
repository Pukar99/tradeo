import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Reusable data-fetch hook with StrictMode-safe cancellation.
 *
 * Behaviour:
 * - Uses setTimeout(0) so React StrictMode's cleanup fires before the request,
 *   preventing the double-invoke from triggering two real API calls.
 * - `cancelled` ref prevents stale state updates on unmounted components.
 * - Returns { data, loading, error, refetch } — identical shape every time.
 *
 * @param {() => Promise} getFn  — a function that returns a promise (e.g. an API call)
 * @param {any[]}         deps   — useEffect dependency array; getFn must be stable (useCallback)
 * @param {{ skip?: boolean }} opts
 *   - skip: true → don't fire the request (use for conditional fetching)
 */
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
          if (!cancelledRef.current) setError(err)
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
