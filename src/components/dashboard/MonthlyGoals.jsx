import { useState, useEffect } from 'react'
import { getGoals, addGoal, updateGoal, deleteGoal } from '../../api'
import { useLanguage } from '../../context/LanguageContext'
import { useContextMenu } from '../ContextMenu'

function MonthlyGoals() {
  const { t } = useLanguage()
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_date: '' })
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', target_date: '' })
  const [saving, setSaving] = useState(false)

  const fetchGoals = async () => {
    try {
      const res = await getGoals()
      setGoals(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGoals() }, [])

  const completedCount = goals.filter(g => g.completed).length
  const progress = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await addGoal(form)
      setGoals(prev => [res.data, ...prev])
      setForm({ title: '', description: '', target_date: '' })
      setShowForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (goal) => {
    try {
      await updateGoal(goal.id, !goal.completed)
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, completed: !g.completed } : g))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteGoal(id)
      setGoals(prev => prev.filter(g => g.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const startEdit = (goal) => {
    setEditingId(goal.id)
    setEditForm({ title: goal.title, description: goal.description || '', target_date: goal.target_date || '' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ title: '', description: '', target_date: '' })
  }

  const handleSaveEdit = async (id) => {
    if (!editForm.title.trim()) return
    setSaving(true)
    try {
      const res = await updateGoal(id, editForm)
      setGoals(prev => prev.map(g => g.id === id ? res.data : g))
      setEditingId(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full mt-3" />
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl mt-2" />
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <ContextMenuPortal />

      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">{t('goals.title')}</h2>
            {goals.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {completedCount}/{goals.length} {t('goals.completed')} · {progress}%
              </p>
            )}
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null) }}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
              showForm
                ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
            }`}
          >
            {showForm ? t('goals.cancel') : t('goals.add')}
          </button>
        </div>

        {/* Progress bar */}
        {goals.length > 0 && (
          <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-gray-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mx-3 mb-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={t('goals.titleLabel')}
              autoFocus
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-400 dark:focus:border-green-600 transition-colors"
              required
            />
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={t('goals.descLabel')}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-400 dark:focus:border-green-600 transition-colors"
            />
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={form.target_date}
                onChange={e => setForm({ ...form, target_date: e.target.value })}
                className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-green-400 dark:focus:border-green-600 transition-colors"
              />
              <button
                type="submit"
                disabled={adding || !form.title.trim()}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              >
                {adding ? t('goals.saving') : t('goals.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goal list */}
      <div className="px-3 pb-3 space-y-1.5">
        {goals.length === 0 && !showForm ? (
          <div className="py-6 text-center">
            <p className="text-[11px] text-gray-400">{t('goals.noGoals')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-[11px] text-green-500 hover:text-green-400 transition-colors"
            >
              {t('goals.noGoalsHint')}
            </button>
          </div>
        ) : (
          goals.map(goal => (
            <div key={goal.id}>
              {editingId === goal.id ? (
                /* ── Inline edit ── */
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 space-y-2">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    autoFocus
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-green-400 transition-colors"
                  />
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description (optional)"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={editForm.target_date}
                      onChange={e => setEditForm({ ...editForm, target_date: e.target.value })}
                      className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-green-400 transition-colors"
                    />
                    <button
                      onClick={() => handleSaveEdit(goal.id)}
                      disabled={saving || !editForm.title.trim()}
                      className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      {saving ? t('goals.saving') : t('goals.save')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    >
                      {t('goals.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal row ── */
                <div
                  onContextMenu={onContextMenu([
                    { label: 'Edit', icon: '✏️', action: () => startEdit(goal) },
                    { separator: true },
                    { label: 'Delete', icon: '🗑️', danger: true, action: () => handleDelete(goal.id) },
                  ])}
                  className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  goal.completed ? 'opacity-60' : ''
                }`}>
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggle(goal)}
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      goal.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                    }`}
                  >
                    {goal.completed && (
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-medium leading-snug ${
                      goal.completed
                        ? 'line-through text-gray-400 dark:text-gray-500'
                        : 'text-gray-800 dark:text-gray-100'
                    }`}>
                      {goal.title}
                    </p>
                    {goal.description && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">{goal.description}</p>
                    )}
                    {goal.target_date && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        🗓 {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default MonthlyGoals
