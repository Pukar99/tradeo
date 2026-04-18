import { useState, useEffect, useCallback } from 'react'

// Single toast — auto-dismisses after 8s
function Toast({ alert, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const isAbove = alert.direction === 'above'

  return (
    <div className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl px-4 py-3 w-72 animate-fade-up">
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isAbove ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
        <span className="text-[16px]">{isAbove ? '🎯' : '⚠️'}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-gray-900 dark:text-white">
          {alert.symbol} — Alert Triggered
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
          LTP <span className="font-semibold text-gray-800 dark:text-gray-200">Rs.{alert.ltp.toLocaleString()}</span>
          {' '}{isAbove ? 'reached' : 'near'} your target{' '}
          <span className={`font-semibold ${isAbove ? 'text-emerald-500' : 'text-amber-500'}`}>
            Rs.{alert.price_alert.toLocaleString()}
          </span>
        </p>
        {alert.pct_change != null && (
          <p className={`text-[9px] font-semibold mt-0.5 ${alert.pct_change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {alert.pct_change >= 0 ? '+' : ''}{alert.pct_change.toFixed(2)}% today
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors flex-shrink-0 mt-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Container — stacks toasts in bottom-right corner
export function PriceAlertContainer({ alerts, onDismiss }) {
  if (!alerts.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {alerts.map((alert, i) => (
        <div key={`${alert.id}_${i}`} className="pointer-events-auto">
          <Toast alert={alert} onDismiss={() => onDismiss(i)} />
        </div>
      ))}
    </div>
  )
}

// Hook for managing toast queue
export function useAlertToasts() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((alert) => {
    setToasts(prev => [...prev, alert])
  }, [])

  const dismissToast = useCallback((idx) => {
    setToasts(prev => prev.filter((_, i) => i !== idx))
  }, [])

  return { toasts, addToast, dismissToast }
}
