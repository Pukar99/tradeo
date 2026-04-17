import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import {
  getTodayTasks, toggleFixedTask,
  addCustomTask, updateCustomTask,
  deleteCustomTask, getMindset
} from '../../api'
import { useContextMenu } from '../ContextMenu'

const FIXED_TASKS = [
  { id: 'fixed_1', title: 'Read Mindset Reminder', type: 'mindset',   icon: '🧠' },
  { id: 'fixed_2', title: 'Check Forex Factory',   type: 'external',  url: 'https://www.forexfactory.com',             icon: '📅' },
  { id: 'fixed_3', title: 'Check Merolagni News',  type: 'external',  url: 'https://merolagani.com/NewsList.aspx',      icon: '📰' },
  { id: 'fixed_4', title: 'Journal NEPSE',          type: 'internal',  path: '/logs', icon: '📈' },
  { id: 'fixed_5', title: 'Journal Forex',          type: 'internal',  path: '/logs', icon: '💹' },
]

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ── Countdown bar ─────────────────────────────────────────────────────────────
function CountdownBar({ total, remaining }) {
  const pct = ((total - remaining) / total) * 100
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Read for {remaining}s more…</span>
        <span className="text-[10px] font-semibold text-gray-500">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Mindset modal ─────────────────────────────────────────────────────────────
function MindsetModal({ onClose, onDone }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [canClose, setCanClose] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    getMindset()
      .then(res => setContent(res.data?.content || ''))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); setCanClose(true); return 0 }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [loading])

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-base">🧠</span>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Mindset Reminder</p>
            <p className="text-[10px] text-gray-400">Read carefully before trading today</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 max-h-64 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${90 - i * 8}%` }} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {content.split('\n').filter(Boolean).map((line, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        {!canClose ? (
          <CountdownBar total={5} remaining={countdown} />
        ) : (
          <button
            onClick={() => { onDone(); onClose() }}
            className="w-full bg-green-500 hover:bg-green-400 text-white py-2.5 rounded-xl text-[11px] font-semibold transition-colors"
          >
            Done Reading — Mark Complete
          </button>
        )}
        <button onClick={onClose} className="w-full text-[10px] text-gray-400 hover:text-gray-500 py-1 transition-colors">
          Close without completing
        </button>
      </div>
    </Modal>
  )
}

// ── External link modal ───────────────────────────────────────────────────────
function ExternalLinkModal({ task, onClose, onDone }) {
  const [phase, setPhase] = useState('confirm')
  const [countdown, setCountdown] = useState(5)
  const [canComplete, setCanComplete] = useState(false)

  const handleOpen = () => {
    window.open(task.url, '_blank')
    setPhase('waiting')
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setCanComplete(true); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-base">{task.icon}</span>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{task.title}</p>
            <p className="text-[9px] text-gray-400 truncate max-w-[220px]">{task.url}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-3">
        {phase === 'confirm' && (
          <>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Open the website, review it, then come back to mark this task complete.
            </p>
            <button
              onClick={handleOpen}
              className="w-full bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white py-2.5 rounded-xl text-[11px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open {task.title}
            </button>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Website opened. Come back after checking it.</p>
            {!canComplete ? (
              <CountdownBar total={5} remaining={countdown} />
            ) : (
              <button
                onClick={() => { onDone(); onClose() }}
                className="w-full bg-green-500 hover:bg-green-400 text-white py-2.5 rounded-xl text-[11px] font-semibold transition-colors"
              >
                Done — Mark Complete
              </button>
            )}
            <button onClick={handleOpen} className="w-full text-[10px] text-blue-400 hover:text-blue-500 py-1 transition-colors">
              Reopen website ↗
            </button>
          </>
        )}
      </div>

      <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
        <button onClick={onClose} className="w-full text-[10px] text-gray-400 hover:text-gray-500 py-1 transition-colors">
          Close without completing
        </button>
      </div>
    </Modal>
  )
}

// ── Progress ring (mirrors DisciplineScore Ring) ──────────────────────────────
function ProgressRing({ progress }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ
  const color =
    progress >= 80 ? '#10b981' :
    progress >= 50 ? '#3b82f6' :
    progress >= 30 ? '#eab308' : '#f87171'
  const textColor =
    progress >= 80 ? 'text-emerald-500' :
    progress >= 50 ? 'text-blue-500' :
    progress >= 30 ? 'text-yellow-500' : 'text-red-400'

  return (
    <div className="relative flex-shrink-0" style={{ width: 76, height: 76 }}>
      <svg width={76} height={76} viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none"
          stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="6" />
        <circle cx="38" cy="38" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[15px] font-bold leading-none ${textColor}`}>{progress}%</span>
      </div>
    </div>
  )
}

// ── Check icon ────────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ done, label, onClick, onDelete, hint }) {
  const handleContextMenu = onDelete ? (e) => {
    e.preventDefault()
    e.stopPropagation()
    // dispatch custom event so TaskBoard's context menu picks it up
    window.dispatchEvent(new CustomEvent('taskrow-context', { detail: { x: e.clientX, y: e.clientY, onDelete } }))
  } : undefined

  return (
    <div
      onClick={!done ? onClick : undefined}
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors
        ${!done ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'opacity-60'}`}
    >
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all
          ${done ? 'bg-green-400' : 'border border-gray-300 dark:border-gray-600'}`}
        onClick={e => { if (done && onClick) { e.stopPropagation(); onClick() } }}
      >
        {done && <Check />}
      </div>
      <span className={`text-[11px] flex-1 leading-snug ${done ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>
        {label}
      </span>
      {!done && hint && (
        <span className="text-[9px] text-gray-300 dark:text-gray-600">{hint}</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
function TaskBoard({ onTaskComplete }) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [fixedTasks, setFixedTasks]   = useState(FIXED_TASKS.map(t => ({ ...t, completed: false })))
  const [customTasks, setCustomTasks] = useState([])
  const [newTask, setNewTask]         = useState('')
  const [loading, setLoading]         = useState(true)
  const [adding, setAdding]           = useState(false)
  const [showAdd, setShowAdd]         = useState(false)
  const [activeModal, setActiveModal] = useState(null)
  const { onContextMenu: _ocm, ContextMenuPortal } = useContextMenu()

  // TaskRow fires a custom event; we handle it here with our context menu instance
  useEffect(() => {
    const handler = (e) => {
      const { x, y, onDelete } = e.detail
      const fakeEvent = { clientX: x, clientY: y, preventDefault: () => {}, stopPropagation: () => {} }
      _ocm([{ label: 'Delete', icon: '🗑️', danger: true, action: onDelete }])(fakeEvent)
    }
    window.addEventListener('taskrow-context', handler)
    return () => window.removeEventListener('taskrow-context', handler)
  }, [_ocm])

  const fetchTasks = async () => {
    try {
      const res = await getTodayTasks()
      const { fixedTasks: ft, customTasks: ct } = res.data
      setFixedTasks(FIXED_TASKS.map(task => ({
        ...task,
        completed: ft.find(f => f.id === task.id)?.completed || false
      })))
      setCustomTasks(ct)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [])

  const totalTasks     = fixedTasks.length + customTasks.length
  const completedCount = fixedTasks.filter(t => t.completed).length + customTasks.filter(t => t.completed).length
  const progress       = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  const barColor =
    progress >= 80 ? 'bg-emerald-400' :
    progress >= 50 ? 'bg-blue-400' :
    progress >= 30 ? 'bg-yellow-400' : 'bg-red-400'

  const handleFixedClick = async (task) => {
    if (task.completed) return
    if (task.type === 'mindset')  setActiveModal({ type: 'mindset', task })
    else if (task.type === 'external') setActiveModal({ type: 'external', task })
    else if (task.type === 'internal') { await handleTaskDone(task.id); navigate(task.path) }
  }

  const handleTaskDone = async (taskId) => {
    try {
      const res = await toggleFixedTask(taskId)
      console.log('[toggle]', taskId, res.data)
      setFixedTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
      if (onTaskComplete) onTaskComplete()
    } catch (err) { console.error('[toggle error]', err.response?.data || err.message) }
  }

  const handleToggleCustom = async (task) => {
    try {
      await updateCustomTask(task.id, !task.completed)
      setCustomTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
      if (onTaskComplete) onTaskComplete()
    } catch (err) { console.error(err) }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return
    setAdding(true)
    try {
      const res = await addCustomTask(newTask.trim())
      setCustomTasks(prev => [...prev, res.data])
      setNewTask('')
      setShowAdd(false)
    } catch (err) { console.error(err) }
    finally { setAdding(false) }
  }

  const handleDeleteCustom = async (id) => {
    try {
      await deleteCustomTask(id)
      setCustomTasks(prev => prev.filter(t => t.id !== id))
    } catch (err) { console.error(err) }
  }

  if (loading) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-2.5 animate-pulse">
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3 mb-4" />
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center gap-2.5 px-2">
          <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
          <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
        </div>
      ))}
    </div>
  )

  const pendingFixed   = fixedTasks.filter(t => !t.completed)
  const completedFixed = fixedTasks.filter(t => t.completed)
  const pendingCustom  = customTasks.filter(t => !t.completed)
  const doneCustom     = customTasks.filter(t => t.completed)

  const hintFor = (task) => {
    if (task.type === 'external') return '↗ open'
    if (task.type === 'internal') return '→ go'
    return '📖 read'
  }

  return (
    <>
      <ContextMenuPortal />
      {activeModal?.type === 'mindset' && (
        <MindsetModal onClose={() => setActiveModal(null)} onDone={() => handleTaskDone(activeModal.task.id)} />
      )}
      {activeModal?.type === 'external' && (
        <ExternalLinkModal task={activeModal.task} onClose={() => setActiveModal(null)} onDone={() => handleTaskDone(activeModal.task.id)} />
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Daily Routine
          </h3>
          <span className="text-[10px] text-gray-400">
            {completedCount}/{totalTasks}
          </span>
        </div>

        {/* Progress ring + task breakdown */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <ProgressRing progress={progress} />
            <div className="flex-1 space-y-2">
              {/* Fixed tasks mini bars */}
              {fixedTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.completed ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${task.completed ? barColor : ''}`}
                      style={{ width: task.completed ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-gray-400 pt-0.5">{completedCount} of {totalTasks} tasks done</p>
            </div>
          </div>
        </div>

        {/* Task list */}
        <div className="overflow-y-auto no-scrollbar px-2 py-2">

          {/* Pending fixed */}
          {pendingFixed.length > 0 && (
            <div className="mb-1">
              {pendingFixed.map(task => (
                <TaskRow
                  key={task.id}
                  done={false}
                  label={task.title}
                  hint={hintFor(task)}
                  onClick={() => handleFixedClick(task)}
                />
              ))}
            </div>
          )}

          {/* Pending custom */}
          {pendingCustom.length > 0 && (
            <div className="mb-1">
              {pendingCustom.map(task => (
                <TaskRow
                  key={task.id}
                  done={false}
                  label={task.title}
                  onClick={() => handleToggleCustom(task)}
                  onDelete={() => handleDeleteCustom(task.id)}
                />
              ))}
            </div>
          )}

          {/* Completed section */}
          {(completedFixed.length > 0 || doneCustom.length > 0) && (
            <div className="mt-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-700 px-2 mb-1">
                Completed
              </p>
              {completedFixed.map(task => (
                <TaskRow key={task.id} done label={task.title} />
              ))}
              {doneCustom.map(task => (
                <TaskRow
                  key={task.id}
                  done
                  label={task.title}
                  onClick={() => handleToggleCustom(task)}
                  onDelete={() => handleDeleteCustom(task.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add task footer */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          {showAdd ? (
            <form onSubmit={handleAddTask} className="flex gap-1.5">
              <input
                type="text"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                placeholder="Add a task…"
                autoFocus
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-[11px] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-colors"
              />
              <button
                type="submit"
                disabled={adding || !newTask.trim()}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors"
              >
                {adding ? '…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewTask('') }}
                className="text-gray-400 hover:text-gray-600 px-2 text-[11px] transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-[11px] text-green-500 hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom task
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default TaskBoard
