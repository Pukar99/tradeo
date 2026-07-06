import { useState } from 'react'
import { RiskWarningCard } from './cards/RiskCards'

// ── Inline quick-action forms ────────────────────────────────────────────────
// pendingRiskWarning: when set, shows risk check before sending
export default function QuickForm({ type, onSubmit, onCancel }) {
  const [form, setForm] = useState({})
  const [pendingWarning, setPendingWarning] = useState(null) // trade data waiting for risk confirm
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  // BUY — shows risk warning before sending
  if (type === 'buy') {
    if (pendingWarning) {
      return (
        <RiskWarningCard
          trade={pendingWarning}
          ltp={null}
          onConfirm={() => {
            const f = pendingWarning
            const msg = `Buy ${f.qty} kittas of ${f.symbol} at Rs.${f.entry}${f.sl ? ` SL ${f.sl}` : ''}${f.tp ? ` TP ${f.tp}` : ''}`
            setPendingWarning(null)
            onSubmit(msg)
          }}
          onCancel={() => setPendingWarning(null)}
        />
      )
    }
    return (
      <div className="bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
          📒 Log BUY Trade
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol (NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
          <input
            placeholder="Qty (kittas)"
            type="number"
            value={form.qty || ''}
            onChange={(e) => set('qty', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
          <input
            placeholder="Entry price"
            type="number"
            value={form.entry || ''}
            onChange={(e) => set('entry', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
          <input
            placeholder="SL (optional)"
            type="number"
            value={form.sl || ''}
            onChange={(e) => set('sl', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
          <input
            placeholder="TP (optional)"
            type="number"
            value={form.tp || ''}
            onChange={(e) => set('tp', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol || !form.qty || !form.entry) return
              // Show risk warning first
              setPendingWarning({
                symbol: form.symbol,
                qty: form.qty,
                entry: form.entry,
                sl: form.sl,
                tp: form.tp,
              })
            }}
            className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Review & Log
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (type === 'sell') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-red-300 dark:border-red-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1">
          🏁 Close / Sell Trade
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol (NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
          <input
            placeholder="Exit price"
            type="number"
            value={form.exit || ''}
            onChange={(e) => set('exit', e.target.value)}
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol || !form.exit) return
              onSubmit(`Close my ${form.symbol} trade at Rs.${form.exit}`)
            }}
            className="flex-1 bg-red-500 hover:bg-red-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Close Trade
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (type === 'watchlist') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-purple-300 dark:border-purple-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
          👁️ Add to Watchlist
        </p>
        <div className="space-y-1.5">
          <input
            placeholder="Symbol (e.g. NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400"
          />
          <div className="flex gap-1">
            {['active', 'pre'].map((cat) => (
              <button
                key={cat}
                onClick={() => set('cat', cat)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors ${form.cat === cat ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400'}`}
              >
                {cat === 'active' ? '⭐ Active' : '🟡 Pre-Watch'}
              </button>
            ))}
          </div>
          <input
            placeholder="Price alert (optional)"
            type="number"
            value={form.alert || ''}
            onChange={(e) => set('alert', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol) return
              const cat = form.cat || 'active'
              const msg = `Add ${form.symbol} to ${cat} watchlist${form.alert ? ` with price alert Rs.${form.alert}` : ''}`
              onSubmit(msg)
            }}
            className="flex-1 bg-purple-500 hover:bg-purple-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Add to Watchlist
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (type === 'sltp') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1">
          🎯 Update SL / TP
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-400"
          />
          <input
            placeholder="Stop Loss"
            type="number"
            value={form.sl || ''}
            onChange={(e) => set('sl', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-400"
          />
          <input
            placeholder="Take Profit"
            type="number"
            value={form.tp || ''}
            onChange={(e) => set('tp', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-green-400"
          />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.symbol || (!form.sl && !form.tp)) return
              const parts = [`Update ${form.symbol}`]
              if (form.sl) parts.push(`SL ${form.sl}`)
              if (form.tp) parts.push(`TP ${form.tp}`)
              onSubmit(parts.join(' '))
            }}
            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Update SL/TP
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Broker fee calculator form
  if (type === 'fee') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-sky-300 dark:border-sky-800 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">
          🧮 NEPSE Broker Fee Calculator
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            placeholder="Symbol (NABIL)"
            value={form.symbol || ''}
            onChange={(e) =>
              set(
                'symbol',
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 15)
              )
            }
            className="col-span-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400"
          />
          <input
            placeholder="Qty (kittas)"
            type="number"
            value={form.qty || ''}
            onChange={(e) => set('qty', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400"
          />
          <input
            placeholder="Price (Rs.)"
            type="number"
            value={form.price || ''}
            onChange={(e) => set('price', e.target.value)}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-400"
          />
          <div className="col-span-2 flex gap-1">
            {['buy', 'sell'].map((tx) => (
              <button
                key={tx}
                onClick={() => set('tx', tx)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors capitalize ${form.tx === tx ? (tx === 'buy' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-sky-400'}`}
              >
                {tx === 'buy' ? '📈 Buy' : '📉 Sell'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => {
              if (!form.qty || !form.price) return
              const tx = form.tx || 'buy'
              const msg = `Calculate broker fee for ${tx}ing ${form.qty} kittas of ${form.symbol || 'stock'} at Rs.${form.price}`
              onSubmit(msg)
            }}
            className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            Calculate Fees
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return null
}
