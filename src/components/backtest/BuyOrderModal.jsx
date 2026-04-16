import { useState, useEffect, useCallback } from 'react'
import { btPlaceOrder } from '../../api/backtest'

function calcFee(value, isSell = false) {
  let rate
  if      (value <= 50_000)     rate = 0.006
  else if (value <= 500_000)    rate = 0.0055
  else if (value <= 2_000_000)  rate = 0.005
  else if (value <= 10_000_000) rate = 0.0045
  else                           rate = 0.004
  return +(value * rate + value * 0.00015 + (isSell ? 25 : 0)).toFixed(2)
}

function addTradingDays(dateStr, days) {
  const HOLIDAYS = [
    '2024-01-11','2024-01-15','2024-02-19','2024-03-08','2024-03-25','2024-04-09',
    '2024-04-14','2024-05-01','2024-07-17','2024-08-19','2024-09-07','2024-10-02',
    '2024-10-12','2024-10-13','2024-10-14','2024-10-19','2024-11-15','2024-12-25',
    '2025-01-11','2025-02-19','2025-03-14','2025-03-30','2025-04-14','2025-05-01',
    '2026-01-11','2026-02-19','2026-04-14','2026-05-01',
  ]
  let date = new Date(dateStr + 'T00:00:00Z')
  let added = 0
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1)
    const d = date.toISOString().slice(0, 10)
    const day = date.getUTCDay()
    if (day !== 5 && day !== 6 && !HOLIDAYS.includes(d)) added++
  }
  return date.toISOString().slice(0, 10)
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function BuyOrderModal({ session, script, candle, onClose, onOrderPlaced }) {
  const [price, setPrice]   = useState(String(candle?.close || ''))
  const [qty, setQty]       = useState('100')
  const [sl, setSl]         = useState('')
  const [tp, setTp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const ep         = parseFloat(price) || 0
  const qtyInt     = parseInt(qty, 10) || 0
  const slVal      = sl ? parseFloat(sl) : null
  const tpVal      = tp ? parseFloat(tp) : null
  const cost       = ep * qtyInt
  const fee        = cost > 0 ? calcFee(cost, false) : 0
  const total      = cost + fee
  const availAfter = parseFloat(session.available_capital) - total
  const settlDate  = candle?.date ? addTradingDays(candle.date, 2) : '—'

  const rrRatio = slVal && tpVal && slVal < ep && tpVal > ep
    ? ((tpVal - ep) / (ep - slVal)).toFixed(2)
    : null

  const validate = useCallback(() => {
    if (!ep || ep <= 0)           return 'Enter a valid price'
    if (!qtyInt || qtyInt < 1)    return 'Enter a valid quantity'
    if (total > parseFloat(session.available_capital))
                                   return `Insufficient capital (need Rs.${fmt(total)})`
    if (slVal !== null && slVal >= ep) return 'SL must be below entry price'
    if (slVal !== null && slVal <= 0)  return 'SL must be positive'
    if (tpVal !== null && tpVal <= ep) return 'TP must be above entry price'
    if (slVal !== null && tpVal !== null && slVal === tpVal) return 'SL and TP cannot be equal'
    return null
  }, [ep, qtyInt, total, session, slVal, tpVal])

  const handleConfirm = useCallback(async () => {
    const err = validate()
    if (err) return setError(err)
    setLoading(true)
    setError('')
    try {
      const res = await btPlaceOrder(session.id, {
        script_id:   script.id,
        symbol:      script.symbol,
        entry_date:  candle.date,
        entry_price: ep,
        quantity:    qtyInt,
        sl:          slVal,
        tp:          tpVal,
      })
      onOrderPlaced(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }, [validate, session, script, candle, ep, qtyInt, slVal, tpVal, onOrderPlaced, onClose])

  // Escape key
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-72 p-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold dark:text-white">BUY ORDER — {script.symbol}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
        </div>

        <div className="text-[10px] text-gray-400 mb-3">
          Date: <span className="font-semibold text-gray-700 dark:text-gray-300">{candle?.date}</span>
        </div>

        <div className="flex flex-col gap-2 text-[11px]">
          {/* Price */}
          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Price (Rs.)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Quantity (kittā)</label>
            <input
              type="number"
              value={qty}
              min={1}
              step={1}
              onChange={e => setQty(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* SL */}
          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Stop-Loss (Rs.) <span className="text-gray-400 normal-case font-normal">optional</span></label>
            <input
              type="number"
              value={sl}
              onChange={e => setSl(e.target.value)}
              placeholder="e.g. 1200"
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-red-400"
            />
            {!sl && <div className="text-[9px] text-orange-500 mt-0.5">⚠ No SL — high risk</div>}
          </div>

          {/* TP */}
          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Take-Profit (Rs.) <span className="text-gray-400 normal-case font-normal">optional</span></label>
            <input
              type="number"
              value={tp}
              onChange={e => setTp(e.target.value)}
              placeholder="e.g. 1400"
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-green-400"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-[10px] space-y-0.5">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Cost</span><span className="font-semibold dark:text-gray-300">Rs.{fmt(cost)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Broker Fee</span><span className="font-semibold dark:text-gray-300">Rs.{fmt(fee)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-100 dark:border-gray-700 pt-0.5 dark:text-white">
            <span>Total</span><span>Rs.{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Avail after</span>
            <span className={availAfter < 0 ? 'text-red-500 font-semibold' : 'dark:text-gray-300'}>
              Rs.{fmt(availAfter)}
            </span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Settlement</span><span className="dark:text-gray-300">{settlDate}</span>
          </div>
          {rrRatio && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>R:R</span>
              <span className={`font-semibold ${parseFloat(rrRatio) >= 2 ? 'text-green-600' : 'text-orange-500'}`}>
                1 : {rrRatio} {parseFloat(rrRatio) >= 2 ? '✅' : '⚠'}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-1.5 text-[11px] font-bold rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Buying…' : 'Confirm BUY'}
          </button>
        </div>
      </div>
    </div>
  )
}
