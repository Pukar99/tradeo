import { useEffect, useRef } from 'react'

export default function AnalysisMobilePanels({ panel, setPanel, left, right }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!panel) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    document.body.style.overflow = 'hidden'
    const focusable = dialog?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.[0]?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPanel(null)
        return
      }
      if (event.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog?.addEventListener('keydown', onKeyDown)
    return () => {
      dialog?.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [panel, setPanel])

  const tabs = [
    { id: null, label: 'Chart' },
    { id: 'left', label: 'Setup' },
    { id: 'right', label: 'Signals' },
  ]

  return (
    <>
      <div className="lg:hidden shrink-0 flex border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 z-30">
        {tabs.map((tab) => (
          <button
            key={String(tab.id)}
            onClick={() => setPanel(tab.id)}
            className={`flex-1 py-2.5 text-[10px] font-semibold ${panel === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {panel && (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={() => setPanel(null)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="analysis-mobile-panel-title"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-800"
            style={{ height: '68vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span
                id="analysis-mobile-panel-title"
                className="text-[13px] font-bold text-gray-800 dark:text-gray-100"
              >
                {panel === 'left' ? 'Setup & Zones' : 'Signals & Analysis'}
              </span>
              <button
                onClick={() => setPanel(null)}
                aria-label="Close panel"
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">{panel === 'left' ? left : right}</div>
          </div>
        </>
      )}
    </>
  )
}
