// === TaskBoard.jsx — daily routine: 3 fixed tasks (mindset, news, journal) + custom tasks ===
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTodayTasks, toggleFixedTask,
  addCustomTask, updateCustomTask,
  deleteCustomTask, getMindset,
  getMarketNews,
} from '../../api'
import { gCache } from '../../utils/globalCache'
import { useContextMenu } from '../ContextMenu'

// ── SVG icons (no emojis) ─────────────────────────────────────────────────────
const Icons = {
  mindset: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  news: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  journal: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  custom: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  check: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  chevron: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  externalLink: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  plus: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  tradeLog: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  marketLog: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  openLogs: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
}

const FIXED_TASKS = [
  { id: 'fixed_1', title: 'Read Mindset Reminder', type: 'mindset'  },
  { id: 'fixed_3', title: 'Read News Today',        type: 'news'     },
  { id: 'fixed_4', title: 'Journal',                type: 'journal'  },
]

// ── News prioritization ───────────────────────────────────────────────────────
const TYPE_PRIORITY = { dividend: 0, bonus: 1, ipo: 2, corporate: 3, news: 4, macro: 5 }

function prioritizeNews(articles) {
  return [...articles]
    .sort((a, b) => {
      const pa = a.symbol ? -1 : (TYPE_PRIORITY[a.type] ?? 6)
      const pb = b.symbol ? -1 : (TYPE_PRIORITY[b.type] ?? 6)
      if (pa !== pb) return pa - pb
      return (b.date || '') > (a.date || '') ? 1 : -1
    })
    .slice(0, 5)
}

// ── Sentiment indicator ───────────────────────────────────────────────────────
function SentimentDot({ sentiment }) {
  const color =
    sentiment === 'positive' ? 'bg-emerald-400' :
    sentiment === 'negative' ? 'bg-red-400' : 'bg-gray-300 dark:bg-gray-600'
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px] ${color}`} />
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ── Modal header ──────────────────────────────────────────────────────────────
function ModalHeader({ icon, iconBg, title, subtitle, action }) {
  return (
    <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{title}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  )
}

// ── Countdown bar ─────────────────────────────────────────────────────────────
function CountdownBar({ total, remaining }) {
  const pct = ((total - remaining) / total) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{remaining}s remaining</span>
        <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Modal footer ──────────────────────────────────────────────────────────────
function ModalFooter({ canClose, countdown, onDone, onClose, doneLabel = 'Mark Complete' }) {
  const handleDone = async () => {
    await onDone()
    onClose()
  }
  return (
    <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
      {!canClose ? (
        <CountdownBar total={5} remaining={countdown} />
      ) : (
        <button
          onClick={handleDone}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-[11px] font-semibold transition-colors"
        >
          {doneLabel}
        </button>
      )}
      <button
        onClick={onClose}
        className="w-full text-[10px] text-gray-400 hover:text-gray-500 py-1 transition-colors"
      >
        Close without completing
      </button>
    </div>
  )
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(active) {
  const [canClose, setCanClose] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setCanClose(true); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [active])

  return { canClose, countdown }
}

// ── Mindset modal ─────────────────────────────────────────────────────────────
function MindsetModal({ onClose, onDone, prefetchedContent }) {
  const [content, setContent] = useState(prefetchedContent || '')
  const [loading, setLoading] = useState(!prefetchedContent)
  const { canClose, countdown } = useCountdown(!loading)

  useEffect(() => {
    if (prefetchedContent) return
    getMindset()
      .then(res => setContent(res.data?.content || ''))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        icon={<span className="text-blue-500">{Icons.mindset}</span>}
        iconBg="bg-blue-50 dark:bg-blue-900/30"
        title="Mindset Reminder"
        subtitle="Read carefully before trading today"
      />

      <div className="px-5 py-4 max-h-64 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="space-y-2">
            {[100, 82, 68, 50].map(w => (
              <div key={w} className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {content.split('\n').filter(Boolean).map((line, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-1 h-1 rounded-full bg-blue-300 dark:bg-blue-700 flex-shrink-0 mt-[6px]" />
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalFooter
        canClose={canClose} countdown={countdown}
        onDone={onDone} onClose={onClose}
        doneLabel="Done Reading — Mark Complete"
      />
    </Modal>
  )
}

// ── News modal ────────────────────────────────────────────────────────────────
function NewsModal({ onClose, onDone }) {
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [failed, setFailed]     = useState(false)
  const { canClose, countdown } = useCountdown(!loading)

  useEffect(() => {
    getMarketNews()
      .then(res => setArticles(prioritizeNews(res.data?.news || [])))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        icon={<span className="text-orange-500">{Icons.news}</span>}
        iconBg="bg-orange-50 dark:bg-orange-900/30"
        title="Market News Today"
        subtitle="Top NEPSE headlines — scan before you trade"
        action={
          <button
            onClick={() => { onClose(); navigate('/screen') }}
            className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 font-medium transition-colors"
          >
            Explore all
            {Icons.externalLink}
          </button>
        }
      />

      <div className="px-5 py-4 max-h-72 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="space-y-1.5 animate-pulse">
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : failed || articles.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">No news available today</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">You can still mark this complete</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <SentimentDot sentiment={a.sentiment} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">{a.title}</p>
                  {a.summary && (
                    <p className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">{a.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {a.symbol && (
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">
                        {a.symbol}
                      </span>
                    )}
                    {a.type && a.type !== 'news' && (
                      <span className="text-[9px] text-gray-400 capitalize">{a.type}</span>
                    )}
                    {a.date && (
                      <span className="text-[9px] text-gray-300 dark:text-gray-600">{a.date}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalFooter
        canClose={canClose} countdown={countdown}
        onDone={onDone} onClose={onClose}
        doneLabel="Done Reading — Mark Complete"
      />
    </Modal>
  )
}

// ── Journal choice modal ──────────────────────────────────────────────────────
function JournalChoiceModal({ onClose, onDone }) {
  const navigate = useNavigate()

  const handleChoice = async (tab) => {
    await onDone()
    onClose()
    navigate(`/logs?tab=${tab}`)
  }

  const CHOICES = [
    {
      tab:   'trades',
      icon:  Icons.tradeLog,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-500',
      title: 'Add Trade Log',
      desc:  'Log a new trade or position',
      hover: 'hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
      titleHover: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    },
    {
      tab:   'market',
      icon:  Icons.marketLog,
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500',
      title: 'Add Market Log',
      desc:  "Today's market notes & analysis",
      hover: 'hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
      titleHover: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    },
  ]

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        icon={<span className="text-indigo-500">{Icons.journal}</span>}
        iconBg="bg-indigo-50 dark:bg-indigo-900/30"
        title="Journal"
        subtitle="What would you like to log today?"
      />

      <div className="px-5 py-4 space-y-2">
        {CHOICES.map(c => (
          <button
            key={c.tab}
            onClick={() => handleChoice(c.tab)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 transition-all group ${c.hover}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
              {c.icon}
            </div>
            <div className="text-left min-w-0">
              <p className={`text-[12px] font-semibold text-gray-800 dark:text-gray-100 transition-colors ${c.titleHover}`}>{c.title}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
            </div>
            <span className="ml-auto text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors">
              {Icons.chevron}
            </span>
          </button>
        ))}
      </div>

      <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1.5">
        <button
          onClick={() => { onClose(); navigate('/logs') }}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-600 font-medium py-1.5 transition-colors"
        >
          {Icons.openLogs}
          Open Logs — view today's entries
        </button>
        <button onClick={onClose} className="w-full text-[10px] text-gray-400 hover:text-gray-500 py-1 transition-colors">
          Close
        </button>
      </div>
    </Modal>
  )
}

// ── Grade system (blue/indigo — distinct from DisciplineScore's green) ────────
const GRADE = (pct) => {
  if (pct >= 100) return { color: 'text-indigo-500', ring: '#6366f1' }
  if (pct >= 67)  return { color: 'text-blue-500',   ring: '#3b82f6' }
  if (pct >= 33)  return { color: 'text-blue-400',   ring: '#60a5fa' }
  return               { color: 'text-gray-400',   ring: '#9ca3af' }
}

// ── Ring — same as DisciplineScore, blue palette ──────────────────────────────
function Ring({ pct, completed, total }) {
  const size = 88
  const r = 34
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const grade = GRADE(pct)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor"
          className="text-gray-100 dark:text-gray-800" strokeWidth="7" />
        <circle cx="44" cy="44" r={r} fill="none"
          stroke={grade.ring} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold leading-none ${grade.color}`}>{completed}</span>
        <span className={`text-[10px] font-semibold ${grade.color} opacity-70`}>/ {total}</span>
      </div>
    </div>
  )
}

// ── Task bar — mirrors DimBar from DisciplineScore ────────────────────────────
const BAR_COLOR = (done) => done
  ? 'bg-gradient-to-r from-blue-400 to-indigo-400'
  : 'bg-gray-200 dark:bg-gray-700'

function TaskBar({ label, iconType = 'custom', done, onClick, onDelete }) {
  const handleContextMenu = onDelete ? (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('taskrow-context', { detail: { x: e.clientX, y: e.clientY, onDelete } }))
  } : undefined

  const iconEl = Icons[iconType] || Icons.custom

  const iconColor = done
    ? 'text-blue-400 dark:text-blue-500'
    : {
        mindset: 'text-blue-400 dark:text-blue-500',
        news:    'text-orange-400 dark:text-orange-500',
        journal: 'text-indigo-400 dark:text-indigo-500',
        custom:  'text-gray-400 dark:text-gray-500',
      }[iconType] || 'text-gray-400'

  return (
    <div
      onClick={!done ? onClick : undefined}
      onContextMenu={handleContextMenu}
      className={`space-y-1 ${!done ? 'cursor-pointer group' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`transition-colors ${iconColor}`}>{iconEl}</span>
          <span className={`text-[10px] transition-colors leading-none ${
            done
              ? 'line-through text-gray-400 dark:text-gray-600'
              : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
          }`}>{label}</span>
        </div>
        <div className="flex-shrink-0">
          {done ? (
            <span className="text-blue-400 dark:text-blue-500">{Icons.check}</span>
          ) : (
            <span className="text-gray-300 dark:text-gray-700 group-hover:text-gray-400 transition-colors">
              {Icons.chevron}
            </span>
          )}
        </div>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${BAR_COLOR(done)}`}
          style={{ width: done ? '100%' : '0%' }}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
function TaskBoard({ initData, mindsetContent }) {
  const [fixedTasks, setFixedTasks]   = useState(FIXED_TASKS.map(task => ({ ...task, completed: false })))
  const [customTasks, setCustomTasks] = useState([])
  const [newTask, setNewTask]         = useState('')
  const [loading, setLoading]         = useState(!initData)
  const [adding, setAdding]           = useState(false)
  const [showAdd, setShowAdd]         = useState(false)
  const [activeModal, setActiveModal] = useState(null)
  const [mutateErr, setMutateErr]     = useState(null)
  const { onContextMenu: _ocm, ContextMenuPortal } = useContextMenu()

  useEffect(() => {
    const handler = (e) => {
      const { x, y, onDelete } = e.detail
      const fakeEvent = { clientX: x, clientY: y, preventDefault: () => {}, stopPropagation: () => {} }
      _ocm([{ label: 'Delete', icon: '🗑️', danger: true, action: onDelete }])(fakeEvent)
    }
    window.addEventListener('taskrow-context', handler)
    return () => window.removeEventListener('taskrow-context', handler)
  }, [_ocm])

  const applyTaskData = (ft, ct) => {
    setFixedTasks(FIXED_TASKS.map(task => ({
      ...task,
      completed: ft.find(f => f.id === task.id)?.completed || false
    })))
    setCustomTasks(ct)
    setLoading(false)
  }

  const fetchTasks = async () => {
    try {
      const res = await getTodayTasks()
      applyTaskData(res.data.fixedTasks, res.data.customTasks)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) applyTaskData(initData.fixedTasks, initData.customTasks)
    else fetchTasks()
  }, [initData]) // eslint-disable-line react-hooks/exhaustive-deps

  const completedFixed = fixedTasks.filter(t => t.completed)
  const doneCustom     = customTasks.filter(t => t.completed)
  const totalTasks     = fixedTasks.length + customTasks.length
  const totalDone      = completedFixed.length + doneCustom.length
  const fixedProgress  = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0

  const handleFixedClick = (task) => {
    if (task.completed) return
    setActiveModal({ type: task.type, task })
  }

  const handleTaskDone = async (taskId) => {
    try {
      await toggleFixedTask(taskId)
      setFixedTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
      gCache.del('dashboard')
    } catch (err) {
      console.error('[toggle error]', err.response?.data || err.message)
      setMutateErr('Failed to save — please try again')
    }
  }

  const handleToggleCustom = async (task) => {
    setMutateErr(null)
    try {
      await updateCustomTask(task.id, !task.completed)
      setCustomTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
      gCache.del('dashboard')
    } catch { setMutateErr('Failed to update task') }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return
    setAdding(true)
    setMutateErr(null)
    try {
      const res = await addCustomTask(newTask.trim())
      setCustomTasks(prev => [...prev, res.data])
      setNewTask('')
      setShowAdd(false)
    } catch { setMutateErr('Failed to add task') }
    finally { setAdding(false) }
  }

  const handleDeleteCustom = async (id) => {
    setMutateErr(null)
    try {
      await deleteCustomTask(id)
      setCustomTasks(prev => prev.filter(t => t.id !== id))
    } catch { setMutateErr('Failed to delete task') }
  }

  if (loading) return (
    <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm p-4 space-y-3 animate-pulse">
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
      <div className="flex gap-4">
        <div className="w-[88px] h-[88px] rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
        <div className="flex-1 space-y-3 pt-2">
          {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />)}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <ContextMenuPortal />

      {activeModal?.type === 'mindset' && (
        <MindsetModal
          onClose={() => setActiveModal(null)}
          onDone={() => handleTaskDone(activeModal.task.id)}
          prefetchedContent={mindsetContent}
        />
      )}
      {activeModal?.type === 'news' && (
        <NewsModal
          onClose={() => setActiveModal(null)}
          onDone={() => handleTaskDone(activeModal.task.id)}
        />
      )}
      {activeModal?.type === 'journal' && (
        <JournalChoiceModal
          onClose={() => setActiveModal(null)}
          onDone={() => handleTaskDone(activeModal.task.id)}
        />
      )}

      <div className="hp-card bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm p-4 flex flex-col gap-3 h-full overflow-y-auto">

        {/* Header — identical to DisciplineScore */}
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Daily Routine
          </h3>
          {totalDone === totalTasks && totalTasks > 0 && (
            <span className="text-[10px] text-indigo-400 font-medium tracking-wide">All done</span>
          )}
        </div>

        {/* Ring + bars — identical layout to DisciplineScore */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1">
            <Ring pct={fixedProgress} completed={totalDone} total={totalTasks} />
            <span className="text-[10px] text-gray-400 text-center leading-tight">
              daily<br/>progress
            </span>
          </div>

          <div className="flex-1 space-y-2.5 pt-1">
            {fixedTasks.map(task => (
              <TaskBar
                key={task.id}
                label={task.title}
                iconType={task.type}
                done={task.completed}
                onClick={() => handleFixedClick(task)}
              />
            ))}
            {customTasks.map(task => (
              <TaskBar
                key={task.id}
                label={task.title}
                iconType="custom"
                done={task.completed}
                onClick={() => handleToggleCustom(task)}
                onDelete={() => handleDeleteCustom(task.id)}
              />
            ))}
          </div>
        </div>

        {/* Add task — mirrors impact tag placement in DisciplineScore */}
        <div className="border-t border-gray-50 dark:border-gray-800 pt-2 space-y-1.5">
          {mutateErr && (
            <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950 px-2 py-1 rounded-lg">{mutateErr}</p>
          )}
          {showAdd ? (
            <form onSubmit={handleAddTask} className="flex gap-1.5">
              <input
                type="text"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                placeholder="Task name…"
                autoFocus
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors min-w-0"
              />
              <button
                type="submit"
                disabled={adding || !newTask.trim()}
                className="bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex-shrink-0"
              >
                {adding ? '…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewTask(''); setMutateErr(null) }}
                className="text-gray-400 hover:text-gray-600 flex items-center px-1.5 transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-blue-500 transition-colors group"
            >
              <span className="group-hover:text-blue-500 transition-colors">{Icons.plus}</span>
              Add custom task
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default TaskBoard
