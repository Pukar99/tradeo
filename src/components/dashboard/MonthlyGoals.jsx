// === MonthlyGoals.jsx ===
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getGoals, addGoal, updateGoal, deleteGoal } from '../../api'
import { useContextMenu } from '../ContextMenu'
import { IconPencil, IconTrash } from '../common/icons'
import { useChatRefresh, useHighlightListener } from '../../utils/chatEvents'
import { gCache } from '../../utils/globalCache'
import { useAuth } from '../../context/AuthContext'
import { TIER_ACCENT, TierAccentOverlay, tierRingClass, getDisplayTier } from '../common/TierMaterial'

// ── Date helpers ──────────────────────────────────────────────────────────────

function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function lastDayOfMonth(year, month) {
  // month is 0-indexed
  return new Date(year, month + 1, 0)
}

// Owner rule (3.0): a new goal defaults to the LAST day of the current month —
// same default the chatbot ADD_GOAL uses, so both entry paths agree.
function defaultDeadline() {
  const d = new Date()
  return toLocalDateStr(lastDayOfMonth(d.getFullYear(), d.getMonth()))
}

// Dates before the current month make a goal vanish from the card (it only
// shows current + next month) — both date inputs are floored to the 1st.
function minGoalDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function autoDeadlineForMonth(year, month) {
  return toLocalDateStr(lastDayOfMonth(year, month))
}

// ── Goal visibility filter ────────────────────────────────────────────────────
// Rules:
//   1. Current month: show goals whose deadline falls in the current calendar
//      month OR within the 7-day grace window after month-end.
//   2. Next month preview: if today is ≤10 days before next month, also show
//      next month's goals.
//   3. Goals with no target_date: treated as last day of current month.
//
// Returns { currentGoals, nextGoals, showNextMonth } so callers don't
// recompute the same window logic independently.

function buildVisibleGoals(goals, today) {
  const y = today.getFullYear()
  const m = today.getMonth()

  const currentMonthEnd = lastDayOfMonth(y, m)

  // MG01 fix: graceEnd is in the next calendar month — must check year too
  const graceEnd = new Date(currentMonthEnd)
  graceEnd.setDate(graceEnd.getDate() + 7)

  const nextMonthStart = new Date(y, m + 1, 1)
  const daysToNextMonth = Math.ceil((nextMonthStart - today) / (1000 * 60 * 60 * 24))
  const showNextMonth = daysToNextMonth <= 10

  // MG02 fix: (m + 1) % 12, and correct year for January wrap
  const nextM = (m + 1) % 12
  const nextY = m === 11 ? y + 1 : y

  const currentGoals = []
  const nextGoals = []

  for (const g of goals) {
    const raw = g.target_date || autoDeadlineForMonth(y, m)
    const deadline = new Date(raw + 'T00:00:00')
    const dy = deadline.getFullYear()
    const dm = deadline.getMonth()

    // MG01 fix: parentheses ensure year check wraps both month conditions
    const inCurrentMonth = dy === y && dm === m
    const inGrace = deadline > currentMonthEnd && deadline <= graceEnd

    if (inCurrentMonth || inGrace) {
      currentGoals.push(g)
    } else if (showNextMonth && dy === nextY && dm === nextM) {
      nextGoals.push(g)
    }
  }

  return { currentGoals, nextGoals, showNextMonth, nextY, nextM }
}

// ── Deadline urgency badge ─────────────────────────────────────────────────────

function DeadlineBadge({ target_date, completed }) {
  if (!target_date || completed) return null

  // MG04 fix: fresh Date on every render — not frozen from mount
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(target_date + 'T00:00:00')
  const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))

  const label = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  let cls = 'text-gray-400 dark:text-gray-500'
  if (diffDays < 0) cls = 'text-red-500 dark:text-red-400'
  else if (diffDays <= 3) cls = 'text-amber-500 dark:text-amber-400'

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] mt-0.5 ${cls}`}>
      <svg
        className="w-3 h-3 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      {label}
      {diffDays < 0 && <span className="ml-0.5">· overdue</span>}
      {diffDays >= 0 && diffDays <= 3 && (
        <span className="ml-0.5">· {diffDays === 0 ? 'today' : `${diffDays}d left`}</span>
      )}
    </span>
  )
}

// ── Month label helper ────────────────────────────────────────────────────────

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ── Main component ────────────────────────────────────────────────────────────

const GOALS_DEFAULT_LIMIT = 4

function MonthlyGoals({ initData }) {
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const [goals, setGoals] = useState(initData || [])
  const [loading, setLoading] = useState(!initData)
  const [fetchError, setFetchError] = useState(null) // MG13
  const [mutateErr, setMutateErr] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_date: defaultDeadline() })
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', target_date: '' })
  const [saving, setSaving] = useState(false)
  const [showAllGoals, setShowAllGoals] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const rowRefs = useRef({}) // goalId → row DOM node
  const highlightTimer = useRef(null)

  const fetchGoals = useCallback(async () => {
    setFetchError(null)
    try {
      const res = await getGoals()
      setGoals(res.data)
    } catch (err) {
      console.error('[MonthlyGoals fetch]', err)
      setFetchError('Failed to load goals') // MG13 fix
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initData) {
      setGoals(initData)
      setLoading(false)
      return
    }
    fetchGoals()
  }, [initData]) // eslint-disable-line react-hooks/exhaustive-deps

  useChatRefresh(['goals'], fetchGoals)

  // ── Filtered view ─────────────────────────────────────────────────────────
  // MG04 fix: plain variable — recalculates every render, stays fresh past midnight
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const y = today.getFullYear()
  const m = today.getMonth()

  // MG03 + MG05 fix: single call, no duplicated window logic
  const {
    currentGoals: currentMonthGoals,
    nextGoals: nextMonthGoals,
    showNextMonth,
    nextY,
    nextM,
  } = useMemo(() => buildVisibleGoals(goals, today), [goals, today.toDateString()])

  const completedCount = currentMonthGoals.filter((g) => g.completed).length
  const totalCount = currentMonthGoals.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Sort by deadline urgency: overdue first, then nearest upcoming, completed last
  const sortedCurrentGoals = useMemo(() => {
    const todayMs = today.getTime()
    return [...currentMonthGoals].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      const aMs = a.target_date ? new Date(a.target_date + 'T00:00:00').getTime() : Infinity
      const bMs = b.target_date ? new Date(b.target_date + 'T00:00:00').getTime() : Infinity
      // overdue (past) before future; among same side, nearest first
      const aOverdue = aMs < todayMs
      const bOverdue = bMs < todayMs
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
      return aMs - bMs
    })
  }, [currentMonthGoals, today.toDateString()])

  const visibleCurrentGoals = showAllGoals
    ? sortedCurrentGoals
    : sortedCurrentGoals.slice(0, GOALS_DEFAULT_LIMIT)
  const hasMoreGoals = sortedCurrentGoals.length > GOALS_DEFAULT_LIMIT

  // ── Highlight on alert click ───────────────────────────────────────────────
  // A goal alert was clicked → expand the list if the goal is collapsed, scroll
  // it into view, and flash the glow. Match by id, or fall back to title (alerts
  // built from /init carry the title when the id isn't to hand).
  useHighlightListener('goals', (key) => {
    const match = goals.find((g) => g.id === key || g.title === key)
    if (!match) return
    // Ensure it's rendered: if it's past the fold, expand "Show all".
    const idx = sortedCurrentGoals.findIndex((g) => g.id === match.id)
    if (idx >= GOALS_DEFAULT_LIMIT) setShowAllGoals(true)
    setHighlightId(match.id)
    // Wait a frame for layout (expand / route change), then scroll + flash.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rowRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2100)
  })

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleAdd = async (e) => {
    e.preventDefault()
    // min= on the input doesn't stop a hand-typed past date — guard here too.
    if (form.target_date && form.target_date < minGoalDate()) {
      setMutateErr('Deadline cannot be before this month')
      return
    }
    setAdding(true)
    setMutateErr(null)
    try {
      const deadline = form.target_date || autoDeadlineForMonth(y, m)
      const res = await addGoal({ ...form, target_date: deadline })
      setGoals((prev) => [res.data, ...prev])
      setForm({ title: '', description: '', target_date: defaultDeadline() })
      setShowForm(false)
      gCache.del('dashboard')
    } catch {
      setMutateErr('Failed to add goal')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (goal) => {
    setMutateErr(null)
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, completed: !g.completed } : g)))
    try {
      await updateGoal(goal.id, !goal.completed)
      gCache.del('dashboard')
    } catch {
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, completed: goal.completed } : g))
      )
      setMutateErr('Failed to update goal')
    }
  }

  // MG08 fix: optimistic delete — remove immediately, restore on failure
  const handleDelete = async (id) => {
    setMutateErr(null)
    const snapshot = goals.find((g) => g.id === id)
    setGoals((prev) => prev.filter((g) => g.id !== id))
    try {
      await deleteGoal(id)
      gCache.del('dashboard')
    } catch {
      if (snapshot) setGoals((prev) => [...prev, snapshot])
      setMutateErr('Failed to delete goal')
    }
  }

  // MG09 fix: clear error on any UI interaction that starts a new action
  const startEdit = (goal) => {
    setMutateErr(null)
    setEditingId(goal.id)
    setEditForm({
      title: goal.title,
      description: goal.description || '',
      target_date: goal.target_date || '',
    })
    setShowForm(false)
  }

  const cancelEdit = () => {
    setMutateErr(null)
    setEditingId(null)
    setEditForm({ title: '', description: '', target_date: '' })
  }

  const handleSaveEdit = async (id) => {
    if (!editForm.title.trim()) return
    if (editForm.target_date && editForm.target_date < minGoalDate()) {
      setMutateErr('Deadline cannot be before this month')
      return
    }
    setSaving(true)
    setMutateErr(null)
    try {
      const deadline = editForm.target_date || autoDeadlineForMonth(y, m)
      const res = await updateGoal(id, { ...editForm, target_date: deadline })
      setGoals((prev) => prev.map((g) => (g.id === id ? res.data : g)))
      setEditingId(null)
      gCache.del('dashboard')
    } catch {
      setMutateErr('Failed to save edit')
    } finally {
      setSaving(false)
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loading)
    return (
      <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm p-4 h-full flex flex-col gap-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-12" />
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-full" />
        <div className="flex-1 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    )

  // MG13 fix: show error + retry instead of silent empty state
  if (fetchError)
    return (
      <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm p-4 flex flex-col items-center justify-center gap-3 min-h-[100px]">
        <p className="text-[11px] text-red-400">{fetchError}</p>
        <button
          onClick={fetchGoals}
          className="text-[11px] px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`hp-card group relative bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl ${accent ? '' : 'border'} border-white/60 dark:border-white/10 overflow-hidden h-full flex flex-col min-h-0 ${accent ? tierRingClass(displayTier) : 'shadow-sm'}`}
    >
      <TierAccentOverlay accent={accent} />
      <ContextMenuPortal />

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Goals
            </h2>
            {totalCount > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {completedCount}/{totalCount} done · {progress}%
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setMutateErr(null)
              setShowForm((s) => !s)
              setEditingId(null)
            }}
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
              showForm
                ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                : 'text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
            }`}
          >
            {showForm ? (
              <>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </>
            )}
          </button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress === 100
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                  : progress >= 50
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-400'
                    : 'bg-indigo-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="mx-3 mb-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-700/60">
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Goal title"
              autoFocus
              required
              maxLength={200}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600 transition-all"
            />
            {/* MG07 fix: maxLength on description */}
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Note (optional)"
              maxLength={500}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600 transition-all"
            />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="date"
                  value={form.target_date}
                  min={minGoalDate()}
                  onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={adding || !form.title.trim()}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              >
                {adding ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              Deadline auto-set to end of month if left empty.
            </p>
          </form>
        </div>
      )}

      {/* Mutate error */}
      {mutateErr && (
        <p className="mx-3 mb-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-2 py-1 rounded-lg">
          {mutateErr}
        </p>
      )}

      {/* ── Inline edit form — outside scroll area so it never scrolls off-screen ── */}
      {editingId && (
        <div className="mx-3 mb-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-700/60 space-y-2 flex-shrink-0">
          <input
            type="text"
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
            maxLength={200}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
          />
          <input
            type="text"
            value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Note (optional)"
            maxLength={500}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
          />
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={editForm.target_date}
              min={minGoalDate()}
              onChange={(e) => setEditForm((f) => ({ ...f, target_date: e.target.value }))}
              className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
            />
            <button
              onClick={() => handleSaveEdit(editingId)}
              disabled={saving || !editForm.title.trim()}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1.5 rounded-lg text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Goal list ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 space-y-0.5 pb-1">
          {/* Current month */}
          {currentMonthGoals.length === 0 && !showForm ? (
            <div className="py-6 text-center">
              <p className="text-[11px] text-gray-400">No goals for {monthLabel(y, m)}</p>
              <button
                onClick={() => {
                  setMutateErr(null)
                  setShowForm(true)
                }}
                className="mt-1.5 text-[11px] text-indigo-500 hover:text-indigo-400 transition-colors"
              >
                + Add your first goal
              </button>
            </div>
          ) : (
            visibleCurrentGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                editingId={editingId}
                highlighted={highlightId === goal.id}
                rowRef={(el) => {
                  if (el) rowRefs.current[goal.id] = el
                  else delete rowRefs.current[goal.id]
                }}
                onToggle={handleToggle}
                onStartEdit={startEdit}
                onDelete={handleDelete}
                onContextMenu={onContextMenu}
              />
            ))
          )}

          {/* Next month preview */}
          {showNextMonth && nextMonthGoals.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-3 pb-1 px-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600">
                  {monthLabel(nextY, nextM)}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
              {nextMonthGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  editingId={editingId}
                  highlighted={highlightId === goal.id}
                  rowRef={(el) => {
                    if (el) rowRefs.current[goal.id] = el
                    else delete rowRefs.current[goal.id]
                  }}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  saving={saving}
                  onToggle={handleToggle}
                  onStartEdit={startEdit}
                  onDelete={handleDelete}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={cancelEdit}
                  onContextMenu={onContextMenu}
                />
              ))}
            </>
          )}
        </div>

        {/* Show all — sticky at bottom, outside scroll area */}
        {hasMoreGoals && currentMonthGoals.length > 0 && (
          <button
            onClick={() => setShowAllGoals((s) => !s)}
            className="flex-shrink-0 py-2 text-[10px] font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors border-t border-gray-100 dark:border-gray-800 text-center w-full"
          >
            {showAllGoals ? '↑ Show less' : `Show all ${sortedCurrentGoals.length} goals`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── GoalRow ───────────────────────────────────────────────────────────────────

function GoalRow({
  goal,
  editingId,
  highlighted,
  rowRef,
  onToggle,
  onStartEdit,
  onDelete,
  onContextMenu,
}) {
  const isEditing = editingId === goal.id

  return (
    <div
      ref={rowRef}
      onContextMenu={onContextMenu([
        { label: 'Edit', icon: <IconPencil />, action: () => onStartEdit(goal) },
        { separator: true },
        { label: 'Delete', icon: <IconTrash />, danger: true, action: () => onDelete(goal.id) },
      ])}
      className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
        isEditing
          ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
      } ${goal.completed ? 'opacity-55' : ''} ${highlighted ? 'hp-highlight' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(goal)}
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          goal.completed
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
        }`}
      >
        {goal.completed && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[12px] font-medium leading-snug ${
            goal.completed
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100'
          }`}
        >
          {goal.title}
        </p>
        {goal.description && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
            {goal.description}
          </p>
        )}
        <DeadlineBadge target_date={goal.target_date} completed={goal.completed} />
      </div>
    </div>
  )
}

export default MonthlyGoals
