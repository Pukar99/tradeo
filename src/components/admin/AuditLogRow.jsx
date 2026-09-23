// === AuditLogRow.jsx ===
// Visual pass 2026-08-09: the solid-fill action badge becomes a coloured dot
// + mono text — same "signal, not decoration" move Users/Content made for
// their status columns in round 1, and less visual weight on a dense 50-row
// table. Category logic (actionCategory) is untouched — the same categories
// now also group the filter pills in AuditLogTab.jsx, using this exact
// color set so a clicked pill and a rendered badge always agree.
const CATEGORY_DOT = {
  user: 'text-blue-600 dark:text-blue-400',
  content: 'text-purple-600 dark:text-purple-400',
  system: 'text-amber-700 dark:text-amber-400',
  broadcast: 'text-emerald-600 dark:text-emerald-400',
}

function actionCategory(action) {
  if (action.startsWith('post_')) return 'content'
  if (action.startsWith('announcement_') || action.startsWith('broadcast_')) return 'broadcast'
  if (['flag_toggle', 'flag_delete', 'config_update', 'scraper_trigger'].includes(action)) {
    return 'system'
  }
  return 'user' // tier_change, tier_auto_revert, suspend, unsuspend, force_logout, delete_user
}

// System-driven entries (currently just the tier-expiry cron sweep) are
// attributed to the admin account since this is a single-admin system —
// but they weren't a manual click, and that distinction matters when
// reading the log. Keep in sync with utils/tierExpiry.js's action name.
const AUTOMATED_ACTIONS = ['tier_auto_revert']

// Renders a JSONB detail object as readable "key: value" text — never raw JSON/HTML.
// Skips null/undefined values instead of printing the literal word "null".
function formatDetail(detail) {
  if (!detail || typeof detail !== 'object' || Object.keys(detail).length === 0) return '—'
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
  return parts.length ? parts.join('  ·  ') : '—'
}

export default function AuditLogRow({ log }) {
  const when = log.created_at
    ? new Date(log.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'
  const isAutomated = AUTOMATED_ACTIONS.includes(log.action)
  const category = actionCategory(log.action)

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Admin */}
      <div className="w-32 flex-shrink-0 flex items-center gap-1.5 min-w-0">
        <p className="text-[11.5px] font-semibold text-gray-900 dark:text-white truncate">
          {log.admin_name}
        </p>
        {isAutomated && (
          <span
            title="Ran automatically (cron), not a manual click"
            className="flex-shrink-0 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide leading-none rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            Auto
          </span>
        )}
      </div>

      {/* Action */}
      <div className="w-32 flex-shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold ${CATEGORY_DOT[category]}`}
        >
          <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" />
          {log.action}
        </span>
      </div>

      {/* Target */}
      <div className="hidden sm:block w-28 flex-shrink-0">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {log.target_name || '—'}
        </span>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] text-gray-500 dark:text-gray-400 truncate"
          title={formatDetail(log.detail)}
        >
          {formatDetail(log.detail)}
        </p>
      </div>

      {/* When */}
      <div className="hidden lg:block w-28 flex-shrink-0 text-right">
        <span className="text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">{when}</span>
      </div>
    </div>
  )
}
