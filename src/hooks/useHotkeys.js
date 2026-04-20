import { useEffect } from 'react'

// Global keyboard shortcuts for power traders
// Only fires when no input/textarea/contenteditable is focused
export function useHotkeys(keyMap) {
  useEffect(() => {
    const handler = (e) => {
      // Ignore when typing in inputs
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return

      const key = e.key.toLowerCase()
      const combo = `${e.ctrlKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.altKey ? 'alt+' : ''}${key}`

      const action = keyMap[combo] || keyMap[key]
      if (action) {
        e.preventDefault()
        action(e)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [keyMap])
}
