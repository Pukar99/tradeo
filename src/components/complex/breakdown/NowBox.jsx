// =============================================================================
// NowBox.jsx — "where are we now" (spec idea D, S3 §8.4.6). Frontend math only:
// the move since the last confirmed pivot vs MEDIAN historical bull/bear.
// Honest framing — medians are history, never a forecast.
// =============================================================================
import { CARD, LABEL, fmtPct } from '../../datalab/shared'

function median(vals) {
  if (!vals.length) return null
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function computeNow(cycles, candles) {
  if (!cycles?.length || !candles?.length) return null
  const last = cycles[cycles.length - 1]
  const lastClose = parseFloat(candles[candles.length - 1].close)
  const pivotClose = parseFloat(last.end_close)
  if (!pivotClose || !lastClose) return null
  const after = candles.filter((c) => c.date > last.end_date)
  const retPct = ((lastClose - pivotClose) / pivotClose) * 100
  const bulls = cycles.filter((c) => c.type === 'bull')
  const bears = cycles.filter((c) => c.type === 'bear')
  return {
    sinceDate: last.end_date,
    sinceName: last.name || null,
    tradingDays: after.length,
    retPct,
    direction: retPct >= 0 ? 'up' : 'down',
    med: {
      bullPct: median(bulls.map((c) => c.pct)),
      bullDays: median(bulls.map((c) => c.duration_days)),
      bearPct: median(bears.map((c) => c.pct)),
      bearDays: median(bears.map((c) => c.duration_days)),
    },
  }
}

export default function NowBox({ cycles, candles }) {
  const now = computeNow(cycles, candles)
  if (!now) return null
  const up = now.direction === 'up'
  const medPct = up ? now.med.bullPct : now.med.bearPct
  const medDays = up ? now.med.bullDays : now.med.bearDays
  return (
    <div className={`${CARD} p-3`}>
      <p className={`${LABEL} mb-1.5`}>Where are we now</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-[18px] font-black tabular-nums ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {fmtPct(now.retPct)}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          in {now.tradingDays} trading day{now.tradingDays === 1 ? '' : 's'}
        </span>
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
        since {now.sinceName ? `${now.sinceName} ended` : ''} {now.sinceDate}
      </p>
      {medPct != null && (
        <p className="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800">
          Median past {up ? 'bull' : 'bear'}: {fmtPct(medPct)} over {Math.round(medDays)}d — history, not a promise
        </p>
      )}
    </div>
  )
}
