export default function TradeCalendarView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-300">Calendar View — Coming Soon</p>
      <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
        Gann-style dot chart: months on Y, day-of-month on X, curved arrows connecting trade actions with duration labels.
      </p>
    </div>
  )
}
