// Shows live NPT market open/closed status
// NEPSE open: 11:00 AM – 3:00 PM, Sun–Thu (NPT = UTC+5:45)

function getMarketStatus() {
  const now   = new Date()
  const npt   = new Date(now.getTime() + (5 * 60 + 45) * 60 * 1000)
  const day   = npt.getUTCDay()   // 0=Sun,1=Mon,...,5=Fri,6=Sat
  const hour  = npt.getUTCHours()
  const min   = npt.getUTCMinutes()
  const mins  = hour * 60 + min

  const isTradingDay = day !== 5 && day !== 6   // closed Fri + Sat
  const isOpenTime   = mins >= 11 * 60 && mins < 15 * 60  // 11:00–15:00

  return isTradingDay && isOpenTime
}

export default function MarketStatusBadge({ latestDate }) {
  const isOpen = getMarketStatus()

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
