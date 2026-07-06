// === FeeCards.jsx — broker fee breakdown card ===
// Moved verbatim from AIChat.jsx (P2.1 split). FeeRow is module-private.

// ── Broker fee result card ────────────────────────────────────────────────────
export function BrokerFeeCard({ fee }) {
  if (!fee) return null
  const isProfit = fee.transaction === 'sell'
  return (
    <div className="border-l-2 border-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded-xl px-3 py-2 mb-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">🧮</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200" translate="no">
          NEPSE Fee Breakdown — {fee.transaction === 'buy' ? 'BUY' : 'SELL'} {fee.quantity} kittas
          {fee.symbol ? ` of ${fee.symbol}` : ''} @ Rs.{fee.price?.toLocaleString()}
        </span>
      </div>
      <div className="space-y-0.5">
        <FeeRow label="Total Value" value={`Rs.${fee.totalValue?.toLocaleString()}`} />
        <FeeRow
          label={`Broker (${fee.brokerRate}%)`}
          value={`Rs.${fee.brokerCommission?.toLocaleString()}`}
          dim
        />
        <FeeRow label="SEBON (0.015%)" value={`Rs.${fee.sebon?.toLocaleString()}`} dim />
        {fee.dp > 0 && <FeeRow label="DP Charge" value={`Rs.${fee.dp}`} dim />}
        {fee.capitalGainTax > 0 && (
          <FeeRow
            label={`CGT (${fee.cgtRate}% · ${fee.holdingDays}d ${fee.holdingType === 'long' ? 'long-term' : 'short-term'})`}
            value={`Rs.${fee.capitalGainTax?.toLocaleString()}`}
            dim
          />
        )}
        {fee.transaction === 'sell' && fee.capitalGainTax === 0 && fee.holdingDays !== null && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5" translate="no">
            No CGT — no profit on this trade ({fee.holdingDays}d held)
          </p>
        )}
        {fee.transaction === 'sell' && fee.holdingDays === null && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5">
            CGT not estimated — trade entry not found
          </p>
        )}
        <div className="border-t border-sky-200 dark:border-sky-800 my-1" />
        <FeeRow
          label="Total Charges"
          value={`Rs.${fee.totalCharges?.toLocaleString()}`}
          accent="text-red-500"
        />
        <FeeRow
          label={isProfit ? 'Net Receive' : 'Net Pay'}
          value={`Rs.${fee.netAmount?.toLocaleString()}`}
          accent="text-sky-600 dark:text-sky-400 font-semibold"
        />
      </div>
    </div>
  )
}
function FeeRow({ label, value, dim, accent }) {
  return (
    <div className="flex justify-between items-center">
      <span
        className={`text-[10px] ${dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}
      >
        {label}
      </span>
      <span
        className={`text-[10px] ${accent || (dim ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200')}`}
        translate="no"
      >
        {value}
      </span>
    </div>
  )
}
