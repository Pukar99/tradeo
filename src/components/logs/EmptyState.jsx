// === EmptyState.jsx — shared empty-state block for all logs views/tabs ===

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-2xl">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">{title}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-400 mt-1 max-w-xs leading-relaxed">{subtitle}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
