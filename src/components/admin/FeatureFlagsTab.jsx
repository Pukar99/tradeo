// === FeatureFlagsTab.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { getAllAdminFlags, patchAdminFlag, postAdminFlag } from '@api/admin'
import toast from 'react-hot-toast'

const SCOPES = ['all', 'basic', 'pro', 'premium', 'beta']

const SCOPE_COLORS = {
  all:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  basic:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pro:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  beta:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

function FlagRow({ flag, onToggle, onScopeChange, dropUp = false }) {
  const [scopeOpen,   setScopeOpen]   = useState(false)
  const [toggling,    setToggling]    = useState(false)
  const [scopeSaving, setScopeSaving] = useState(false)

  async function handleToggle() {
    if (toggling) return
    setToggling(true)
    try {
      await onToggle(flag.name, !flag.enabled)
    } finally {
      setToggling(false)
    }
  }

  async function handleScope(scope) {
    setScopeOpen(false)
    if (scope === flag.scope) return
    setScopeSaving(true)
    try {
      await onScopeChange(flag.name, scope)
    } finally {
      setScopeSaving(false)
    }
  }

  const updated = flag.updated_at
    ? new Date(flag.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-white font-mono truncate">{flag.name}</p>
        {flag.description && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{flag.description}</p>
        )}
      </div>

      {/* Scope dropdown */}
      <div className="hidden sm:block relative w-20 flex-shrink-0">
        <button
          onClick={() => setScopeOpen(p => !p)}
          disabled={scopeSaving}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full transition-colors ${SCOPE_COLORS[flag.scope] || SCOPE_COLORS.all}`}
        >
          {scopeSaving ? '…' : flag.scope}
        </button>
        {scopeOpen && (
          <div className={`absolute right-0 w-28 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}>
            {SCOPES.map(s => (
              <button
                key={s}
                onClick={() => handleScope(s)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  s === flag.scope
                    ? 'bg-gray-100 dark:bg-gray-800 font-semibold text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Updated */}
      <div className="hidden lg:block w-20 flex-shrink-0">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{updated}</span>
      </div>

      {/* Toggle */}
      <button
        onClick={handleToggle}
        disabled={toggling}
        aria-label={flag.enabled ? 'Disable flag' : 'Enable flag'}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
          flag.enabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
        } disabled:opacity-50`}
      >
        <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          flag.enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-2.5 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="hidden sm:block w-14 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
    </div>
  )
}

export default function FeatureFlagsTab() {
  const [flags,   setFlags]   = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchFlags = useCallback(async () => {
    try {
      const { data } = await getAllAdminFlags()
      setFlags(data.flags || [])
    } catch {
      setFlags([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFlags() }, [fetchFlags])

  async function handleToggle(name, enabled) {
    try {
      await patchAdminFlag(name, { enabled })
      setFlags(prev => prev.map(f => f.name === name ? { ...f, enabled } : f))
      toast.success(enabled ? `${name} enabled` : `${name} disabled`)
    } catch {
      toast.error('Failed to update flag')
    }
  }

  async function handleScopeChange(name, scope) {
    try {
      await patchAdminFlag(name, { scope })
      setFlags(prev => prev.map(f => f.name === name ? { ...f, scope } : f))
      toast.success(`${name} scope → ${scope}`)
    } catch {
      toast.error('Failed to update scope')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await postAdminFlag({ name: newName.trim(), enabled: false, scope: 'all' })
      toast.success(`Flag "${newName.trim()}" created`)
      setNewName('')
      fetchFlags()
    } catch {
      toast.error('Failed to create flag')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Flag</div>
        <div className="hidden sm:block w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">Scope</div>
        <div className="hidden lg:block w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">Updated</div>
        <div className="w-9 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : flags.length === 0 ? (
          <div className="min-h-[420px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No flags yet
          </div>
        ) : (
          flags.map((f, i) => (
            <FlagRow
              key={f.name}
              flag={f}
              onToggle={handleToggle}
              onScopeChange={handleScopeChange}
              dropUp={flags.length > 3 && i >= flags.length - 2}
            />
          ))
        )}
      </div>

      {/* Add new flag */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="new_flag_name"
            className="flex-1 h-8 px-3 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
          >
            {creating ? 'Creating…' : 'Add Flag'}
          </button>
        </form>
      </div>
    </div>
  )
}
