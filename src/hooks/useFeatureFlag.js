/**
 * useFeatureFlag(flagName) — returns true if the named flag is enabled.
 *
 * Reads from the public /api/feature-flags endpoint (no auth required).
 * Result is cached in module-level memory for 60s to avoid per-component fetches.
 * Defaults to false while loading or on error (fail-closed for feature gating).
 */

import { useState, useEffect } from 'react'
import { API } from '@api/index'

let _cache = null
let _cacheTs = 0
const TTL = 60_000

async function _getFlags() {
  if (_cache && Date.now() - _cacheTs < TTL) return _cache
  try {
    const { data } = await API.get('/api/feature-flags')
    _cache = data.flags || []
    _cacheTs = Date.now()
  } catch {
    _cache = _cache || [] // keep stale on error
  }
  return _cache
}

export function useFeatureFlag(flagName) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    _getFlags().then((flags) => {
      if (!cancelled) setEnabled(flags.includes(flagName))
    })
    return () => {
      cancelled = true
    }
  }, [flagName])

  return enabled
}
