import { describe, test, expect } from 'vitest'
import { cardRenderMode, cardFallbackText, KNOWN_CARD_KINDS } from '../../src/components/chat/cardKind'

describe('card protocol — cardRenderMode', () => {
  test('candlestick kind → candlestick renderer', () => {
    expect(cardRenderMode({ kind: 'candlestick', data: {} })).toBe('candlestick')
  })
  test('unknown kind → text fallback (never crash)', () => {
    expect(cardRenderMode({ kind: 'mystery' })).toBe('text')
  })
  test('null/undefined card → text fallback', () => {
    expect(cardRenderMode(null)).toBe('text')
    expect(cardRenderMode(undefined)).toBe('text')
  })
  test('candlestick is a known kind', () => {
    expect(KNOWN_CARD_KINDS).toContain('candlestick')
  })
})

describe('card protocol — cardFallbackText', () => {
  test('returns the reply string when present', () => {
    expect(cardFallbackText({ kind: 'x', reply: 'hello there' })).toBe('hello there')
  })
  test('returns empty string when no reply', () => {
    expect(cardFallbackText({ kind: 'x' })).toBe('')
    expect(cardFallbackText(null)).toBe('')
  })
})
