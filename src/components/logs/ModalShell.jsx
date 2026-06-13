// === ModalShell.jsx — shared modal chrome: backdrop, panel, header, escape key ===
// Children render inside the panel (typically a <form> with overflow-y-auto flex-1).

import { useEscapeKey } from '../../hooks/useEscapeKey'

export default function ModalShell({
  title,
  subtitle,
  badge,
  onClose,
  maxWidth = 'max-w-md',
  zClass = 'z-50',
  closeOnBackdrop = false,
  children,
}) {
  useEscapeKey(onClose)

  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[92vh] flex flex-col`}
        onClick={closeOnBackdrop ? (e) => e.stopPropagation() : undefined}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
