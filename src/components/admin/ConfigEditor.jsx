// === ConfigEditor.jsx ===
// Visual pass 2026-08-08. Two real fixes alongside the restyle:
//  1. The header hint read "Click value to edit" — you can't. Clicking the
//     value does nothing; editing is the pencil button. Copy corrected.
//  2. Every pencil had the same bare title="Edit", so a screen reader heard
//     the same unlabelled button N times. Each now names its own key.
import { useState } from 'react'
import { patchSystemConfig } from '@api/admin'
import { clearAdminConfigCache } from '../../utils/adminCache'
import toast from 'react-hot-toast'

function displayValue(value) {
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value ?? '—')
}

function ConfigRow({ row, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  function startEdit() {
    setDraft(typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value ?? ''))
    setEditing(true)
  }

  async function handleSave() {
    setLoading(true)
    try {
      // Parse as JSON if possible, else treat as string
      let parsed
      try {
        parsed = JSON.parse(draft)
      } catch {
        parsed = draft
      }
      await patchSystemConfig(row.key, parsed)
      clearAdminConfigCache()
      toast.success(`${row.key} updated`)
      onSaved(row.key, parsed)
      setEditing(false)
    } catch {
      toast.error('Failed to update config')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="group/cfg flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <span className="flex-1 min-w-0 truncate font-mono text-[11px] text-gray-600 dark:text-gray-300">
        {row.key}
      </span>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label={`New value for ${row.key}`}
            autoFocus
            className="w-40 h-7 px-2 font-mono text-[11px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gray-900/5 dark:focus:ring-white/5 focus:border-gray-400 dark:focus:border-gray-500"
          />
          <button
            onClick={() => setEditing(false)}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 transition-colors"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <span className="truncate max-w-[220px] font-mono text-[11px] text-gray-900 dark:text-white">
            {displayValue(row.value)}
          </span>
          <button
            onClick={startEdit}
            title={`Edit ${row.key}`}
            aria-label={`Edit ${row.key}`}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 opacity-100 [@media(hover:hover)]:opacity-45 group-hover/cfg:opacity-100 focus-visible:opacity-100 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConfigEditor({ config, loading }) {
  const [rows, setRows] = useState(null)

  // Use local rows if available (after edit), else use props
  const display = rows ?? config ?? []

  function handleSaved(key, newValue) {
    setRows((prev) => {
      const base = prev ?? config ?? []
      return base.map((r) => (r.key === key ? { ...r, value: newValue } : r))
    })
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          App config
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Edit with the pencil</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2">
              <div className="h-2.5 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-2.5 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))
        ) : display.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
            No config rows
          </div>
        ) : (
          display.map((row) => <ConfigRow key={row.key} row={row} onSaved={handleSaved} />)
        )}
      </div>
    </div>
  )
}
