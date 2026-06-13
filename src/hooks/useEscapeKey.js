// =============================================================================
// useEscapeKey.js — Calls handler when Escape is pressed. Null-safe.
// =============================================================================

import { useEffect } from 'react'

export function useEscapeKey(handler) {
  useEffect(() => {
    if (!handler) return
    const fn = (e) => {
      if (e.key === 'Escape') handler()
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [handler])
}
