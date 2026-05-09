import { useEffect } from 'react'

/**
 * Calls `handler` when the Escape key is pressed.
 * Safely handles null/undefined handler.
 * Usage: useEscapeKey(onClose)
 */
export function useEscapeKey(handler) {
  useEffect(() => {
    if (!handler) return
    const fn = (e) => { if (e.key === 'Escape') handler() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [handler])
}
