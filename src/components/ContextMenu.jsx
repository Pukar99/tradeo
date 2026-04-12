import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ── Global Context Menu ───────────────────────────────────────────────────────
// Usage:
//   const { onContextMenu, ContextMenuPortal } = useContextMenu()
//
//   <div onContextMenu={onContextMenu({ items: [
//     { label: 'Edit', icon: '✏️', action: () => ... },
//     { label: 'Delete', icon: '🗑️', danger: true, action: () => ... },
//   ]})}>...</div>
//   <ContextMenuPortal />

function Menu({ x, y, items, onClose }) {
  const [confirmIdx, setConfirmIdx] = useState(null)
  const ref = useRef(null)

  // Adjust position so menu stays inside viewport
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      x: Math.min(x, window.innerWidth  - width  - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    })
  }, [x, y])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const keyHandler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[148px] py-1"
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className="my-1 border-t border-gray-100 dark:border-gray-800" />

        const isDanger = item.danger
        const isConfirming = confirmIdx === i

        if (isDanger && isConfirming) {
          return (
            <div key={i} className="px-3 py-2 bg-red-50 dark:bg-red-950/40">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mb-1.5">Sure? This can't be undone.</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { item.action(); onClose() }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold py-1 rounded-lg transition-colors"
                >Delete</button>
                <button
                  onClick={() => setConfirmIdx(null)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-semibold py-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                >Cancel</button>
              </div>
            </div>
          )
        }

        return (
          <button
            key={i}
            onClick={() => {
              if (isDanger) { setConfirmIdx(i); return }
              item.action()
              onClose()
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors text-left
              ${isDanger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
          >
            <span className="text-[13px] leading-none">{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function useContextMenu() {
  const [menu, setMenu] = useState(null) // { x, y, items }

  const close = useCallback(() => setMenu(null), [])

  // Returns an onContextMenu handler bound to a set of items
  const onContextMenu = useCallback((items) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }, [])

  const ContextMenuPortal = useCallback(() => {
    if (!menu) return null
    return createPortal(
      <Menu x={menu.x} y={menu.y} items={menu.items} onClose={close} />,
      document.body
    )
  }, [menu, close])

  return { onContextMenu, ContextMenuPortal }
}
