import { useState, useEffect } from 'react'
import { getJournal, addJournalEntry, deleteJournalEntry } from '../../api'
import { useContextMenu } from '../ContextMenu'

const MOODS = [
  { value: 'positive', label: '😊 Positive', dot: 'bg-green-400', pill: 'text-green-600 bg-green-50 dark:bg-green-900/40 dark:text-green-400' },
  { value: 'neutral',  label: '😐 Neutral',  dot: 'bg-gray-400',  pill: 'text-gray-500  bg-gray-100  dark:bg-gray-700        dark:text-gray-300'  },
  { value: 'negative', label: '😟 Negative', dot: 'bg-red-400',   pill: 'text-red-500  bg-red-50    dark:bg-red-900/40     dark:text-red-400'   },
]

const getMood = (val) => MOODS.find(m => m.value === val) || MOODS[1]

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

function TradingJournal() {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm]         = useState({ title: '', content: '', mood: 'neutral' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

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

  const { onContextMenu, ContextMenuPortal } = useContextMenu()

  const handleDelete = async (id) => {
    try {
      await deleteJournalEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      if (expanded === id) setExpanded(null)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-gray-100 dark:border-gray-800 animate-pulse">
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3 mb-2" />
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full mb-1" />
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <ContextMenuPortal />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">Trading Journal</h2>
          {entries.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`text-[11px] font-medium px-3 py-1.5 rounded-xl transition-colors ${
            showForm
              ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              : 'bg-green-500 hover:bg-green-400 text-white'
          }`}
        >
          {showForm ? 'Cancel' : '+ New Entry'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 animate-fade-up">
          {error && (
            <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg mb-3">{error}</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Entry title..."
              autoFocus
              required
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-colors"
            />

            {/* Mood selector */}
            <div className="flex gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm({ ...form, mood: m.value })}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-medium border transition-all ${
                    form.mood === m.value
                      ? m.pill + ' border-current'
                      : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Write about your trades, market analysis, lessons learned..."
              rows={4}
              required
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-colors resize-none"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white py-2 rounded-xl text-xs font-semibold transition-colors"
            >
              {submitting ? 'Saving…' : 'Save Entry'}
            </button>
          </form>
        </div>
      )}

      {/* Entries grid — compact cards, no list */}
      {entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-10 text-center">
          <p className="text-[12px] text-gray-400">No journal entries yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 text-[11px] text-green-500 hover:text-green-400 transition-colors"
          >
            Write your first entry →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {entries.map((entry, idx) => {
            const mood    = getMood(entry.mood)
            const isOpen  = expanded === entry.id
            const preview = entry.content?.slice(0, 90)
            const hasMore = (entry.content?.length || 0) > 90

            return (
              <div
                key={entry.id}
                onContextMenu={onContextMenu([
                  { label: 'Delete', icon: '🗑️', danger: true, action: () => handleDelete(entry.id) },
                ])}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-2 transition-all hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm animate-fade-up"
                style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
              >
                {/* Top row: mood dot + date */}
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mood.dot}`} />
                  <span className="text-[9px] text-gray-400">{formatDate(entry.created_at)}</span>
                </div>

                {/* Title */}
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-snug line-clamp-1">
                  {entry.title}
                </p>

                {/* Content preview / expanded */}
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {isOpen ? entry.content : preview}
                  {!isOpen && hasMore && '…'}
                </p>

                {/* Footer: mood pill + read more */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${mood.pill}`}>
                    {mood.label}
                  </span>
                  {hasMore && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      className="text-[9px] text-gray-400 hover:text-green-500 transition-colors"
                    >
                      {isOpen ? 'show less' : 'read more'}
                    </button>
                  )}
                  {!hasMore && (
                    <span className="text-[9px] text-gray-300 dark:text-gray-700">{formatTime(entry.created_at)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TradingJournal
