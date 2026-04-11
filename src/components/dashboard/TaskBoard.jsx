import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import {
  getTodayTasks, toggleFixedTask,
  addCustomTask, updateCustomTask,
  deleteCustomTask, getMindset
} from '../../api'

const FIXED_TASKS = [
  { id: 'fixed_1', title: 'Read Mindset Reminder', type: 'mindset', icon: '🧠' },
  { id: 'fixed_2', title: 'Check Forex Factory', type: 'external', url: 'https://www.forexfactory.com', icon: '📅' },
  { id: 'fixed_3', title: 'Check Merolagni News', type: 'external', url: 'https://merolagani.com/NewsList.aspx', icon: '📰' },
  { id: 'fixed_4', title: 'Journal NEPSE', type: 'internal', path: '/trader', icon: '📈' },
  { id: 'fixed_5', title: 'Journal Forex', type: 'internal', path: '/trader', icon: '💹' },
]

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🧠</span>
            <h2 className="text-xl font-bold text-white">Mindset Reminder</h2>
          </div>
          <p className="text-blue-200 text-sm">Read carefully before you start trading today</p>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          ) : (
            <div className="space-y-3">
              {content.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          {!canClose ? (
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full border-4 border-blue-500 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{countdown}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Please read for {countdown} more second{countdown !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all duration-1000" style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => { onDone(); onClose() }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span>✓</span> Done Reading — Mark Complete
            </button>
          )}
          <button onClick={onClose} className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 py-1">
            Close without completing
          </button>
        </div>
      </div>
    </div>
  )
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{task.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{task.title}</h2>
              <p className="text-gray-400 text-xs mt-0.5">{task.url}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {phase === 'confirm' && (
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                Click the button below to open the website. After checking it, come back to mark complete.
              </p>
              <button onClick={handleOpen} className="w-full bg-gray-900 dark:bg-gray-700 text-white py-3 rounded-xl font-medium hover:bg-gray-800 flex items-center justify-center gap-2">
                <span>↗</span> Open {task.title}
              </button>
            </div>
          )}
          {phase === 'waiting' && (
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                Website opened in new tab. Come back after checking it.
              </p>
              {!canComplete ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full border-4 border-orange-400 flex items-center justify-center">
                      <span className="text-base font-bold text-orange-500">{countdown}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Wait {countdown}s...</p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-orange-400 transition-all duration-1000" style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <button onClick={() => { onDone(); onClose() }} className="w-full bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-2 mb-3">
                  <span>✓</span> Done — Mark Complete
                </button>
              )}
              <button onClick={handleOpen} className="w-full text-xs text-blue-500 hover:text-blue-700 py-1">↗ Reopen website</button>
            </div>
          )}
        </div>
        <div className="px-6 pb-4">
          <button onClick={onClose} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">Close without completing</button>
        </div>
      </div>
    </div>
  )
}

function TaskBoard({ compact = false, onTaskComplete }) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [fixedTasks, setFixedTasks] = useState(FIXED_TASKS.map(t => ({ ...t, completed: false })))
  const [customTasks, setCustomTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showAddInput, setShowAddInput] = useState(false)
  const [activeModal, setActiveModal] = useState(null)

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

  const totalTasks = fixedTasks.length + customTasks.length
  const completedTasks = fixedTasks.filter(t => t.completed).length + customTasks.filter(t => t.completed).length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const getProgressColor = () => {
    if (progress >= 80) return '#22c55e'
    if (progress >= 50) return '#3b82f6'
    if (progress >= 30) return '#eab308'
    return '#f87171'
  }

  const handleFixedTaskClick = async (task) => {
    if (task.completed) return
    if (task.type === 'mindset') setActiveModal({ type: 'mindset', task })
    else if (task.type === 'external') setActiveModal({ type: 'external', task })
    else if (task.type === 'internal') { await handleTaskDone(task.id); navigate(task.path) }
  }

  const handleTaskDone = async (taskId) => {
    try {
      await toggleFixedTask(taskId)
      setFixedTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
      if (onTaskComplete) onTaskComplete()
    } catch (err) { console.error(err) }
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
      setShowAddInput(false)
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-sm text-gray-400">Loading tasks...</p>
    </div>
  )

  const completedFixed = fixedTasks.filter(t => t.completed)
  const pendingFixed = fixedTasks.filter(t => !t.completed)

  return (
    <>
      {activeModal?.type === 'mindset' && (
        <MindsetModal onClose={() => setActiveModal(null)} onDone={() => handleTaskDone(activeModal.task.id)} />
      )}
      {activeModal?.type === 'external' && (
        <ExternalLinkModal task={activeModal.task} onClose={() => setActiveModal(null)} onDone={() => handleTaskDone(activeModal.task.id)} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-full flex flex-col">

        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('tasks.dailyRoutine')}</h2>
        </div>

        {/* Circular Progress */}
        <div className="flex flex-col items-center py-4">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke={getProgressColor()}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{progress}%</span>
              <span className="text-xs text-gray-400">{completedTasks}/{totalTasks} {t('tasks.completed')}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {completedTasks} / {totalTasks} {t('tasks.completed')}
          </p>
        </div>

        {/* Tasks */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">

          {/* Pending fixed tasks */}
          {pendingFixed.length > 0 && (
            <div className="space-y-1 mb-3">
              {pendingFixed.map(task => (
                <div
                  key={task.id}
                  onClick={() => handleFixedTaskClick(task)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{task.title}</span>
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {task.type === 'external' ? '↗' : task.type === 'internal' ? '→' : '📖'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Completed section */}
          {(completedFixed.length > 0 || customTasks.filter(t => t.completed).length > 0) && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Completed</p>
              <div className="space-y-1">
                {completedFixed.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-400 line-through flex-1">{task.title}</span>
                  </div>
                ))}
                {customTasks.filter(t => t.completed).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-700 group">
                    <button
                      onClick={() => handleToggleCustom(task)}
                      className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <span className="text-sm text-gray-400 line-through flex-1">{task.title}</span>
                    <button onClick={() => handleDeleteCustom(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending custom tasks */}
          {customTasks.filter(t => !t.completed).length > 0 && (
            <div className="space-y-1 mb-3">
              {customTasks.filter(t => !t.completed).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 group transition-colors">
                  <button
                    onClick={() => handleToggleCustom(task)}
                    className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0 hover:border-green-400 transition-colors"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{task.title}</span>
                  <button onClick={() => handleDeleteCustom(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Routine Log */}
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          {showAddInput ? (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                placeholder="Task name..."
                autoFocus
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
              />
              <button type="submit" disabled={adding || !newTask.trim()} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-40">
                {adding ? '...' : '+'}
              </button>
              <button type="button" onClick={() => setShowAddInput(false)} className="text-gray-400 hover:text-gray-600 px-2">✕</button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 group-hover:text-blue-500 text-lg leading-none">+</span>
                <span className="text-sm text-gray-400 group-hover:text-blue-500">{t('tasks.addRoutine')}</span>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default TaskBoard