export default function ComingSoon({ label, desc, compact = false }) {
  if (compact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">{label}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Coming soon</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-20">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-1 max-w-xs">{desc}</p>}
      </div>
      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        Coming Soon
      </span>
    </div>
  )
}
