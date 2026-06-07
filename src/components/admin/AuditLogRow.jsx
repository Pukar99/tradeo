// === AuditLogRow.jsx ===

const CATEGORY_COLORS = {
  user:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  content:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  system:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  broadcast: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

function actionCategory(action) {
  if (action.startsWith('post_')) return 'content'
  if (action.startsWith('announcement_') || action.startsWith('broadcast_')) return 'broadcast'
  if (['flag_toggle', 'config_update', 'scraper_trigger'].includes(action)) return 'system'
  return 'user' // tier_change, suspend, unsuspend, force_logout, delete_user
}

// Renders a JSONB detail object as readable "key: value" text — never raw JSON/HTML.
function formatDetail(detail) {
  if (!detail || typeof detail !== 'object' || Object.keys(detail).length === 0) return '—'
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${v && typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('  ·  ')
}

export default function AuditLogRow({ log }) {
  const when = log.created_at
    ? new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Admin */}
      <div className="w-32 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{log.admin_name}</p>
      </div>

      {/* Action badge */}
      <div className="w-36 flex-shrink-0">
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full font-mono ${CATEGORY_COLORS[actionCategory(log.action)]}`}>
          {log.action}
        </span>
      </div>

      {/* Target */}
      <div className="hidden sm:block w-28 flex-shrink-0">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{log.target_name || '—'}</span>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={formatDetail(log.detail)}>
          {formatDetail(log.detail)}
        </p>
      </div>

      {/* When */}
      <div className="hidden lg:block w-32 flex-shrink-0 text-right">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{when}</span>
      </div>
    </div>
  )
}
