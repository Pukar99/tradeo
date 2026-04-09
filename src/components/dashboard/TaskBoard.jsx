import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTodayTasks,
  toggleFixedTask,
  addCustomTask,
  updateCustomTask,
  deleteCustomTask,
  getMindset
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
            <p className="text-gray-400 text-sm text-center py-4">Loading your mindset content...</p>
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
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
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
                Click the button below to open the website. After you have checked it, come back here to mark this task complete.
              </p>
              <button
                onClick={handleOpen}
                className="w-full bg-gray-900 dark:bg-gray-700 text-white py-3 rounded-xl font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
              >
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Wait {countdown} second{countdown !== 1 ? 's' : ''}...
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-orange-400 transition-all duration-1000"
                      style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { onDone(); onClose() }}
                  className="w-full bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-2 mb-3"
                >
                  <span>✓</span> Done — Mark Complete
                </button>
              )}
              <button onClick={handleOpen} className="w-full text-xs text-blue-500 hover:text-blue-700 py-1">
                ↗ Reopen website
              </button>
            </div>
          )}
        </div>
        <div className="px-6 pb-4">
          <button onClick={onClose} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
            Close without completing
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskBoard({ compact = false }) {
  const navigate = useNavigate()
  const [fixedTasks, setFixedTasks] = useState(FIXED_TASKS.map(t => ({ ...t, completed: false })))
  const [customTasks, setCustomTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
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
    } catch (err) { console.error(err) }
  }

  const handleToggleCustom = async (task) => {
    try {
      await updateCustomTask(task.id, !task.completed)
      setCustomTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
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
    } catch (err) { console.error(err) }
    finally { setAdding(false) }
  }

  const handleDeleteCustom = async (id) => {
    try {
      await deleteCustomTask(id)
      setCustomTasks(prev => prev.filter(t => t.id !== id))
    } catch (err) { console.error(err) }
  }

  const getProgressColor = () => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 30) return 'bg-yellow-500'
    return 'bg-red-400'
  }

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-400">Loading tasks...</p>
    </div>
  )

  const p = compact ? 'p-3' : 'p-4'
  const px = compact ? 'px-3' : 'px-4'
  const pb = compact ? 'pb-3' : 'pb-4'
  const space = compact ? 'space-y-0.5' : 'space-y-1'

  return (
    <>
      {activeModal?.type === 'mindset' && (
        <MindsetModal
          onClose={() => setActiveModal(null)}
          onDone={() => handleTaskDone(activeModal.task.id)}
        />
      )}
      {activeModal?.type === 'external' && (
        <ExternalLinkModal
          task={activeModal.task}
          onClose={() => setActiveModal(null)}
          onDone={() => handleTaskDone(activeModal.task.id)}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">

        <div className={`${p} border-b border-gray-100 dark:border-gray-700`}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Today's Taskboard
            </h2>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {completedTasks}/{totalTasks} done
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Today: {progress}% completed</p>
        </div>

        <div className={p}>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Daily Routine
          </p>
          <div className={space}>
            {fixedTasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleFixedTaskClick(task)}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  task.completed
                    ? 'opacity-50'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {task.completed && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{task.icon}</span>
                <span className={`text-sm flex-1 ${
                  task.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {task.title}
                </span>
                {!task.completed && (
                  <span className="text-xs text-gray-400">
                    {task.type === 'external' ? '↗' : task.type === 'internal' ? '→' : '📖'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={`${px} ${pb}`}>
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Your Tasks
            </p>
            {customTasks.length > 0 && (
              <div className={`${space} mb-2`}>
                {customTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg group hover:bg-gray-50 dark:hover:bg-gray-700">
                    <button
                      onClick={() => handleToggleCustom(task)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm flex-1 ${
                      task.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {task.title}
                    </span>
                    <button
                      onClick={() => handleDeleteCustom(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                placeholder="Add a task... (optional)"
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={adding || !newTask.trim()}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
              >
                +
              </button>
            </form>
          </div>
        </div>

      </div>
    </>
  )
}

export default TaskBoard