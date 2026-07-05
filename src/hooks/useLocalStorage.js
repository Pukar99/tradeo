// =============================================================================
// useLocalStorage.js — persistent useState. One home for raw localStorage access.
// =============================================================================
// const [chartType, setChartType] = useLocalStorage('screen.chartType', 'candle')
//
// BACKWARD-COMPAT: older code stored RAW strings (not JSON). The read path is
// lenient — if JSON.parse fails, the raw string is returned as-is, so a user's
// previously saved settings survive the migration to this hook. Writes are
// always JSON, so values round-trip cleanly from then on.
// Storage errors (quota, private mode) never throw — the state still works
// in-memory for the session.

import { useState, useEffect } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return defaultValue
      try {
        return JSON.parse(raw)
      } catch {
        return raw // legacy raw-string value
      }
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota/private mode — keep in-memory state */
    }
  }, [key, value])

  return [value, setValue]
}
