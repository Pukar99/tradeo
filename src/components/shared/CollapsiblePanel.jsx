// =============================================================================
// CollapsiblePanel.jsx — shared collapsible side panel (DataLab redesign S1).
// Lifted from ScreenPage's proven pattern (ScreenPage.jsx General mode):
// width-animated wrapper + .screen-panel-collapsed/.screen-panel-content CSS
// (index.css) + a slim absolutely-positioned chevron toggle on the center pane.
// State: usePanelOpen(storageKey) — localStorage-persisted, default open.
// =============================================================================

import { useLocalStorage } from '../../hooks/useLocalStorage'

export function usePanelOpen(storageKey) {
  const [open, setOpen] = useLocalStorage(storageKey, true)
  return [open, () => setOpen((o) => !o)]
}

// Side shadow mirrors ScreenPage: hairline + soft spread toward the center pane.
const SHADOW = {
  left: 'shadow-[1px_0_0_rgba(255,255,255,0.18),2px_0_12px_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_rgba(255,255,255,0.07),2px_0_16px_rgba(0,0,0,0.4)]',
  right:
    'shadow-[-1px_0_0_rgba(255,255,255,0.18),-2px_0_12px_rgba(0,0,0,0.06)] dark:shadow-[-1px_0_0_rgba(255,255,255,0.07),-2px_0_16px_rgba(0,0,0,0.4)]',
}

export function CollapsiblePanel({
  side,
  open,
  widthCls = 'w-[13%] min-w-[150px] max-w-[200px]',
  children,
}) {
  return (
    <div
      className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                  bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl ${SHADOW[side]}
                  transition-all duration-200 ease-in-out
                  ${open ? widthCls : 'w-0 min-w-0 max-w-0 overflow-hidden'}
                  ${!open ? 'screen-panel-collapsed' : ''}`}
    >
      <div className="screen-panel-content flex flex-col h-full">{children}</div>
    </div>
  )
}

// Chevron toggle — render inside the CENTER pane (parent must be `relative`),
// exactly like ScreenPage's toggles (ScreenPage.jsx:150-198).
export function PanelToggle({ side, open, onToggle, label = 'panel' }) {
  const isLeft = side === 'left'
  // Chevron points toward the panel when open, away when closed.
  const rotated = isLeft ? !open : open
  return (
    <button
      onClick={onToggle}
      title={`${open ? 'Hide' : 'Show'} ${label}`}
      className={`hidden lg:flex absolute ${isLeft ? 'left-0 rounded-r-lg border-r' : 'right-0 rounded-l-lg border-l'}
                  top-1/2 -translate-y-1/2 z-30 h-12 w-4 items-center justify-center
                  bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                  border-y border-gray-200/60 dark:border-gray-700/50
                  shadow-sm text-gray-400 dark:text-gray-500
                  hover:bg-white dark:hover:bg-gray-700
                  hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-150`}
    >
      <svg
        className={`w-2.5 h-2.5 transition-transform duration-200 ${rotated ? 'rotate-180' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}
