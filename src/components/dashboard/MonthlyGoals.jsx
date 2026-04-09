import { useState, useEffect } from 'react'
import { getGoals, addGoal, updateGoal, deleteGoal } from '../../api'

function MonthlyGoals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    target_date: ''
  })
  const [adding, setAdding] = useState(false)

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
  const progress = goals.length > 0
    ? Math.round((completedCount / goals.length) * 100)
    : 0

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
      setGoals(prev =>
        prev.map(g => g.id === goal.id
          ? { ...g, completed: !g.completed }
          : g
        )
      )
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

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-400">Loading goals...</p>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Monthly Goals
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ Add Goal'}
          </button>
        </div>
        {goals.length > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{completedCount}/{goals.length} completed</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <form onSubmit={handleAdd}>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">
                Goal Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Achieve 70% win rate this month"
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Details about this goal"
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">
                Target Date (optional)
              </label>
              <input
                type="date"
                value={form.target_date}
                onChange={e => setForm({ ...form, target_date: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? 'Saving...' : 'Save Goal'}
            </button>
          </form>
        </div>
      )}

      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {goals.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-400">No goals set for this month</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "+ Add Goal" to set your monthly targets
            </p>
          </div>
        ) : (
          goals.map(goal => (
            <div
              key={goal.id}
              className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 group"
            >
              <button
                onClick={() => handleToggle(goal)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  goal.completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                }`}
              >
                {goal.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium transition-colors ${
                  goal.completed
                    ? 'line-through text-gray-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {goal.title}
                </p>
                {goal.description && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {goal.description}
                  </p>
                )}
                {goal.target_date && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Target: {goal.target_date}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(goal.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity mt-0.5"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default MonthlyGoals