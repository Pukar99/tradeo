import { useState, useEffect, useCallback } from 'react'
import { btUpdateSLTP } from '../../api/backtest'

export default function SLTPUpdateModal({ session, order, onClose, onUpdated }) {
  const ep = parseFloat(order.entry_price)
  const [sl, setSl] = useState(order.sl ? String(order.sl) : '')
  const [tp, setTp] = useState(order.tp ? String(order.tp) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const slVal = sl ? parseFloat(sl) : null
  const tpVal = tp ? parseFloat(tp) : null

  const slValid = slVal === null || slVal < ep
  const tpValid = tpVal === null || tpVal > ep
  const bothNeq = slVal === null || tpVal === null || slVal !== tpVal

  const handleUpdate = useCallback(async () => {
    setError('')
    if (slVal !== null && slVal >= ep) return setError(`SL must be below entry price Rs.${ep}`)
    if (slVal !== null && slVal <= 0)  return setError('SL must be positive')
    if (tpVal !== null && tpVal <= ep) return setError(`TP must be above entry price Rs.${ep}`)
    if (slVal !== null && tpVal !== null && slVal === tpVal) return setError('SL and TP cannot be equal')

    setLoading(true)
    try {
      const res = await btUpdateSLTP(session.id, order.id, { sl: slVal, tp: tpVal })
      onUpdated(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update SL/TP')
    } finally {
      setLoading(false)
    }
  }, [session, order, slVal, tpVal, ep, onUpdated, onClose])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-64 p-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] font-bold dark:text-white">SL/TP — {order.symbol}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
        </div>

        <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">
          Entry: <span className="font-semibold text-gray-800 dark:text-gray-200">Rs.{ep}</span> (fixed)
        </div>

        <div className="flex flex-col gap-2 text-[11px]">
          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Stop-Loss (Rs.)</label>
            <input
              type="number"
              value={sl}
              onChange={e => setSl(e.target.value)}
              placeholder="Leave blank to clear"
              className={`mt-0.5 w-full px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 ${
                slValid ? 'border-gray-200 dark:border-gray-700 focus:ring-red-400' : 'border-red-400 focus:ring-red-500'
              }`}
            />
            {!slValid && <div className="text-[9px] text-red-500 mt-0.5">Must be below Rs.{ep}</div>}
          </div>

          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Take-Profit (Rs.)</label>
            <input
              type="number"
              value={tp}
              onChange={e => setTp(e.target.value)}
              placeholder="Leave blank to clear"
              className={`mt-0.5 w-full px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 ${
                tpValid ? 'border-gray-200 dark:border-gray-700 focus:ring-green-400' : 'border-red-400 focus:ring-red-500'
              }`}
            />
            {!tpValid && <div className="text-[9px] text-red-500 mt-0.5">Must be above Rs.{ep}</div>}
          </div>
        </div>

        {!bothNeq && <div className="text-[9px] text-red-500 mt-1">SL and TP cannot be equal</div>}

        {error && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">{error}</div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={onClose}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading || !slValid || !tpValid || !bothNeq}
            className="flex-1 py-1.5 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
