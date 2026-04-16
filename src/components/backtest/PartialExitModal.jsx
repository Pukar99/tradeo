import { useState, useEffect, useCallback } from 'react'
import { btPartialExit } from '../../api/backtest'

function calcFee(value) {
  let rate
  if      (value <= 50_000)     rate = 0.006
  else if (value <= 500_000)    rate = 0.0055
  else if (value <= 2_000_000)  rate = 0.005
  else if (value <= 10_000_000) rate = 0.0045
  else                           rate = 0.004
  return +(value * rate + value * 0.00015 + 25).toFixed(2) // sell: +DP 25
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

const REASONS = ['MANUAL', 'TP_HIT', 'SL_HIT', 'OTHER']

export default function PartialExitModal({ session, order, candle, onClose, onExited }) {
  const ep       = parseFloat(order.entry_price)
  const remQty   = order.remaining_quantity ?? order.quantity
  const [exitQty,   setExitQty]   = useState(String(Math.floor(remQty / 2)))
  const [exitPrice, setExitPrice] = useState(String(candle?.close || ''))
  const [reason,    setReason]    = useState('MANUAL')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const xQty   = parseInt(exitQty, 10) || 0
  const xPrice = parseFloat(exitPrice) || 0
  const grossVal = xQty * xPrice
  const fee      = grossVal > 0 ? calcFee(grossVal) : 0
  const proceeds = grossVal - fee
  const partialPnl = xQty * (xPrice - ep) - fee
  const remaining  = remQty - xQty

  const handleConfirm = useCallback(async () => {
    setError('')
    if (!xQty || xQty < 1)       return setError('Enter a valid quantity')
    if (xQty > remQty)            return setError(`Cannot exit ${xQty} — only ${remQty} remaining`)
    if (!xPrice || xPrice <= 0)   return setError('Enter a valid exit price')

    setLoading(true)
    try {
      const res = await btPartialExit(session.id, order.id, {
        exit_date:     candle.date,
        exit_price:    xPrice,
        exit_quantity: xQty,
        reason,
      })
      onExited(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to exit')
    } finally {
      setLoading(false)
    }
  }, [session, order, candle, xQty, xPrice, reason, remQty, onExited, onClose])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-68 p-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] font-bold dark:text-white">PARTIAL EXIT — {order.symbol}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
        </div>

        <div className="text-[10px] text-gray-400 mb-2">
          Holding: <span className="font-bold text-gray-800 dark:text-gray-200">{remQty} kittā</span>
        </div>

        <div className="flex flex-col gap-2 text-[11px]">
          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Exit Qty (kittā)</label>
            <input
              type="number"
              value={exitQty}
              min={1}
              max={remQty}
              step={1}
              onChange={e => setExitQty(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
            />
            {xQty > remQty && (
              <div className="text-[9px] text-red-500 mt-0.5">Cannot exceed {remQty}</div>
            )}
          </div>

          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Exit Price (Rs.)</label>
            <input
              type="number"
              value={exitPrice}
              onChange={e => setExitPrice(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="text-[9px] font-semibold text-gray-400 uppercase">Reason</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none text-[11px]"
            >
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-[10px] space-y-0.5">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Gross</span><span className="dark:text-gray-300">Rs.{fmt(grossVal)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Fee (sell)</span><span className="dark:text-gray-300">Rs.{fmt(fee)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-100 dark:border-gray-700 pt-0.5 dark:text-white">
            <span>Proceeds</span><span>Rs.{fmt(proceeds)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Partial P&L</span>
            <span className={`font-semibold ${partialPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {partialPnl >= 0 ? '+' : ''}Rs.{fmt(partialPnl)}
            </span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Remaining</span><span className="dark:text-gray-300">{remaining < 0 ? '—' : remaining} kittā</span>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">{error}</div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={onClose}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || xQty > remQty || xQty < 1}
            className="flex-1 py-1.5 text-[11px] font-bold rounded-md bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Exiting…' : 'Confirm Exit'}
          </button>
        </div>
      </div>
    </div>
  )
}
