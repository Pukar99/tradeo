import { useEffect, useRef } from 'react'

// ── Chat action event bus ─────────────────────────────────────────────────────
// Fired by AIChat after any successful agent action.
// Components listen with useChatRefresh() and re-fetch their data.

export const CHAT_EVENT = 'tradeo:chat-action'

export function dispatchChatAction(action) {
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { action } }))
}

// Which actions should trigger a refresh per data domain
export const REFRESH_MAP = {
  trades:   ['ADD_TRADE', 'CLOSE_TRADE', 'UPDATE_SL_TP', 'CONFIRM_DELETE', 'PARTIAL_CLOSE', 'SELECT_TRADE', 'UNDO'],
  watchlist:['ADD_WATCHLIST', 'REMOVE_WATCHLIST', 'UPDATE_WATCHLIST', 'BULK_ADD_WATCHLIST', 'UNDO'],
  goals:    ['ADD_GOAL', 'UPDATE_GOAL', 'DELETE_GOAL', 'UNDO'],
  journal:  ['ADD_JOURNAL', 'UNDO'],
}

// Hook: subscribe to chat actions that affect a given domain
// usage: useChatRefresh(['trades', 'watchlist'], fetchData)
// Uses a ref so the latest callback is always called without re-subscribing.
export function useChatRefresh(domains, callback) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  // P2-007: re-build relevant set when domains change (stable dep via join)
  const domainsKey = domains.slice().sort().join(',')
  useEffect(() => {
    const relevant = new Set(domains.flatMap(d => REFRESH_MAP[d] || []))
    const handler = (e) => {
      if (relevant.has(e.detail?.action)) callbackRef.current()
    }
    window.addEventListener(CHAT_EVENT, handler)
    return () => window.removeEventListener(CHAT_EVENT, handler)
  }, [domainsKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
