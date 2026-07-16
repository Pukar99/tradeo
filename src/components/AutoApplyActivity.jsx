import { useEffect, useState } from 'react'
import { getMeroshareApplyLog } from '../api'

const STATUS_GLYPH = {
  applied: { glyph: '✓', cls: 'text-emerald-500' },
  failed: { glyph: '✗', cls: 'text-red-500' },
  skipped: { glyph: '—', cls: 'text-gray-400' },
}
const SOURCE_LABEL = {
  cron: 'Scheduled', on_login: 'On login', manual_run: 'Manual run', apply: 'Apply', bulk: 'Bulk',
}

function timeAgo(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Durable auto-apply/apply history from meroshare_apply_log.
// Renders nothing while loading or when there is no history yet.
export default function AutoApplyActivity() {
  const [entries, setEntries] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let alive = true
    getMeroshareApplyLog(20)
      .then((res) => alive && setEntries(res.data.entries || []))
      .catch(() => alive && setEntries([]))
    return () => { alive = false }
  }, [])

  if (!entries?.length) return null
  const latest = entries[0]
  const g = STATUS_GLYPH[latest.status] || STATUS_GLYPH.skipped

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Auto-Apply Activity
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {expanded ? 'Hide' : `History (${entries.length})`}
        </button>
      </div>

      {!expanded ? (
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold flex-shrink-0 ${g.cls}`}>{g.glyph}</span>
          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
            {latest.account_label}
          </span>
          <span className="text-[10px] text-gray-400 truncate">
            {latest.scrip ? `${latest.scrip} — ` : ''}{latest.message}
          </span>
          <span className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 ml-auto">
            {SOURCE_LABEL[latest.source] || latest.source} · {timeAgo(latest.created_at)}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => {
            const eg = STATUS_GLYPH[e.status] || STATUS_GLYPH.skipped
            return (
              <div key={e.id} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold flex-shrink-0 ${eg.cls}`}>{eg.glyph}</span>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                  {e.account_label}
                </span>
                <span className="text-[10px] text-gray-400 truncate">
                  {e.scrip ? `${e.scrip} — ` : ''}{e.message}
                </span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0 ml-auto">
                  {SOURCE_LABEL[e.source] || e.source} · {timeAgo(e.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
