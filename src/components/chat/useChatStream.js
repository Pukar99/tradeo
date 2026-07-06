// === useChatStream.js — agent send/stream/action engine for the chat ===
// Moved verbatim from AIChat.jsx (P2.1 split). Owns abortCtrlRef + its own
// unmount abort. Contexts (auth/theme/language/nav) are read here directly;
// component state crosses the boundary as explicit params — no renames.
import { useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { BASE_URL } from '../../api'
import { dispatchChatAction } from '../../utils/chatEvents'

export default function useChatStream({
  input, setInput, loading, setLoading, messages, setMessages,
  lastAction, setLastAction, lastActionRef, setActiveForm, setJournalDraft,
  setDisciplineNudge, setAtBottom, atBottomRef, inputRef,
}) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const abortCtrlRef = useRef(null)

  // stream half of the old AIChat unmount cleanup
  useEffect(() => {
    return () => abortCtrlRef.current?.abort()
  }, [])

  // ── Shared non-stream response handler ──────────────────────────────────────
  // Called by both handleSend (JSON branch) and handleAction (confirm/cancel).
  const handleAgentResponse = (data) => {
    // Frontend-only: theme toggle
    if (data.type === 'action' && data.action === 'TOGGLE_THEME') {
      const wantDark = data.result.mode === 'dark'
      if (wantDark !== isDark) toggleTheme()
    }

    // Journal draft — show interactive card instead of plain bubble
    if (data.type === 'action' && data.action === 'DRAFT_JOURNAL' && data.result?.draft) {
      setJournalDraft(data.result.draft)
    }

    // Dispatch event so other components re-fetch instantly
    if (data.type === 'action' && data.action) {
      dispatchChatAction(data.action)
    }

    // Keep lastAction alive for follow-ups
    // DELETE_TRADE removed — it now arrives as type:'pending' (covered by that clause below)
    const keepAliveActions = ['ADD_TRADE', 'ADD_TO_POSITION', 'CLOSE_TRADE', 'DRAFT_JOURNAL', 'NEEDS_DISAMBIGUATION']
    if (
      data.type === 'pending' ||
      data.type === 'slotfill' ||
      (data.type === 'action' && keepAliveActions.includes(data.action))
    ) {
      // slotfill carries knownArgs (symbol etc.); pending/action carry result. Either feeds the
      // strengthened lastActionContext so a TYPED answer (not the form) still binds to this action.
      setLastAction({ action: data.action, result: data.knownArgs || data.result })
    } else {
      setLastAction(null)
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'assistant',
        content: data.reply,
        time: new Date(),
        actionType: data.type === 'action' ? data.action : (data.type === 'pending' ? '__PENDING__' : null),
        actionResult: (data.type === 'action' || data.type === 'pending') ? data.result : null,
        pending: data.type === 'pending'
          ? { token: data.result?.token, action: data.action, preview: data.result?.preview }
          : null,
        // multi-turn: a structured slot-fill request renders SlotFillCard (no LLM on the answer)
        slotfill: data.type === 'slotfill'
          ? {
              action: data.action,
              knownArgs: data.knownArgs || {},
              missing: data.missing || [],
              reply: data.reply,
              suggestion: data.suggestion || null,
            }
          : null,
        // card protocol: a structured card reply (e.g. candlestick chart) rendered by CardRenderer
        card: data.type === 'card' ? data.card : null,
      },
    ])
  }

  // ── Structured action dispatch — bypasses the LLM intent-parse ───────────────
  // Used by ConfirmCard [Confirm]/[Cancel] today; phase-2 Y action-card buttons
  // reuse this same seam. Posts { action, ...payload } to the same agent endpoint.
  const handleAction = async (payload) => {
    setLoading(true)
    try {
      const stored = localStorage.getItem('auth_token')
      const res = await fetch(`${BASE_URL}/api/chat/agent`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(stored ? { Authorization: `Bearer ${stored}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      handleAgentResponse(data)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          time: new Date(),
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // ── Mark a confirm card as done (disables buttons to prevent double-fire) ────
  const markConfirmDone = (id) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, confirmDone: true } : m)))

  // Handles sending any message (from input or quick actions)
  const handleSend = async (messageText) => {
    const text = messageText || input.trim()
    if (!text || loading) return
    if (!user) {
      navigate('/login')
      return
    }

    setActiveForm(null)
    const userMessage = { id: Date.now(), role: 'user', content: text, time: new Date() }
    // P4-003: cap in-memory history at 100 messages to prevent memory bloat
    setMessages((prev) => [...prev, userMessage].slice(-100))
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto' // reset auto-grow
    // Sending implies the user wants to follow the reply — re-enable auto-scroll
    atBottomRef.current = true
    setAtBottom(true)
    setLoading(true)

    try {
      abortCtrlRef.current?.abort()
      abortCtrlRef.current = null
      const ctrl = new AbortController()
      abortCtrlRef.current = ctrl

      // Cookie preferred; Bearer fallback for Safari ITP (mobile blocks the cross-site
      // cookie — mirrors the axios interceptor in api/index.js). Temporary until custom domain.
      const stored = localStorage.getItem('auth_token')
      const response = await fetch(`${BASE_URL}/api/chat/agent`, {
        method: 'POST',
        signal: ctrl.signal,
        credentials: 'include', // send httpOnly cookie when the browser allows it
        headers: {
          'Content-Type': 'application/json',
          ...(stored ? { Authorization: `Bearer ${stored}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          // Exclude streaming/incomplete messages from history — they have empty content
          history: messages
            .filter((m) => !m.streaming && m.content)
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
          lastAction: lastActionRef.current,
          lang,
        }),
      })

      // 503 = Render cold start (free-tier sleeps after 15 min idle, proxy times out before
      // the backend finishes booting). Show a specific retry message instead of a generic error.
      if (response.status === 503) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant',
            content: 'The server is waking up — it goes to sleep after 15 min idle. Wait ~30 seconds and try again.',
            time: new Date(),
            isError: true,
            retryText: text,
          },
        ])
        setLoading(false)
        return
      }

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant',
            content: `Server error (${response.status}) — please try again.`,
            time: new Date(),
            isError: true,
            retryText: text,
          },
        ])
        setLoading(false)
        return
      }

      const contentType = response.headers.get('content-type') || ''

      // ── Streaming chat response ──────────────────────────────────────────────
      if (contentType.includes('text/event-stream')) {
        const msgId = Date.now()
        // Add a placeholder bubble immediately
        setMessages((prev) => [
          ...prev,
          { id: msgId, role: 'assistant', content: '', time: new Date(), streaming: true },
        ])
        setLoading(false)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done || ctrl.signal.aborted) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() // keep incomplete line in buffer
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'chunk' && event.text) {
                  fullText += event.text
                  setMessages((prev) =>
                    prev.map((m) => (m.id === msgId ? { ...m, content: fullText } : m))
                  )
                } else if (event.type === 'done') {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === msgId ? { ...m, streaming: false } : m))
                  )
                  // Check discipline nudge in full text
                  const disciplineMatch = fullText.match(/discipline.*?(\d+)%/i)
                  if (disciplineMatch) {
                    const score = parseInt(disciplineMatch[1])
                    if (score < 70) setDisciplineNudge(score)
                  }
                  // Do NOT clear lastAction after streaming — user may follow up
                }
              } catch {
                /* skip malformed SSE lines */
              }
            }
          }
        } catch (streamErr) {
          console.error('SSE stream read error:', streamErr)
          try {
            reader.cancel()
          } catch {
            /* ignore cancel errors */
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    streaming: false,
                    content: fullText || 'Stream interrupted. Please try again.',
                  }
                : m
            )
          )
        }
        inputRef.current?.focus()
        return
      }

      // ── JSON action / non-streaming response ─────────────────────────────────
      const data = await response.json()
      handleAgentResponse(data)
    } catch (err) {
      if (err?.name === 'AbortError') return // intentional cancel — no error message
      console.error('AIChat handleSend error:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: err?.message?.includes('Failed to fetch')
            ? 'Cannot reach the server — check your connection and try again.'
            : 'Something went wrong. Please try again.',
          time: new Date(),
          isError: true,
          retryText: text, // lets the error bubble offer one-click resend
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Stop an in-flight response (SSE stream or pending request).
  // The stream's AbortError path keeps whatever text already arrived.
  const handleStop = () => {
    abortCtrlRef.current?.abort()
    setLoading(false)
  }

  return { handleSend, handleAction, markConfirmDone, handleStop }
}
