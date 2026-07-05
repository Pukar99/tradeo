// =============================================================================
// useDebounce.js — debounced value. One home for the hand-rolled setTimeout dance.
// =============================================================================
// const debouncedSearch = useDebounce(search, 300)
// → effects/keys depending on debouncedSearch fire only after typing pauses.

import { useState, useEffect } from 'react'

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
