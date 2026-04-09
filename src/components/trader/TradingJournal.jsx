import { useState, useEffect } from 'react'
import { getJournal, addJournalEntry, deleteJournalEntry } from '../../api'

const moods = [
  { value: 'positive', label: 'Positive', color: 'text-green-600 bg-green-50' },
  { value: 'neutral', label: 'Neutral', color: 'text-gray-600 bg-gray-100' },
  { value: 'negative', label: 'Negative', color: 'text-red-500 bg-red-50' },
]

function TradingJournal() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    mood: 'neutral'
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchEntries = async () => {
    try {
      const res = await getJournal()
      setEntries(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEntries() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await addJournalEntry(form)
      setForm({ title: '', content: '', mood: 'neutral' })
      setShowForm(false)
      fetchEntries()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this journal entry?')) return
    try {
      await deleteJournalEntry(id)
      fetchEntries()
    } catch (err) {
      console.error(err)
    }
  }

  const getMoodStyle = (mood) => {
    return moods.find(m => m.value === mood)?.color || 'text-gray-600 bg-gray-100'
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) return (
    <p className="text-gray-400 text-sm">Loading journal...</p>
  )

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Trading Journal
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ New Entry'}
          </button>
        </div>

        {showForm && (
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              New Journal Entry
            </h3>
            {error && (
              <div className="bg-red-50 text-red-600 p-2 rounded text-sm mb-3">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Today's market thoughts..."
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  How are you feeling about the market?
                </label>
                <div className="flex gap-2">
                  {moods.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm({ ...form, mood: m.value })}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        form.mood === m.value
                          ? m.color + ' border-current'
                          : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Journal Entry
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="Write about your trades, market analysis, lessons learned..."
                  rows={4}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Entry'}
              </button>
            </form>
          </div>
        )}

        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {entries.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-400 text-sm">No journal entries yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Click "+ New Entry" to start journaling
              </p>
            </div>
          ) : (
            entries.map(entry => (
              <div
                key={entry.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {entry.title}
                    </h3>
                    {entry.mood && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getMoodStyle(entry.mood)}`}>
                        {entry.mood}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {formatDate(entry.created_at)}
                    </span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {entry.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default TradingJournal