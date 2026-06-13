// === ConfigEditor.jsx ===
import { useState } from 'react'
import { patchSystemConfig } from '@api/admin'
import toast from 'react-hot-toast'

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
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <span className="flex-1 text-xs text-gray-600 dark:text-gray-300 font-mono truncate">
        {row.key}
      </span>
      {editing ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="w-32 h-7 px-2 text-xs bg-white dark:bg-gray-800 border border-green-400 dark:border-green-600 rounded-lg text-gray-900 dark:text-white focus:outline-none"
          />
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-2.5 py-1 text-[10px] font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value ?? '—')}
          </span>
          <button
            onClick={startEdit}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConfigEditor({ config, loading, onRefresh }) {
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
    <div className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/50">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          App Config
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Click value to edit</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="h-2.5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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
