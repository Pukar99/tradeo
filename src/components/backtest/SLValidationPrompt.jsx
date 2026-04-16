import { useEffect } from 'react'

/**
 * Shown in two scenarios:
 *  type = 'PRE_SETTLEMENT_SL' — SL hit before T+2 cleared
 *  type = 'MANUAL_SL'         — SL hit after settlement, Manual mode
 *  type = 'PRE_SETTLEMENT_TP' — TP hit before T+2 cleared
 */
export default function SLValidationPrompt({ prompt, onClose }) {
  const { type, pos, candle, options } = prompt

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const isPreSettlement = type === 'PRE_SETTLEMENT_SL' || type === 'PRE_SETTLEMENT_TP'
  const isTP = type === 'PRE_SETTLEMENT_TP'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-76 p-4 border-2 ${
        isPreSettlement ? 'border-orange-400' : 'border-red-400'
      }`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{isPreSettlement ? '⚠️' : isTP ? '🎯' : '🛑'}</span>
          <div>
            <div className={`text-[12px] font-bold ${isPreSettlement ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
              {type === 'PRE_SETTLEMENT_SL' && 'SL Hit — Not Yet Settled'}
              {type === 'PRE_SETTLEMENT_TP' && 'TP Hit — Not Yet Settled'}
              {type === 'MANUAL_SL'         && 'Stop-Loss Triggered'}
            </div>
            <div className="text-[10px] text-gray-400">Playback paused</div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 text-[10px] space-y-1 mb-3">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Symbol</span>
            <span className="font-bold dark:text-white">{pos.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Date</span>
            <span className="font-semibold dark:text-gray-300">{candle?.date}</span>
          </div>
          {pos.sl && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">SL</span>
              <span className="font-semibold text-red-500">Rs.{pos.sl}</span>
            </div>
          )}
          {pos.tp && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">TP</span>
              <span className="font-semibold text-green-600">Rs.{pos.tp}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Today's Low</span>
            <span className="font-semibold dark:text-gray-300">Rs.{candle?.low}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Today's Close</span>
            <span className="font-semibold dark:text-gray-300">Rs.{candle?.close}</span>
          </div>
          {isPreSettlement && (
            <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-1">
              <span className="text-orange-500 font-semibold">Settlement Date</span>
              <span className="font-bold text-orange-500">{pos.settlement_date?.slice(0, 10)}</span>
            </div>
          )}
        </div>

        {/* Explanation */}
        {isPreSettlement && (
          <div className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 rounded-md px-2 py-1.5 mb-3 leading-tight">
            {isTP
              ? 'TP reached but T+2 settlement is not yet cleared. You cannot sell under NEPSE rules.'
              : 'SL was breached but T+2 settlement is not cleared. You cannot sell under NEPSE rules.'
            }
          </div>
        )}

        {type === 'MANUAL_SL' && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-tight">
            Your stop-loss has been breached. Position is settled. Choose an action.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={opt.action}
              className={`w-full py-1.5 text-[10px] font-semibold rounded-md transition-colors ${
                i === 0
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : i === options.length - 1
                    ? 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    : 'border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {options.some(o => o.label.toLowerCase().includes('ignore')) && (
          <div className="text-[9px] text-gray-400 text-center mt-2">
            ⚠ Ignoring is logged in your behavior report
          </div>
        )}
      </div>
    </div>
  )
}
