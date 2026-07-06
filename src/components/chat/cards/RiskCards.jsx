// === RiskCards.jsx — trade risk-check card + discipline nudge card ===
// Moved verbatim from AIChat.jsx (P2.1 split).

// ── Risk warning card shown before logging a trade ───────────────────────────
export function RiskWarningCard({ trade, ltp, onConfirm, onCancel }) {
  const entryPrice = parseFloat(trade.entry)
  const qty = parseInt(trade.qty)
  const slPrice = trade.sl ? parseFloat(trade.sl) : null
  const tpPrice = trade.tp ? parseFloat(trade.tp) : null
  const ltpNum = parseFloat(ltp) || entryPrice

  const riskAmt = slPrice ? Math.abs(entryPrice - slPrice) * qty : null
  const rewardAmt = tpPrice ? Math.abs(tpPrice - entryPrice) * qty : null
  const rr = riskAmt && rewardAmt ? (rewardAmt / riskAmt).toFixed(1) : null
  const slPct = slPrice ? Math.abs(((entryPrice - slPrice) / entryPrice) * 100).toFixed(1) : null
  const noSl = !slPrice
  const badRR = rr && parseFloat(rr) < 1.5
  const warnings = []
  if (noSl) warnings.push('No stop loss set — capital at full risk')
  if (badRR) warnings.push(`R:R is ${rr}:1 — below the recommended 1:2`)

  return (
    <div className="border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3 mb-2">
      <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1">
        ⚠️ Trade Risk Check — Review before logging
      </p>
      <div className="grid grid-cols-2 gap-1 mb-2 text-[10px]">
        <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
          <p className="text-gray-400">Symbol</p>
          <p className="font-semibold text-gray-800 dark:text-white">{trade.symbol}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
          <p className="text-gray-400">Qty × Entry</p>
          <p className="font-semibold text-gray-800 dark:text-white">
            {qty} × Rs.{entryPrice.toLocaleString()}
          </p>
        </div>
        {slPrice && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">SL ({slPct}% away)</p>
            <p className="font-semibold text-red-500">Rs.{slPrice.toLocaleString()}</p>
          </div>
        )}
        {tpPrice && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">TP</p>
            <p className="font-semibold text-green-500">Rs.{tpPrice.toLocaleString()}</p>
          </div>
        )}
        {riskAmt && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">Max Risk</p>
            <p className="font-semibold text-red-500">Rs.{Math.round(riskAmt).toLocaleString()}</p>
          </div>
        )}
        {rr && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
            <p className="text-gray-400">R:R Ratio</p>
            <p
              className={`font-semibold ${parseFloat(rr) >= 2 ? 'text-green-500' : parseFloat(rr) >= 1.5 ? 'text-yellow-500' : 'text-red-500'}`}
            >
              {rr}:1
            </p>
          </div>
        )}
      </div>
      {warnings.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 mb-2">
          {warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-red-500">
              • {w}
            </p>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={onConfirm}
          className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded-xl text-[10px] font-semibold transition-colors"
        >
          Confirm & Log Trade
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 py-1.5 rounded-xl text-[10px] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Discipline nudge card (shown after low discipline responses) ──────────────
export function DisciplineNudgeCard({ score, onDismiss }) {
  const isLow = score < 40
  const isMid = score >= 40 && score < 70
  return (
    <div
      className={`border-l-2 rounded-xl px-3 py-2 mb-1.5 ${isLow ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{isLow ? '🔴' : '🟡'}</span>
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            Discipline Alert
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 text-[10px]"
        >
          ✕
        </button>
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
        {isLow
          ? `Your 7-day discipline avg is ${score}% — critically low. Missing your daily routine is a compounding habit. Let's fix that today.`
          : `Discipline at ${score}% — room to improve. Consistent routines lead to consistent results.`}
      </p>
      <div className="mt-1.5 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isLow ? 'bg-red-400' : 'bg-yellow-400'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
