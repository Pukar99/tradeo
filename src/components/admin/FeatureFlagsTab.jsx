// === FeatureFlagsTab.jsx ===
// Visual pass 2026-08-09 (owner picked option A — the always-on state stripe).
//
// The functional pass (search, filters, delete, inline descriptions, honest
// audience counts) landed last session; this round is the visual one, plus one
// real scanning fix.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { patchAdminFlag, postAdminFlag, deleteAdminFlag } from '@api/admin'
import { getAllAdminFlags, getAdminAnalyticsOverview, clearAdminFlagsCache } from '../../utils/adminCache'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'
import AdminSearchInput from '../common/AdminSearchInput'
import AdminEmptyState from './AdminEmptyState'
import ActionPanel from './ActionPanel'
import toast from 'react-hot-toast'

const SCOPES = ['all', 'basic', 'pro', 'premium', 'beta']

// Pro and Premium wear the app's real tier material — scope IS a tier here,
// which is the rule set in round 1: tier colour only where the data is a tier.
// `all` and `basic` stay neutral and `beta` stays purple, because neither is
// one. Gradients are complete literal strings (Tailwind only compiles class
// names that appear literally in source — see TierMaterial.jsx).
const SCOPE_CHIP = {
  all: 'font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  basic: 'font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pro: 'font-bold text-[#eaf1ff] bg-gradient-to-br from-[#14275c] via-[#2354c9] to-[#5b9dff] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_10px_-4px_rgba(37,99,235,0.55)]',
  premium:
    'font-bold text-[#3a2405] bg-gradient-to-br from-[#7a4a08] via-[#d99a1f] to-[#ffe9ad] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_10px_-4px_rgba(217,150,20,0.55)]',
  beta: 'font-semibold bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
}

const SCOPE_LABEL = {
  all: 'All',
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
  beta: 'Beta',
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All', swatch: 'bg-gray-400 dark:bg-gray-500' },
  { value: 'enabled', label: 'Enabled', swatch: 'bg-emerald-500' },
  { value: 'disabled', label: 'Disabled', swatch: 'bg-gray-400 dark:bg-gray-600' },
]

// Scope isn't enforced anywhere yet (nothing gates behaviour on it) — this is
// purely a targeting LABEL. Audience size uses real tier-distribution data so
// the label is at least honest about who it WOULD reach. The "(Pro+)" suffix
// the old copy carried is dropped: the chip beside it already says Pro.
function audienceLabel(scope, dist) {
  if (!dist) return null
  const { basic = 0, pro = 0, premium = 0 } = dist
  const total = basic + pro + premium
  const n = (v) => `${v} user${v === 1 ? '' : 's'}`
  switch (scope) {
    case 'all':
      return 'Everyone, incl. guests'
    case 'basic':
      return `${n(total)} signed in`
    case 'pro':
      return n(pro + premium)
    case 'premium':
      return n(premium)
    case 'beta':
      return 'No cohort yet'
    default:
      return null
  }
}

function ScopeChip({ scope }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] leading-none flex-shrink-0 ${
        SCOPE_CHIP[scope] || SCOPE_CHIP.all
      }`}
    >
      {SCOPE_LABEL[scope] || scope}
    </span>
  )
}

function FlagRow({
  flag,
  dist,
  onToggle,
  onScopeChange,
  onDescriptionChange,
  onDelete,
  dropUp = false,
}) {
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

  const reach = audienceLabel(flag.scope, dist)

  return (
    <div>
      <div className="group/row relative flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* State stripe — ALWAYS visible, unlike the hover-reveal accent on the
            Users and Content rows. There the left edge is a hover affordance;
            here it carries state, and "which flags are live" is the whole
            reason to open this tab. Same distinction Screen already makes
            between its always-accented dock panels and its hover-reveal cards. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-[3px] ${
            flag.enabled ? 'bg-emerald-500' : 'bg-gray-300/50 dark:bg-gray-600/50'
          }`}
        />

        {/* Name + description (click to edit) */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold font-mono truncate ${
              flag.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {flag.name}
          </p>
          {editingDesc ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveDesc()
                  if (e.key === 'Escape') setEditingDesc(false)
                }}
                autoFocus
                maxLength={300}
                placeholder="What does this flag do?"
                aria-label={`Description for ${flag.name}`}
                className="flex-1 h-7 px-2 text-[11px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gray-900/5 dark:focus:ring-white/5"
              />
              <button
                onClick={saveDesc}
                disabled={descSaving}
                className="px-2 py-1 text-[10px] font-semibold rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 transition-colors"
              >
                {descSaving ? '…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingDesc(false)}
                className="px-2 py-1 text-[10px] rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startEditDesc}
              className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 truncate text-left w-full transition-colors"
              title="Click to edit description"
            >
              {flag.description || <span className="italic text-gray-400">Add a description…</span>}
            </button>
          )}
        </div>

        {/* Scope chip + reach, inline */}
        <div className="hidden sm:block relative w-[190px] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setScopeOpen((p) => !p)}
              disabled={scopeSaving}
              aria-label={`Change scope for ${flag.name}`}
              className="flex-shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-900/10 dark:focus-visible:ring-white/10 disabled:opacity-50"
            >
              {scopeSaving ? (
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] leading-none font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500">
                  …
                </span>
              ) : (
                <ScopeChip scope={flag.scope} />
              )}
            </button>
            {reach && (
              <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500 truncate">
                {reach}
              </span>
            )}
          </div>

          {scopeOpen && (
            <div
              className={`absolute left-0 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50 ${
                dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              {SCOPES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleScope(s)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-[11px] transition-colors ${
                    s === flag.scope
                      ? 'bg-gray-50 dark:bg-gray-800 font-semibold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <ScopeChip scope={s} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Updated */}
        <div className="hidden lg:block w-20 flex-shrink-0">
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{updated}</span>
        </div>

        {/* Toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          role="switch"
          aria-checked={flag.enabled}
          aria-label={`${flag.enabled ? 'Disable' : 'Enable'} ${flag.name}`}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 ${
            flag.enabled
              ? 'bg-emerald-600'
              : 'bg-gray-200 dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-700'
          }`}
        >
          <span
            className={`absolute left-0 top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
              flag.enabled ? 'translate-x-4 bg-white' : 'translate-x-0.5 bg-white dark:bg-gray-400'
            }`}
          />
        </button>

        {/* Delete */}
        <button
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete ${flag.name}`}
          title="Delete flag"
          className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 opacity-100 [@media(hover:hover)]:opacity-45 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z" />
          </svg>
        </button>
      </div>

      {confirmingDelete && (
        <ActionPanel
          tone="red"
          title="Delete flag"
          subject={flag.name}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={confirmDelete}
          loading={deleting}
          loadingLabel="Deleting…"
          confirmLabel="Delete flag"
        >
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {SCOPE_LABEL[flag.scope] || flag.scope}
            {reach ? ` · ${reach} in reach` : ''} · {flag.enabled ? 'currently enabled' : 'currently off'} ·
            last changed {updated}. This cannot be undone.
          </p>
        </ActionPanel>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-2.5 w-56 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="hidden sm:block w-[190px] flex-shrink-0">
        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
      <div className="hidden lg:block w-20 flex-shrink-0">
        <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse flex-shrink-0" />
      <div className="w-6 flex-shrink-0" />
    </div>
  )
}

const FLAG_EMPTY_ICON = (
  <>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <path d="M4 22v-7" />
  </>
)

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
    // — no new endpoint needed, and it's already cached client-side.
    getAdminAnalyticsOverview()
      .then(({ data }) => setDist(data.tierDistribution))
      .catch(() => {})
  }, [fetchFlags])

  const selectStatus = useCallback((v) => setStatus(v), [])
  const {
    containerRef: statusRef,
    indicatorStyle: statusIndicator,
    onPointerDown: onStatusPointerDown,
  } = useSlidingIndicator(status, selectStatus)

  async function handleToggle(name, enabled) {
    try {
      await patchAdminFlag(name, { enabled })
      clearAdminFlagsCache()
      setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, enabled } : f)))
      toast.success(enabled ? `${name} enabled` : `${name} disabled`)
    } catch {
      toast.error('Failed to update flag')
    }
  }

  async function handleScopeChange(name, scope) {
    try {
      await patchAdminFlag(name, { scope })
      clearAdminFlagsCache()
      setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, scope } : f)))
      toast.success(`${name} scope → ${scope}`)
    } catch {
      toast.error('Failed to update scope')
    }
  }

  async function handleDescriptionChange(name, description) {
    try {
      await patchAdminFlag(name, { description })
      clearAdminFlagsCache()
      setFlags((prev) => prev.map((f) => (f.name === name ? { ...f, description } : f)))
    } catch {
      toast.error('Failed to update description')
    }
  }

  async function handleDelete(name) {
    try {
      await deleteAdminFlag(name)
      clearAdminFlagsCache()
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
      // Must drop the cache BEFORE refetching, or fetchFlags() would be served
      // the pre-create snapshot and the new flag wouldn't appear.
      clearAdminFlagsCache()
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

  const enabledCount = useMemo(() => flags.filter((f) => f.enabled).length, [flags])

  const inputCls =
    'w-full h-9 px-3 text-xs bg-gray-100 dark:bg-gray-800 border border-transparent rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-gray-200 dark:focus:border-gray-700 focus:ring-4 focus:ring-gray-900/5 dark:focus:ring-white/5'

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar: search + status filter */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <AdminSearchInput onSearch={setSearch} placeholder="Search name or description…" />
        <div
          ref={statusRef}
          onPointerDown={onStatusPointerDown}
          className="relative flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0"
        >
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 rounded-md bg-white dark:bg-gray-700 shadow-sm transition-[transform,width,height] duration-300 ease-luxury pointer-events-none"
            style={statusIndicator}
          />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              data-indicator-active={status === f.value || undefined}
              data-indicator-key={f.value}
              onClick={() => selectStatus(f.value)}
              className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-md whitespace-nowrap transition-colors ${
                status === f.value
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  status === f.value ? f.swatch : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] tabular-nums text-gray-400 dark:text-gray-500 whitespace-nowrap">
          <b className="text-xs font-bold text-gray-900 dark:text-white">{enabledCount}</b>
          <span className="mx-0.5">/</span>
          {flags.length} on
        </span>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Flag
        </div>
        <div className="hidden sm:block w-[190px] text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0">
          Scope &amp; reach
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
          <AdminEmptyState
            title="No flags yet"
            icon={FLAG_EMPTY_ICON}
            hint="Create one below to start gating a feature."
          />
        ) : visibleFlags.length === 0 ? (
          <AdminEmptyState
            title="No flags match"
            icon={FLAG_EMPTY_ICON}
            hint="Nothing matches this search and filter. Try a different name or status."
          />
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
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <svg
              className="w-2.5 h-2.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add flag
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="new_flag_name"
                aria-label="New flag name"
                autoFocus
                className={`flex-1 min-w-[180px] font-mono ${inputCls}`}
              />
              <div className="inline-flex items-center gap-1 flex-wrap">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewScope(s)}
                    className={`rounded-lg transition-opacity ${newScope === s ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                  >
                    <ScopeChip scope={s} />
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What does this flag do? (optional)"
              aria-label="New flag description"
              maxLength={300}
              className={inputCls}
            />
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-3.5 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating…' : 'Create flag'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-[11px] font-medium rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Honest note — kept, but demoted from a full-bleed blue alert bar to a
          quiet note near the scope controls it's actually about. */}
      <div className="mx-4 mb-4 flex items-start gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl">
        <svg
          className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4m0-4h.01" />
        </svg>
        <p className="text-[10.5px] leading-relaxed text-gray-500 dark:text-gray-400">
          <b className="font-semibold text-gray-700 dark:text-gray-200">Scope isn&apos;t enforced yet.</b>{' '}
          Nothing in the app reads it to gate behaviour — it&apos;s a label. The counts show who each
          scope <em>would</em> reach.
        </p>
      </div>
    </div>
  )
}
