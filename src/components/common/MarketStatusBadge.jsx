// === MarketStatusBadge.jsx — live NEPSE market open/closed status badge (NPT timezone) ===
// Calendar + hours logic lives in utils/nepseCalendar.js (shared with StockChart backfill).
// Two renderers: default badge (Screen toolbar) and MarketStatusChip (HomePage greeting bar).

import { useState, useEffect } from 'react'
import { isMarketOpenNow, nptNow } from '../../utils/nepseCalendar'

// compact — show only the status dot (no label / "Data as of" text). Used in the
// cramped mobile Screen toolbar where horizontal space is scarce.
export default function MarketStatusBadge({ latestDate, compact = false }) {
  const [isOpen, setIsOpen] = useState(() => isMarketOpenNow())

  // Re-evaluate every minute so the badge flips at open/close without a reload
  useEffect(() => {
    const id = setInterval(() => setIsOpen(isMarketOpenNow()), 60_000)
    return () => clearInterval(id)
  }, [])

  const dot = (
    <span
      className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}
      title={isOpen ? 'Market Open' : 'Market Closed'}
    />
  )

  if (compact) return <span className="flex items-center">{dot}</span>

  return (
    <div className="flex items-center gap-2 text-[10px] text-gray-400">
      {latestDate && <span>Data as of {latestDate}</span>}
      <span className="flex items-center gap-1">
        {dot}
        <span className={isOpen ? 'text-emerald-400' : 'text-gray-500'}>
          {isOpen ? 'Market Open' : 'Market Closed'}
        </span>
      </span>
    </div>
  )
}

// ── MarketStatusChip — HomePage greeting-bar pill ────────────────────────────
// Always shows the current NPT clock. While NEPSE is open (trading day, market
// hours) it adds a blinking dot + LIVE; closed → static dot, clock only.
export function MarketStatusChip() {
  const [now, setNow] = useState(() => nptNow())

  // 15s tick keeps the HH:MM clock honest and flips LIVE within seconds of open/close.
  useEffect(() => {
    const id = setInterval(() => setNow(nptNow()), 15_000)
    return () => clearInterval(id)
  }, [])

  const isOpen = isMarketOpenNow()
  const clock = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
        isOpen
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40'
          : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/60'
      }`}
      title={isOpen ? 'NEPSE is open (NPT)' : 'NEPSE is closed (NPT)'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'
        }`}
      />
      {isOpen && (
        <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">Live</span>
      )}
      <span
        className={`text-[10px] font-semibold tabular-nums ${
          isOpen ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {clock}
      </span>
    </div>
  )
}

