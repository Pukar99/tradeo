// === StatusBadge.jsx ===
// Visual pass 2026-08-08: Active and Suspended used to be equally loud pills,
// which flattened the signal — in a list where nearly every row is Active, the
// exception has to be the thing that catches the eye. Active is now a quiet
// dot + grey label that recedes; Suspended keeps the red pill.
export default function StatusBadge({ suspended }) {
  return suspended ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold leading-none rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      Suspended
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium leading-none text-gray-500 dark:text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  )
}
