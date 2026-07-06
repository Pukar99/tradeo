// === PlanCards.jsx — trade plan card + shared PlanStat tile ===
// Moved verbatim from AIChat.jsx (P2.1 split). PlanStat is reused by SummaryCards (Task 8).
import { MarkdownLite } from '../markdown'

// ── Trade plan card — TRADE_PLAN returns a full technical plan ────────────────
export function PlanStat({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p
        className={`text-[11px] font-semibold ${accent || 'text-gray-800 dark:text-white'}`}
        translate="no"
      >
        {value}
      </p>
    </div>
  )
}

export function TradePlanCard({ plan }) {
  if (!plan) return null
  const trendCls =
    plan.trend === 'UPTREND'
      ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
      : plan.trend === 'DOWNTREND'
        ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
        : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400'
  return (
    <div className="border-l-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📐</span>
          <span
            className="text-[11px] font-semibold text-gray-700 dark:text-gray-200"
            translate="no"
          >
            Trade Plan — {plan.symbol} · Rs.{plan.ltp?.toLocaleString()}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${trendCls}`}>
          {plan.trend}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-1.5">
        <PlanStat
          label="RSI"
          value={plan.rsi}
          accent={plan.rsi >= 70 ? 'text-red-400' : plan.rsi <= 30 ? 'text-green-500' : undefined}
        />
        <PlanStat label="ATR" value={plan.atr} />
        <PlanStat label="EMA20" value={plan.ema20} />
        <PlanStat label="EMA50" value={plan.ema50} />
      </div>
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        <PlanStat
          label="Support"
          value={`Rs.${plan.nearest_support?.toLocaleString()}`}
          accent="text-green-500"
        />
        <PlanStat
          label="Resistance"
          value={`Rs.${plan.nearest_resistance?.toLocaleString()}`}
          accent="text-red-400"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 mb-1.5 border border-blue-100 dark:border-blue-900/50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
          Suggested Setup
        </p>
        <div className="space-y-0.5 text-[10px]" translate="no">
          <div className="flex justify-between">
            <span className="text-gray-400">Entry</span>
            <span className="font-semibold text-gray-800 dark:text-white">
              Rs.{plan.suggested_entry?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Stop Loss</span>
            <span className="font-semibold text-red-500">
              Rs.{plan.suggested_sl?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target 1</span>
            <span className="font-semibold text-green-500">
              Rs.{plan.suggested_tp1?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target 2</span>
            <span className="font-semibold text-green-500">
              Rs.{plan.suggested_tp2?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-0.5 mt-0.5">
            <span className="text-gray-400">R:R Ratio</span>
            <span
              className={`font-semibold ${plan.rr_ratio >= 2 ? 'text-green-500' : plan.rr_ratio >= 1.5 ? 'text-yellow-500' : 'text-red-500'}`}
            >
              {plan.rr_ratio}:1
            </span>
          </div>
        </div>
      </div>

      {plan.ai_analysis && (
        <div className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
          <MarkdownLite text={plan.ai_analysis} />
        </div>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-1.5">
        Algorithmic suggestion — not financial advice.
      </p>
    </div>
  )
}
