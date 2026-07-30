// =============================================================================
// chatEvents.js — Cross-component event bus for AI chat actions
// =============================================================================
// Sections:
//   1. Events       — CHAT_EVENT, DEBRIEF_EVENT, dispatch helpers
//   2. Refresh Map  — which chat actions trigger a refresh per data domain
//   3. Hook         — useChatRefresh(domains, callback)
// =============================================================================

import { useEffect, useRef } from 'react'

// =============================================================================
// 1. EVENTS
// =============================================================================

// Fired by AIChat after any successful agent action. Components listen via useChatRefresh().
export const CHAT_EVENT = 'tradeo:chat-action'
export function dispatchChatAction(action) {
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { action } }))
}

// Fired after trade close — injects an AI debrief message into FloatingChat.
// NOTE (2026-07-30): AIChat.jsx listens for this, but nothing currently calls
// dispatchDebrief() to fire it — the trade-close trigger was never wired up.
export const DEBRIEF_EVENT = 'tradeo:coach-debrief'
export function dispatchDebrief({ symbol, debrief }) {
  window.dispatchEvent(new CustomEvent(DEBRIEF_EVENT, { detail: { symbol, debrief } }))
}

// Fired when a HomePage alert is clicked — tells the matching card (goals,
// watchlist, …) to scroll its item into view and flash a highlight.
// `domain`: 'goals' | 'watchlist' | 'positions'  ·  `key`: id or symbol to match.
export const HIGHLIGHT_EVENT = 'tradeo:highlight-item'
export function dispatchHighlight({ domain, key }) {
  window.dispatchEvent(new CustomEvent(HIGHLIGHT_EVENT, { detail: { domain, key } }))
}

// Subscribe to highlight requests for a given domain. The callback receives the
// `key` (id/symbol) to highlight. The dispatch may arrive a tick before the target
// list has rendered (e.g. right after navigating home), so callers debounce the
// scroll themselves. Returns nothing; cleans up on unmount.
export function useHighlightListener(domain, onHighlight) {
  const cbRef = useRef(onHighlight)
  cbRef.current = onHighlight
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.domain === domain && e.detail?.key != null) cbRef.current(e.detail.key)
    }
    window.addEventListener(HIGHLIGHT_EVENT, handler)
    return () => window.removeEventListener(HIGHLIGHT_EVENT, handler)
  }, [domain])
}

// =============================================================================
// 2. REFRESH MAP
// =============================================================================

// Maps data domain → chat action names that should trigger a re-fetch of that domain.
export const REFRESH_MAP = {
  trades: [
    'ADD_TRADE',
    'ADD_TO_POSITION',
    'CLOSE_TRADE',
    'UPDATE_SL_TP',
    'CONFIRM_DELETE',
    'PARTIAL_CLOSE',
    'SELECT_TRADE',
    'UNDO',
  ],
  watchlist: [
    'ADD_WATCHLIST',
    'REMOVE_WATCHLIST',
    'UPDATE_WATCHLIST',
    'BULK_ADD_WATCHLIST',
    'UNDO',
  ],
  goals: ['ADD_GOAL', 'UPDATE_GOAL', 'DELETE_GOAL', 'UNDO'],
  journal: ['ADD_JOURNAL', 'UNDO'],
}

// =============================================================================
// 3. HOOK
// =============================================================================

// Subscribe to chat actions that affect one or more domains.
// Usage: useChatRefresh(['trades', 'watchlist'], fetchData)
// callbackRef pattern: always calls the latest callback without re-subscribing the listener.
// domainsKey (sorted join) is the dep — avoids infinite re-subscription from array identity churn.
export function useChatRefresh(domains, callback) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const domainsKey = domains.slice().sort().join(',')
  useEffect(() => {
    const relevant = new Set(domains.flatMap((d) => REFRESH_MAP[d] || []))
    const handler = (e) => {
      if (relevant.has(e.detail?.action)) callbackRef.current()
    }
    window.addEventListener(CHAT_EVENT, handler)
    return () => window.removeEventListener(CHAT_EVENT, handler)
  }, [domainsKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
