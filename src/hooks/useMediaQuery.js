// =============================================================================
// useMediaQuery.js — matchMedia as state. One home for viewport checks.
// =============================================================================
// useIsMobile() uses design.md's Screen-toolbar gate: (max-width: 1023px) —
// i.e. everything below Tailwind `lg`. insight/helpers.jsx keeps its own useIsLg
// (min-width variant with documented mount rationale); both share this primitive shape.

import { useState, useEffect } from 'react'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = (e) => setMatches(e.matches)
    mq.addEventListener('change', fn)
    setMatches(mq.matches) // re-sync if query prop changed
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return matches
}

export const useIsMobile = () => useMediaQuery('(max-width: 1023px)')
