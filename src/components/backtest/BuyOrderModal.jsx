// === BuyOrderModal.jsx — buy order entry modal (price, qty, SL/TP, fee preview) ===

import { useState, useEffect, useCallback } from 'react'
import { btPlaceOrder, btGetSettlementDate } from '../../api/backtest'
import { nepseCommission, sebonFee, dpCharge } from '../../utils/format'
import { fmt } from './format'

// Design token (copied per-file per pm/docs/design.md — no shared ui.js)
const LABEL =
  'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5'

// Canonical NEPSE buy/sell fee (Rule 36) — single source in utils/format.js, mirroring
// the server's calcBrokerFee. The previous local copy used stale 0.6%/0.55%/… rates that
// diverged from the authoritative 0.36%/0.33%/… schedule, so the preview undercounted.
// Buy side: commission + SEBON only (no DP). Sell side adds the flat DP charge.
function calcFee(value, isSell = false) {
  if (!value || value <= 0) return 0
  return +(nepseCommission(value) + sebonFee(value) + (isSell ? dpCharge() : 0)).toFixed(2)
}

export default function BuyOrderModal({ session, script, candle, onClose, onOrderPlaced }) {
  const [price, setPrice] = useState(String(candle?.close || ''))
  const [qty, setQty] = useState('100')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Settlement date comes from the server's authoritative NEPSE calendar (T+2).
  // Previously this was computed client-side from a hardcoded holiday list that
  // duplicated the backend calendar and went stale after 2026-05-01.
  const [settlDate, setSettlDate] = useState('—')

  const ep = parseFloat(price) || 0
  const qtyInt = parseInt(qty, 10) || 0

  // A fill can only happen within the day's traded range. These bound the price input.
  const dayLow = candle?.low != null ? parseFloat(candle.low) : null
  const dayHigh = candle?.high != null ? parseFloat(candle.high) : null
  const hasRange = Number.isFinite(dayLow) && Number.isFinite(dayHigh)
  const priceOutOfRange = hasRange && ep > 0 && (ep < dayLow || ep > dayHigh)
  const slVal = sl ? parseFloat(sl) : null
  const tpVal = tp ? parseFloat(tp) : null
  const cost = ep * qtyInt
  const fee = cost > 0 ? calcFee(cost, false) : 0
  const total = cost + fee
  const availAfter = parseFloat(session.available_capital) - total

  // Fetch the authoritative T+2 settlement date for this entry day from the server.
  useEffect(() => {
    if (!candle?.date) {
      setSettlDate('—')
      return
    }
    let cancelled = false
    btGetSettlementDate(candle.date)
      .then((r) => {
        if (!cancelled) setSettlDate(r.data?.settlement_date || '—')
      })
      .catch(() => {
        if (!cancelled) setSettlDate('—')
      })
    return () => {
      cancelled = true
    }
  }, [candle?.date])

  const rrRatio =
    slVal && tpVal && slVal < ep && tpVal > ep ? ((tpVal - ep) / (ep - slVal)).toFixed(2) : null

  const validate = useCallback(() => {
    if (!ep || ep <= 0) return 'Enter a valid price'
    if (hasRange && (ep < dayLow || ep > dayHigh))
      return `Price must be within the day's range Rs.${fmt(dayLow)} – Rs.${fmt(dayHigh)}`
    if (!qtyInt || qtyInt < 1) return 'Enter a valid quantity'
    if (total > parseFloat(session.available_capital))
      return `Insufficient capital (need Rs.${fmt(total)})`
    if (slVal !== null && slVal >= ep) return 'SL must be below entry price'
    if (slVal !== null && slVal <= 0) return 'SL must be positive'
    if (tpVal !== null && tpVal <= ep) return 'TP must be above entry price'
    if (slVal !== null && tpVal !== null && slVal === tpVal) return 'SL and TP cannot be equal'
    return null
  }, [ep, qtyInt, total, session, slVal, tpVal, hasRange, dayLow, dayHigh])

  const handleConfirm = useCallback(async () => {
    const err = validate()
    if (err) return setError(err)
    setLoading(true)
    setError('')
    try {
      const res = await btPlaceOrder(session.id, {
        script_id: script.id,
        symbol: script.symbol,
        entry_date: candle.date,
        entry_price: ep,
        quantity: qtyInt,
        sl: slVal,
        tp: tpVal,
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
    const h = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-80 max-w-full p-5 border border-gray-200 dark:border-gray-700 animate-scale-in">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold dark:text-white">BUY ORDER — {script.symbol}</div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="text-[10px] text-gray-400 mb-3">
          Date:{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{candle?.date}</span>
        </div>

        <div className="flex flex-col gap-2 text-[11px]">
          {/* Price — must be within the day's traded range [low, high] */}
          <div>
            <label className={LABEL}>Price (Rs.)</label>
            <input
              type="number"
              value={price}
              min={hasRange ? dayLow : undefined}
              max={hasRange ? dayHigh : undefined}
              step="0.1"
              onChange={(e) => setPrice(e.target.value)}
              className={`mt-0.5 w-full px-2 py-1.5 rounded-md border bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 ${
                priceOutOfRange
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'
              }`}
            />
            {hasRange && (
              <>
                <div className="mt-1 flex items-center gap-1">
                  {[
                    { label: 'Low', v: dayLow },
                    { label: 'Close', v: parseFloat(candle.close) },
                    { label: 'High', v: dayHigh },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPrice(String(p.v))}
                      className="flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500"
                    >
                      {p.label} {fmt(p.v)}
                    </button>
                  ))}
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${priceOutOfRange ? 'text-red-500 font-semibold' : 'text-gray-400'}`}
                >
                  {priceOutOfRange
                    ? `Outside day's range — only Rs.${fmt(dayLow)}–${fmt(dayHigh)} traded`
                    : `Day's range: Rs.${fmt(dayLow)} – Rs.${fmt(dayHigh)}`}
                </div>
              </>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className={LABEL}>Quantity (kittā)</label>
            <input
              type="number"
              value={qty}
              min={1}
              step={1}
              onChange={(e) => setQty(e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* SL */}
          <div>
            <label className={LABEL}>
              Stop-Loss (Rs.){' '}
              <span className="text-gray-400 dark:text-gray-500 normal-case font-normal tracking-normal">optional</span>
            </label>
            <input
              type="number"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder="e.g. 1200"
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-red-400"
            />
            {!sl && <div className="text-[10px] text-orange-500 mt-0.5">No SL set — high risk</div>}
          </div>

          {/* TP */}
          <div>
            <label className={LABEL}>
              Take-Profit (Rs.){' '}
              <span className="text-gray-400 dark:text-gray-500 normal-case font-normal tracking-normal">optional</span>
            </label>
            <input
              type="number"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder="e.g. 1400"
              className="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-green-400"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-[10px] space-y-0.5">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Cost</span>
            <span className="font-semibold dark:text-gray-300">Rs.{fmt(cost)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Broker Fee</span>
            <span className="font-semibold dark:text-gray-300">Rs.{fmt(fee)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-100 dark:border-gray-700 pt-0.5 dark:text-white">
            <span>Total</span>
            <span>Rs.{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Avail after</span>
            <span className={availAfter < 0 ? 'text-red-500 font-semibold' : 'dark:text-gray-300'}>
              Rs.{fmt(availAfter)}
            </span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Settlement</span>
            <span className="dark:text-gray-300">{settlDate}</span>
          </div>
          {rrRatio && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>R:R</span>
              <span
                className={`font-semibold ${parseFloat(rrRatio) >= 2 ? 'text-green-600' : 'text-orange-500'}`}
              >
                1 : {rrRatio}
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
            disabled={loading || priceOutOfRange}
            className="flex-1 py-1.5 text-[11px] font-bold rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Buying…' : 'Confirm BUY'}
          </button>
        </div>
      </div>
    </div>
  )
}
