// === FeatureFlagsTab.jsx ===
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAllAdminFlags,
  patchAdminFlag,
  postAdminFlag,
  deleteAdminFlag,
  getAdminAnalyticsOverview,
} from '@api/admin'
import toast from 'react-hot-toast'

const SCOPES = ['all', 'basic', 'pro', 'premium', 'beta']

const SCOPE_COLORS = {
  all: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  basic: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  beta: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

// Scope isn't enforced anywhere yet (no code gates behavior on it) — this is
// purely a targeting LABEL for now. Audience size uses real tier-distribution
// data so the label is at least honest about who it WOULD reach.
function audienceLabel(scope, dist) {
  if (!dist) return null
  const { basic = 0, pro = 0, premium = 0 } = dist
  const total = basic + pro + premium
  switch (scope) {
    case 'all':
      return 'Everyone, incl. guests'
    case 'basic':
      return `${total} logged-in user${total === 1 ? '' : 's'}`
    case 'pro':
      return `${pro + premium} user${pro + premium === 1 ? '' : 's'} (Pro+)`
    case 'premium':
      return `${premium} user${premium === 1 ? '' : 's'} (Premium)`
    case 'beta':
      return 'No beta cohort defined yet'
    default:
      return null
  }
}

function DeleteConfirm({ name, onCancel, onConfirm, loading }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border-t border-red-100 dark:border-red-800/30">
      <span className="text-xs font-medium text-red-700 dark:text-red-400">
        Delete <span className="font-mono">{name}</span>? This can't be undone.
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 transition-colors"
        >
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

function FlagRow({ flag, dist, onToggle, onScopeChange, onDescriptionChange, onDelete, dropUp = false }) {
  const [scopeOpen, setScopeOpen] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [scopeSaving, setScopeSaving] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(flag.description || '')
  const [descSaving, setDescSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  function startEditDesc() {
    setDescDraft(flag.description || '')
    setEditingDesc(true)
  }

  async function saveDesc() {
    setDescSaving(true)
    try {
      await onDescriptionChange(flag.name, descDraft.trim())
      setEditingDesc(false)
    } finally {
      setDescSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete(flag.name)
    } finally {
      setDeleting(false)
    }
  }

  const updated = flag.updated_at
    ? new Date(flag.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Name + description (click to edit) */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 dark:text-white font-mono truncate">
            {flag.name}
          </p>
          {editingDesc ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                autoFocus
                maxLength={300}
                placeholder="What does this flag do?"
                className="flex-1 h-6 px-2 text-[10px] bg-white dark:bg-gray-800 border border-green-400 dark:border-green-600 rounded text-gray-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={saveDesc}
                disabled={descSaving}
                className="text-[10px] font-semibold text-green-600 dark:text-green-400 hover:underline disabled:opacity-40"
              >
                {descSaving ? '…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingDesc(false)}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startEditDesc}
              className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 truncate text-left w-full"
              title="Click to edit description"
            >
              {flag.description || <span className="italic text-gray-400">Add a description…</span>}
            </button>
          )}
        </div>

        {/* Scope dropdown + audience size */}
        <div className="hidden sm:block relative w-28 flex-shrink-0">
          <button
            onClick={() => setScopeOpen((p) => !p)}
            disabled={scopeSaving}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full transition-colors ${SCOPE_COLORS[flag.scope] || SCOPE_COLORS.all}`}
          >
            {scopeSaving ? '…' : flag.scope}
          </button>
          <p className="mt-0.5 text-[9px] text-gray-400 dark:text-gray-500 truncate">
            {audienceLabel(flag.scope, dist)}
          </p>
          {scopeOpen && (
            <div
              className={`absolute right-0 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50 ${
                dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              {SCOPES.map((s) => (
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
          <span
            className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              flag.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirmingDelete(true)}
          aria-label="Delete flag"
          title="Delete flag"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z"
            />
          </svg>
        </button>
      </div>

      {confirmingDelete && (
        <DeleteConfirm
          name={flag.name}
          loading={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={confirmDelete}
        />
      )}
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

const STATUS_FILTERS = ['all', 'enabled', 'disabled']

export default function FeatureFlagsTab() {
  const [flags, setFlags] = useState([])
  const [dist, setDist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  // New-flag form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newScope, setNewScope] = useState('all')
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

  useEffect(() => {
    fetchFlags()
    // Audience-size context reuses the Analytics overview's tier distribution
    // — no new endpoint needed, and it's already 30s-cached server-side.
    getAdminAnalyticsOverview()
      .then(({ data }) => setDist(data.tierDistribution))
      .catch(() => {})
  }, [fetchFlags])

  async function handleToggle(name, enabled) {
    try {
      await patchAdminFlag(name, { enabled })
      setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, enabled } : f)))
      toast.success(enabled ? `${name} enabled` : `${name} disabled`)
    } catch {
      toast.error('Failed to update flag')
    }
  }

  async function handleScopeChange(name, scope) {
    try {
      await patchAdminFlag(name, { scope })
      setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, scope } : f)))
      toast.success(`${name} scope → ${scope}`)
    } catch {
      toast.error('Failed to update scope')
    }
  }

  async function handleDescriptionChange(name, description) {
    try {
      await patchAdminFlag(name, { description })
      setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, description } : f)))
    } catch {
      toast.error('Failed to update description')
    }
  }

  async function handleDelete(name) {
    try {
      await deleteAdminFlag(name)
      setFlags((prev) => prev.filter((f) => f.name !== name))
      toast.success(`${name} deleted`)
    } catch {
      toast.error('Failed to delete flag')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await postAdminFlag({
        name: newName.trim(),
        enabled: false,
        scope: newScope,
        description: newDescription.trim(),
      })
      toast.success(`Flag "${newName.trim()}" created`)
      setNewName('')
      setNewDescription('')
      setNewScope('all')
      setShowCreate(false)
      fetchFlags()
    } catch {
      toast.error('Failed to create flag')
    } finally {
      setCreating(false)
    }
  }

  const visibleFlags = useMemo(() => {
    const q = search.trim().toLowerCase()
    return flags.filter((f) => {
      if (status === 'enabled' && !f.enabled) return false
      if (status === 'disabled' && f.enabled) return false
      if (q && !f.name.toLowerCase().includes(q) && !(f.description || '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [flags, search, status])

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar: search + status filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or description…"
          className="flex-1 h-8 px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                status === f
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {flags.length} flags
        </span>
      </div>

      {/* Honest note — scope isn't enforced anywhere yet */}
      <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800/30">
        <p className="text-[10px] text-blue-700 dark:text-blue-400">
          Scope is a targeting label, not enforced app-wide yet — nothing currently reads it to
          gate behavior. Audience counts below are who it <em>would</em> reach.
        </p>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Flag
        </div>
        <div className="hidden sm:block w-28 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Scope
        </div>
        <div className="hidden lg:block w-20 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Updated
        </div>
        <div className="w-9 flex-shrink-0" />
        <div className="w-6 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 min-h-[420px]">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : flags.length === 0 ? (
          <div className="min-h-[420px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No flags yet
          </div>
        ) : visibleFlags.length === 0 ? (
          <div className="min-h-[420px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No flags match "{search}"
          </div>
        ) : (
          visibleFlags.map((f, i) => (
            <FlagRow
              key={f.name}
              flag={f}
              dist={dist}
              onToggle={handleToggle}
              onScopeChange={handleScopeChange}
              onDescriptionChange={handleDescriptionChange}
              onDelete={handleDelete}
              dropUp={visibleFlags.length > 3 && i >= visibleFlags.length - 2}
            />
          ))
        )}
      </div>

      {/* Create flag */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            + Add Flag
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="new_flag_name"
                autoFocus
                className="flex-1 h-8 px-3 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <div className="flex items-center gap-1">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewScope(s)}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-full transition-colors ${
                      newScope === s
                        ? SCOPE_COLORS[s]
                        : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What does this flag do? (optional)"
              maxLength={300}
              className="w-full h-8 px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating…' : 'Create Flag'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
