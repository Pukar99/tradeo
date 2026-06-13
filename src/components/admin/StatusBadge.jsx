// === StatusBadge.jsx ===
export default function StatusBadge({ suspended }) {
  return suspended ? (
    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      Suspended
    </span>
  ) : (
    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Active
    </span>
  )
}
