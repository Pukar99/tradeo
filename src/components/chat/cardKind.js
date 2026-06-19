// Pure helpers for the chat card protocol — no React/DOM, so they're unit-testable in the
// repo's node-env Vitest. The component shell (CardRenderer.jsx) imports these to decide rendering.

// The card kinds the frontend knows how to render. Unknown kinds fall back to plain text.
export const KNOWN_CARD_KINDS = ['candlestick']

// Decide how to render a card envelope. Returns 'candlestick' | 'text'.
// 'text' is the graceful fallback for a missing/unknown kind so the chat never breaks on a card
// it doesn't understand (the card's `reply` string is shown instead).
export function cardRenderMode(card) {
  if (!card || !KNOWN_CARD_KINDS.includes(card.kind)) return 'text'
  return card.kind
}

// The text shown when a card can't be rendered as its kind (fallback).
export function cardFallbackText(card) {
  return (card && typeof card.reply === 'string') ? card.reply : ''
}
