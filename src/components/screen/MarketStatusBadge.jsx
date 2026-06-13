// === MarketStatusBadge.jsx — live NEPSE market open/closed status badge (NPT timezone) ===
// Calendar + hours logic lives in utils/nepseCalendar.js (shared with StockChart backfill).

import { useState, useEffect } from 'react'
import { isMarketOpenNow } from '../../utils/nepseCalendar'

export default function MarketStatusBadge({ latestDate }) {
  const [isOpen, setIsOpen] = useState(() => isMarketOpenNow())

  // Re-evaluate every minute so the badge flips at open/close without a reload
  useEffect(() => {
    const id = setInterval(() => setIsOpen(isMarketOpenNow()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 text-[10px] text-gray-400">
      {latestDate && <span>Data as of {latestDate}</span>}
      <span className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
        <span className={isOpen ? 'text-emerald-400' : 'text-gray-500'}>
          {isOpen ? 'Market Open' : 'Market Closed'}
        </span>
      </span>
    </div>
  )
}
