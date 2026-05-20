import { useEffect, useRef } from 'react'

// Global keyboard shortcuts for power traders.
// Only fires when no input/textarea/contenteditable is focused.
// keyMap MUST be memoized by the caller (useMemo/useCallback) — the handler
// uses a ref internally so keyMap updates are picked up without re-subscribing.
export function useHotkeys(keyMap) {
  const keyMapRef = useRef(keyMap)
  useEffect(() => { keyMapRef.current = keyMap })

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return

      const key   = e.key.toLowerCase()
      const combo = `${e.ctrlKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.altKey ? 'alt+' : ''}${key}`

      const action = keyMapRef.current[combo] || keyMapRef.current[key]
      if (action) {
        e.preventDefault()
        action(e)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // stable — keyMap changes are picked up via keyMapRef
}
