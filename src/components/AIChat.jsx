// =============================================================================
// AIChat.jsx — AI chat panel (floating + full-page), SSE streaming, voice input
// =============================================================================
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import {
  sendAgentMessage,
  saveChatSession,
  listChatSessions,
  loadChatSession,
  deleteChatSession,
} from '../api'
import { getChatSuggestions } from '../utils/globalCache'
import { DEBRIEF_EVENT } from '../utils/chatEvents'
import { useNavigate } from 'react-router-dom'
import CardRenderer from './chat/CardRenderer'
import { MarkdownLite, TradeoLogo } from './chat/markdown'
import { ActionCard, ConfirmCard } from './chat/cards/ActionCard'
import { SlotFillCard, DisambiguationCard } from './chat/cards/SlotFillCard'
import { BrokerFeeCard } from './chat/cards/FeeCards'
import { JournalDraftCard, ShowJournalCard } from './chat/cards/JournalCards'
import { ShowTradesCard, ShowGoalsCard } from './chat/cards/ShowCards'
import { TradePlanCard } from './chat/cards/PlanCards'
import { RiskSummaryCard, WeeklySummaryCard } from './chat/cards/SummaryCards'
import { MorningBriefCard } from './chat/cards/BriefCards'
import { DisciplineNudgeCard } from './chat/cards/RiskCards'
import QuickForm from './chat/QuickForm'
import { PRESET_PROMPTS, SLASH_COMMANDS, FOLLOW_UPS } from './chat/prompts'
import useVoiceInput from './chat/useVoiceInput'
import useChatStream from './chat/useChatStream'

// ── Main AIChat component ────────────────────────────────────────────────────
function AIChat({ isFullPage = false, onClose, onDragStart }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('chat_messages')
      if (!saved) return []
      // Revive time strings back to Date objects
      return JSON.parse(saved).map((m) => ({ ...m, time: m.time ? new Date(m.time) : undefined }))
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  // P4-004: persist lastAction in sessionStorage so undo survives within the same tab session
  const [lastAction, setLastAction] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('chat_lastAction'))
    } catch {
      return null
    }
  })
  const [activeForm, setActiveForm] = useState(null)
  // Inline special cards waiting for user action
  const [journalDraft, setJournalDraft] = useState(null) // { symbol, trade, ltp, pnl, suggestedContent }
  const [disciplineNudge, setDisciplineNudge] = useState(null) // score number

  // Copy-to-clipboard feedback — which message id shows the "copied" check
  const [copiedId, setCopiedId] = useState(null)
  const copiedTimerRef = useRef(null)

  // Smart auto-scroll: only follow new messages when the user is already near
  // the bottom. Ref mirrors state so the scroll effect reads it without
  // re-subscribing; guard in setAtBottom avoids re-render per scroll event.
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)
  const scrollBoxRef = useRef(null)

  // ── Chat session persistence ─────────────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const currentSessionIdRef = useRef(null)
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const saveTimeoutRef = useRef(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  // P3-002: always-fresh ref so handleSend never closes over stale lastAction
  const lastActionRef = useRef(lastAction)

  // P4-004: sync lastAction to sessionStorage so undo survives in-tab refresh
  // P3-002: keep ref in sync so handleSend always reads the latest lastAction
  useEffect(() => {
    lastActionRef.current = lastAction
    if (lastAction) sessionStorage.setItem('chat_lastAction', JSON.stringify(lastAction))
    else sessionStorage.removeItem('chat_lastAction')
  }, [lastAction])

  // Persist messages to sessionStorage — keep last 30 to stay within storage limits
  // Streaming messages (incomplete) are excluded to avoid storing partial content
  useEffect(() => {
    try {
      const toSave = messages.filter((m) => !m.streaming).slice(-30)
      sessionStorage.setItem('chat_messages', JSON.stringify(toSave))
    } catch {
      /* storage full or private mode — fail silently */
    }
  }, [messages])

  // Keep session ID ref in sync so the save timeout always reads current value
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // Auto-save session to Supabase 3s after any message change (debounced)
  useEffect(() => {
    const completed = messages.filter((m) => !m.streaming && m.content)
    if (!user || completed.length === 0) return
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const sid = currentSessionIdRef.current
        const payload = {
          messages: completed.slice(-50).map((m) => ({
            role: m.role,
            content: m.content,
            actionType: m.actionType || null,
            time: m.time || null,
          })),
          ...(sid ? { session_id: sid } : {}),
        }
        const res = await saveChatSession(payload)
        if (!sid && res.data?.id) {
          setCurrentSessionId(res.data.id)
        }
      } catch {
        /* fail silently — session save is non-critical */
      }
    }, 3000)
    return () => clearTimeout(saveTimeoutRef.current)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      getChatSuggestions()
        .then((res) => setSuggestions(res.data?.suggestions || []))
        .catch(() => {})
    }
  }, [user])

  // ── Inject AI Trade Coach debrief when fired by LogsPage after close ─────────
  useEffect(() => {
    const handler = (e) => {
      const { symbol, debrief } = e.detail || {}
      if (!debrief) return
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: `Coach · ${symbol || 'Trade'} closed\n\n${debrief}`,
          time: new Date(),
          isCoach: true,
        },
      ])
    }
    window.addEventListener(DEBRIEF_EVENT, handler)
    return () => window.removeEventListener(DEBRIEF_EVENT, handler)
  }, [])

  useEffect(() => {
    if (atBottomRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, journalDraft])

  const handleChatScroll = () => {
    const el = scrollBoxRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    atBottomRef.current = near
    setAtBottom((prev) => (prev === near ? prev : near))
  }

  const scrollToBottom = () => {
    atBottomRef.current = true
    setAtBottom(true)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content).catch(() => {})
    setCopiedId(msg.id)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1500)
  }

  const { handleSend, handleAction, markConfirmDone, handleStop } = useChatStream({
    input, setInput, loading, setLoading, messages, setMessages,
    setLastAction, lastActionRef, setActiveForm, setJournalDraft,
    setDisciplineNudge, setAtBottom, atBottomRef, inputRef,
  })

  // Save journal draft — routes through ADD_JOURNAL agent action, saves as notes on the trade_log action row
  const handleJournalSave = async (symbol, content) => {
    setJournalDraft(null)
    setLastAction(null)
    await handleSend(`Add journal note for ${symbol}: ${content}`)
  }

  const { voiceState, voiceError, voiceSeconds, handleVoice } = useVoiceInput({
    input, setInput, inputRef, onSend: handleSend,
  })

  // Brief chip — send brief request immediately
  const handleBriefChip = () => {
    setActiveForm(null)
    handleSend('Morning brief — show my trading summary for today')
  }

  // ── Slash-command palette ────────────────────────────────────────────────
  // Open while the input is a single "/word" token; filter as the user types.
  const slashQuery =
    input.startsWith('/') && !/[\s\n]/.test(input) ? input.slice(1).toLowerCase() : null
  const slashMatches =
    slashQuery !== null ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery)) : []
  const slashOpen = slashMatches.length > 0
  const [slashIdx, setSlashIdx] = useState(0)
  useEffect(() => {
    setSlashIdx(0)
  }, [slashQuery])

  const runSlash = (c) => {
    if (c.type === 'insert') {
      setInput(c.arg)
      inputRef.current?.focus()
      return
    }
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    if (c.type === 'form') setActiveForm(c.arg)
    else if (c.type === 'send') handleSend(c.arg)
    else if (c.type === 'new') handleNewChat()
  }

  const handleKeyDown = (e) => {
    // Palette navigation takes priority while open
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIdx((i) => (i + 1) % slashMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        runSlash(slashMatches[slashIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setInput('')
        return
      }
    }
    // ↑ on an empty input recalls the last sent message for editing
    if (e.key === 'ArrowUp' && !input.trim()) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      if (lastUser) {
        e.preventDefault()
        setInput(lastUser.content)
        requestAnimationFrame(autoGrowInput)
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!busy) handleSend()
    }
  }

  // Grow the textarea with content (Shift+Enter newlines), capped at ~4 lines
  const autoGrowInput = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }

  const formatTime = (date) =>
    date ? new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

  // ── Session management ───────────────────────────────────────────────────────
  const handleOpenHistory = async () => {
    const opening = !showHistory
    setShowHistory(opening)
    if (opening) {
      setSessionsLoading(true)
      try {
        const res = await listChatSessions()
        setSessions(res.data || [])
      } catch {
        /* fail silently */
      } finally {
        setSessionsLoading(false)
      }
    }
  }

  const handleLoadSession = async (id) => {
    try {
      const res = await loadChatSession(id)
      const loaded = res.data?.messages || []
      setMessages(
        loaded.map((m) => ({
          ...m,
          id: Math.random(),
          time: m.time ? new Date(m.time) : new Date(),
        }))
      )
      setCurrentSessionId(id)
      setLastAction(null)
      setJournalDraft(null)
      setDisciplineNudge(null)
      setActiveForm(null)
      setShowHistory(false)
      sessionStorage.removeItem('chat_lastAction')
    } catch {
      /* fail silently */
    }
  }

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteChatSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (currentSessionId === id) {
        setCurrentSessionId(null)
        setMessages([])
        sessionStorage.removeItem('chat_messages')
      }
    } catch {
      /* fail silently */
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setCurrentSessionId(null)
    setLastAction(null)
    setJournalDraft(null)
    setDisciplineNudge(null)
    setActiveForm(null)
    setShowHistory(false)
    sessionStorage.removeItem('chat_messages')
    sessionStorage.removeItem('chat_lastAction')
  }

  // Disambiguation pick — user clicked an entry card
  const handleDisambiguationPick = (entry, result) => {
    const { original_action, exit_price, sl, tp, exit_quantity } = result
    // Build a natural language message so the AI routes it as SELECT_TRADE
    // The backend uses the NEEDS_DISAMBIGUATION context (still in lastAction) to match entry by trade_id
    let msg = `Select trade ${entry.id} for ${original_action}`
    if (original_action === 'CLOSE_TRADE') msg += ` at exit price ${exit_price}`
    if (original_action === 'UPDATE_SL_TP')
      msg += `${sl != null ? ` sl ${sl}` : ''}${tp != null ? ` tp ${tp}` : ''}`
    if (original_action === 'PARTIAL_CLOSE') msg += ` exit ${exit_quantity} at ${exit_price}`
    // lastAction still holds { action: 'NEEDS_DISAMBIGUATION', result: { entries, original_action, ... } }
    // Backend uses this to build the disambiguation prompt context — no change needed
    handleSend(msg)
  }

  // Render a single message bubble + any special cards attached
  const renderMessage = (msg, i, isLast = false) => {
    // Follow-up chips — only under the most recent completed assistant message
    const followUps =
      isLast &&
      msg.role === 'assistant' &&
      !msg.streaming &&
      !msg.isError &&
      msg.actionType &&
      FOLLOW_UPS[msg.actionType]
        ? (FOLLOW_UPS[msg.actionType](msg.actionResult || {}) || []).filter(Boolean)
        : []
    const showBrokerFee = msg.actionType === 'CALC_BROKER_FEE' && msg.actionResult?.fee
    const showMorningBrief = msg.actionType === 'MORNING_BRIEF' && msg.actionResult?.brief
    const showDisambiguation =
      msg.actionType === 'NEEDS_DISAMBIGUATION' && msg.actionResult?.entries?.length
    const showShowTrades = msg.actionType === 'SHOW_TRADES' && msg.actionResult?.trades
    const showShowGoals = msg.actionType === 'SHOW_GOALS' && msg.actionResult?.goals
    const showShowJournal = msg.actionType === 'SHOW_JOURNAL' && msg.actionResult?.entries
    const showTradePlan = msg.actionType === 'TRADE_PLAN' && msg.actionResult?.plan
    const showRiskSummary = msg.actionType === 'SHOW_RISK_SUMMARY' && msg.actionResult?.positions
    const showWeekly = msg.actionType === 'WEEKLY_SUMMARY' && msg.actionResult
    // TOGGLE_THEME: handled inline, no card needed
    // DRAFT_JOURNAL: shown as interactive JournalDraftCard (not inline here, added to messages area separately)
    // __PENDING__: shown as ConfirmCard below (DELETE_TRADE and other money actions via confirm-gate)
    const showConfirm = msg.pending?.token
    // multi-turn: inline slot-fill form, dismissed once filled/cancelled (reuses confirmDone)
    const showSlotfill = msg.slotfill && !msg.confirmDone
    // card protocol: a structured card reply (e.g. candlestick chart) rendered by CardRenderer
    const showChartCard = !!msg.card
    const showStandardCard =
      msg.actionType &&
      msg.actionResult &&
      !showBrokerFee &&
      !showMorningBrief &&
      !showDisambiguation &&
      !showShowTrades &&
      !showShowGoals &&
      !showShowJournal &&
      !showTradePlan &&
      !showRiskSummary &&
      !showWeekly &&
      !showConfirm &&
      !['DRAFT_JOURNAL', 'TOGGLE_THEME', '__PENDING__'].includes(msg.actionType)

    return (
      <div
        key={msg.id ?? i}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5 animate-fade-up`}
        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
      >
        {msg.role === 'assistant' && (
          <div className="flex-shrink-0 mt-0.5">
            <TradeoLogo size={20} />
          </div>
        )}
        <div
          className={`flex flex-col ${showChartCard ? 'w-[90%] max-w-[90%]' : 'max-w-[85%]'} ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          {/* Disambiguation picker */}
          {showDisambiguation && (
            <DisambiguationCard result={msg.actionResult} onPick={handleDisambiguationPick} />
          )}
          {/* Confirm gate card — gated money actions awaiting [Confirm]/[Cancel] */}
          {showConfirm && (
            <ConfirmCard
              pending={msg.pending}
              done={msg.confirmDone}
              onConfirm={(token) => {
                markConfirmDone(msg.id)
                handleAction({ action: 'CONFIRM_ACTION', token })
              }}
              onCancel={(token) => {
                markConfirmDone(msg.id)
                handleAction({ action: 'CANCEL_ACTION', token })
              }}
            />
          )}
          {/* Slot-fill card — missing money-action field; filled answer posts as a structured */}
          {/* gated action (no LLM), flowing into the same confirm-gate as ConfirmCard. */}
          {showSlotfill && (
            <SlotFillCard
              slot={msg.slotfill}
              done={msg.confirmDone}
              onSubmit={(payload) => {
                markConfirmDone(msg.id)
                handleAction(payload)
              }}
              onCancel={() => markConfirmDone(msg.id)}
            />
          )}
          {/* Standard action card */}
          {showStandardCard && <ActionCard type={msg.actionType} result={msg.actionResult} />}
          {/* Broker fee breakdown card */}
          {showBrokerFee && <BrokerFeeCard fee={msg.actionResult.fee} />}
          {/* Morning brief card */}
          {showMorningBrief && <MorningBriefCard brief={msg.actionResult.brief} />}
          {/* Read-side query cards */}
          {showShowTrades && <ShowTradesCard result={msg.actionResult} />}
          {showShowGoals && <ShowGoalsCard result={msg.actionResult} />}
          {showShowJournal && <ShowJournalCard result={msg.actionResult} />}
          {/* Analysis cards */}
          {showTradePlan && <TradePlanCard plan={msg.actionResult.plan} />}
          {showRiskSummary && <RiskSummaryCard result={msg.actionResult} />}
          {showWeekly && <WeeklySummaryCard result={msg.actionResult} />}
          {/* Card protocol — structured card reply (candlestick chart, etc.) */}
          {showChartCard && (
            <div className="mb-1 w-full">
              <CardRenderer card={msg.card} />
            </div>
          )}
          {/* Text bubble */}
          <div
            className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-green-500 text-white rounded-tr-sm'
                : msg.isError
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-200 dark:border-red-800 rounded-tl-sm'
                  : msg.isCoach
                    ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
                    : isFloat
                      ? 'bg-white/55 dark:bg-white/8 border border-white/50 dark:border-white/12 text-gray-800 dark:text-gray-100 rounded-tl-sm shadow-sm backdrop-blur-sm'
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
            }`}
          >
            {msg.role === 'assistant' && !msg.isError ? (
              <>
                <MarkdownLite text={msg.content || ''} />
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-3 bg-green-500 ml-0.5 animate-pulse align-middle" />
                )}
              </>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
          {/* Retry — resend the message that failed */}
          {msg.isError && msg.retryText && (
            <button
              onClick={() => handleSend(msg.retryText)}
              className="mt-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h5M20 20v-5h-5M5.5 9A7.5 7.5 0 0119 7.5M18.5 15A7.5 7.5 0 015 16.5"
                />
              </svg>
              Retry
            </button>
          )}
          {/* Suggested next steps */}
          {followUps.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {followUps.map((f, j) => (
                <button
                  key={j}
                  onClick={() => handleSend(f.text)}
                  className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors animate-fade-up"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5 px-1">
            <span className="text-gray-400 text-[10px]">{formatTime(msg.time)}</span>
            {msg.role === 'assistant' && msg.content && !msg.streaming && (
              <button
                onClick={() => handleCopy(msg)}
                className={`transition-colors ${copiedId === msg.id ? 'text-green-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}
                title={copiedId === msg.id ? 'Copied!' : 'Copy'}
              >
                {copiedId === msg.id ? (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        {msg.role === 'user' && (
          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const isFloat = !isFullPage
  const isStreaming = messages.some((m) => m.streaming)
  const busy = loading || isStreaming

  return (
    <div
      className={`flex flex-col h-full ${isFloat ? 'bg-transparent' : 'bg-white dark:bg-gray-950'}`}
    >
      {/* ── Header ── (floating: doubles as the drag handle) */}
      <div
        onMouseDown={isFloat ? onDragStart : undefined}
        onTouchStart={isFloat ? onDragStart : undefined}
        className={`flex items-center justify-between shrink-0 border-b ${
          isFloat
            ? 'px-3 py-2.5 bg-white/20 dark:bg-black/20 border-white/20 dark:border-white/8 cursor-move select-none touch-none'
            : 'px-4 py-3 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <TradeoLogo size={isFloat ? 22 : 26} />
          <div>
            <p className={`font-bold tracking-tight text-gray-900 dark:text-white leading-none ${isFloat ? 'text-xs' : 'text-sm'}`}>
              Tradeo AI
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className={`text-gray-400 ${isFloat ? 'text-[10px]' : 'text-[11px]'}`}>Agent · NEPSE</span>
            </div>
          </div>
        </div>
        {/* stopPropagation so clicking an action doesn't begin a header drag */}
        <div
          className="flex items-center gap-1"
          onMouseDown={isFloat ? (e) => e.stopPropagation() : undefined}
          onTouchStart={isFloat ? (e) => e.stopPropagation() : undefined}
        >
          {/* History / sessions button */}
          {user && (
            <button
              onClick={handleOpenHistory}
              className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors ${showHistory ? 'bg-black/5 dark:bg-white/5' : ''}`}
              title="Chat history"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[10px] px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="New chat"
            >
              + New
            </button>
          )}
          {!isFullPage && (
            <button
              onClick={() => navigate('/chat')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
              title="Open full page"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          )}
          {/* Close — floating only (the full page has its own nav) */}
          {isFloat && onClose && (
            <button
              onClick={onClose}
              aria-label="Close chat"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
              title="Close chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Session history panel ── */}
      {showHistory && (
        <div
          className={`border-b shrink-0 max-h-48 overflow-y-auto ${
            isFloat
              ? 'bg-white/20 dark:bg-black/20 border-white/15 dark:border-white/6'
              : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
          }`}
        >
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Recent Chats
            </p>
            {sessionsLoading && <p className="text-[10px] text-gray-400 py-1">Loading...</p>}
            {!sessionsLoading && sessions.length === 0 && (
              <p className="text-[10px] text-gray-400 py-1">
                No saved sessions yet. Start chatting!
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleLoadSession(s.id)}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer mb-0.5 group transition-colors ${
                  s.id === currentSessionId
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200 truncate">
                    {s.title}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all shrink-0 p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick action chips: REMOVED — these actions move to `/` slash commands
            (next session). The QuickForm machinery (setActiveForm/'buy'/'sell'/etc.)
            is intentionally kept below so the `/` handler can reuse it. ── */}

      {/* ── Messages area ── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 right-0 h-6 bg-gradient-to-b ${isFloat ? 'from-white/0' : 'from-white/80 dark:from-gray-950/80'} to-transparent z-10 pointer-events-none`}
        />
        <div
          className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t ${isFloat ? 'from-white/0' : 'from-white/80 dark:from-gray-950/80'} to-transparent z-10 pointer-events-none`}
        />
        {/* Scroll-to-bottom — appears when user has scrolled up */}
        {!atBottom && messages.length > 0 && (
          <button
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="absolute bottom-3 right-3 z-20 w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-green-500 dark:hover:text-green-400 transition-colors animate-fade-up"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
        <div
          ref={scrollBoxRef}
          onScroll={handleChatScroll}
          className="h-full overflow-y-auto overscroll-contain no-scrollbar px-3 py-3 space-y-3"
        >
          {/* Empty state */}
          {messages.length === 0 && !activeForm && (
            <div className="flex flex-col items-center pt-4 pb-2">
              <TradeoLogo size={42} />
              <p className="text-gray-900 dark:text-white text-sm font-semibold mt-3 mb-1 drop-shadow-sm">
                {t('chat.greeting')}
              </p>
              <p className="text-gray-500 dark:text-gray-300 text-[11px] text-center max-w-[200px] leading-relaxed mb-4">
                {t('chat.greetingSub')}
              </p>
              <p className="w-full text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Try asking
              </p>
              <div className="w-full grid grid-cols-2 gap-1.5">
                {(suggestions.length > 0
                  ? suggestions
                      .slice(0, 8)
                      .map((s, i) => ({ icon: PRESET_PROMPTS[i]?.icon || '💬', text: s }))
                  : PRESET_PROMPTS
                ).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p.text)}
                    className={`flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-left transition-all group border ${
                      isFloat
                        ? 'bg-white/25 dark:bg-white/6 border-white/40 dark:border-white/10 hover:bg-white/45 dark:hover:bg-white/12 backdrop-blur-sm'
                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-200 dark:hover:border-gray-700'
                    }`}
                  >
                    <span className="text-sm leading-none mt-0.5">{p.icon}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gray-200 leading-snug">
                      {p.text}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
                Type{' '}
                <kbd className="px-1 py-px rounded border border-gray-200 dark:border-gray-700 font-sans text-[9px]">
                  /
                </kbd>{' '}
                for quick commands
              </p>
            </div>
          )}

          {/* Quick form in empty state */}
          {activeForm && messages.length === 0 && (
            <QuickForm
              type={activeForm}
              onSubmit={handleSend}
              onCancel={() => setActiveForm(null)}
            />
          )}

          {/* Messages */}
          {messages.map((msg, i) => renderMessage(msg, i, i === messages.length - 1))}

          {/* Quick form after messages */}
          {activeForm && messages.length > 0 && (
            <QuickForm
              type={activeForm}
              onSubmit={handleSend}
              onCancel={() => setActiveForm(null)}
            />
          )}

          {/* Journal draft card */}
          {journalDraft && (
            <JournalDraftCard
              draft={journalDraft}
              onSave={handleJournalSave}
              onDiscard={() => {
                setJournalDraft(null)
                setLastAction(null)
              }}
            />
          )}

          {/* Discipline nudge card */}
          {disciplineNudge !== null && (
            <DisciplineNudgeCard
              score={disciplineNudge}
              onDismiss={() => setDisciplineNudge(null)}
            />
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start gap-1.5 animate-fade-up">
              <div className="flex-shrink-0 mt-0.5">
                <TradeoLogo size={20} />
              </div>
              <div
                className={`px-3 py-2.5 rounded-2xl rounded-tl-sm shadow-sm ${
                  isFloat
                    ? 'bg-white/40 dark:bg-white/8 border border-white/40 dark:border-white/12 backdrop-blur-sm'
                    : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
                }`}
              >
                <div className="flex gap-1 items-center">
                  <div
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce"
                    style={{ animationDelay: '200ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-soft-bounce"
                    style={{ animationDelay: '400ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div
        className={`px-3 py-2.5 shrink-0 border-t ${
          isFloat
            ? 'bg-white/15 dark:bg-black/15 border-white/20 dark:border-white/8'
            : 'bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800'
        }`}
      >
        {!user ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-green-400 transition-colors"
          >
            {t('chat.loginToChat')}
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Slash-command palette */}
            {slashOpen && (
              <div
                className={`rounded-xl border overflow-hidden max-h-56 overflow-y-auto ${
                  isFloat
                    ? 'bg-white/80 dark:bg-gray-900/90 border-white/50 dark:border-white/15 backdrop-blur-md'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-3 pt-2 pb-1">
                  Commands · ↑↓ + Enter
                </p>
                {slashMatches.map((c, i) => (
                  <button
                    key={c.cmd}
                    onMouseDown={(e) => e.preventDefault() /* keep textarea focus */}
                    onClick={() => runSlash(c)}
                    onMouseEnter={() => setSlashIdx(i)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                      i === slashIdx ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                  >
                    <span className="text-sm w-5 text-center">{c.icon}</span>
                    <span
                      className={`text-[11px] font-semibold ${i === slashIdx ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      /{c.cmd}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">{c.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Undo chip — backend supports one-step UNDO; surface it after an
                undoable write action instead of requiring the user to know to type "undo" */}
            {!busy && ['ADD_TRADE', 'CLOSE_TRADE'].includes(lastAction?.action) && (
              <button
                onClick={() => handleSend('Undo my last action')}
                className="self-start flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors animate-fade-up"
              >
                <svg
                  className="w-2.5 h-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h10a5 5 0 015 5v1m-15-6l4-4m-4 4l4 4"
                  />
                </svg>
                Undo last action
              </button>
            )}
            {/* Voice status bar */}
            {voiceState === 'listening' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium flex-1">
                  Recording… {voiceSeconds}s
                </span>
                <span className="text-[10px] text-red-400 dark:text-red-500">
                  auto-sends after 4s silence
                </span>
              </div>
            )}
            {voiceState === 'processing' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  Transcribing with Whisper…
                </span>
              </div>
            )}
            {voiceState === 'error' && voiceError && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <span className="text-[10px] text-red-500">{voiceError}</span>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  autoGrowInput()
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  voiceState === 'listening'
                    ? 'Listening… speak in Nepali or English'
                    : voiceState === 'processing'
                      ? 'Transcribing…'
                      : t('chat.placeholder')
                }
                rows={1}
                className={`flex-1 border focus:border-green-400 dark:focus:border-green-500 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 text-xs focus:outline-none resize-none transition-colors ${
                  isFloat
                    ? 'bg-white/40 dark:bg-white/10 border-white/50 dark:border-white/15 backdrop-blur-sm'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              />

              {/* Mic button */}
              <button
                onClick={handleVoice}
                disabled={loading || voiceState === 'processing'}
                title={
                  voiceState === 'listening'
                    ? 'Stop recording (or wait 4s of silence)'
                    : voiceState === 'processing'
                      ? 'Transcribing…'
                      : 'Voice input — Nepali / English (Whisper AI)'
                }
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all border disabled:opacity-40 ${
                  voiceState === 'listening'
                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/40'
                    : voiceState === 'processing'
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-500'
                      : voiceState === 'error'
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-500'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {voiceState === 'listening' ? (
                  // Animated waveform bars while recording
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <rect
                      x="1"
                      y="5"
                      width="2"
                      height="6"
                      rx="1"
                      className="animate-[bounce_0.6s_infinite]"
                    />
                    <rect
                      x="4.5"
                      y="3"
                      width="2"
                      height="10"
                      rx="1"
                      className="animate-[bounce_0.6s_0.1s_infinite]"
                    />
                    <rect
                      x="8"
                      y="1"
                      width="2"
                      height="14"
                      rx="1"
                      className="animate-[bounce_0.6s_0.2s_infinite]"
                    />
                    <rect
                      x="11.5"
                      y="3"
                      width="2"
                      height="10"
                      rx="1"
                      className="animate-[bounce_0.6s_0.1s_infinite]"
                    />
                  </svg>
                ) : voiceState === 'processing' ? (
                  // Spinner
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  // Microphone icon
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0v-4A2.5 2.5 0 0 0 8 1z" />
                    <path d="M4.5 7.5a.5.5 0 0 0-1 0A4.5 4.5 0 0 0 7.5 12v1.5H6a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8.5V12a4.5 4.5 0 0 0 4-4.5.5.5 0 0 0-1 0 3.5 3.5 0 0 1-7 0z" />
                  </svg>
                )}
              </button>

              {/* Send / Stop button — swaps to stop while a reply is generating */}
              {busy ? (
                <button
                  onClick={handleStop}
                  title="Stop generating"
                  aria-label="Stop generating"
                  className="bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  title="Send (Enter)"
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-30 text-white w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIChat
