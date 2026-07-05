// === auth-form.test.js — behavior locks for the shared auth-form helpers (P1.3 extraction) ===
// These pin the exact behavior the inline LoginPage/SignupPage copies had, so the
// extraction stays provably identical-output.
import { describe, it, expect } from 'vitest'
import { suggestEmail, authFieldClass } from '../../src/utils/authForm'

describe('suggestEmail — email-domain typo suggester', () => {
  it('suggests for a one-char substitution (gnail → gmail)', () => {
    expect(suggestEmail('user@gnail.com')).toBe('user@gmail.com')
  })

  it('does NOT catch a transposition (gmial is distance 2) — locked quirk', () => {
    expect(suggestEmail('user@gmial.com')).toBeNull()
  })

  it('suggests for a one-char deletion (outlok → outlook)', () => {
    expect(suggestEmail('user@outlok.com')).toBe('user@outlook.com')
  })

  it('suggests for a one-char insertion (yahooo → yahoo)', () => {
    expect(suggestEmail('user@yahooo.com')).toBe('user@yahoo.com')
  })

  it('preserves the local part verbatim, only fixes the domain', () => {
    expect(suggestEmail('First.Last+tag@gmail.co')).toBe('First.Last+tag@gmail.com')
  })

  it('returns null for an already-correct known domain', () => {
    expect(suggestEmail('user@gmail.com')).toBeNull()
  })

  it('returns null when the domain is 2+ edits from every known domain', () => {
    expect(suggestEmail('user@company.com.np')).toBeNull()
  })

  it('returns null while the domain is still too short to judge (<3 chars)', () => {
    expect(suggestEmail('user@gm')).toBeNull()
  })

  it('returns null with no @ or an empty local part', () => {
    expect(suggestEmail('nodomain')).toBeNull()
    expect(suggestEmail('@gmail.com')).toBeNull()
    expect(suggestEmail('')).toBeNull()
  })

  it('matches domains case-insensitively', () => {
    expect(suggestEmail('user@GNAIL.COM')).toBe('user@gmail.com')
  })
})

describe('authFieldClass — auth input className builder', () => {
  const BASE =
    'auth-input w-full border dark:bg-gray-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200'

  it('renders the neutral border when there is no error (exact string lock)', () => {
    expect(authFieldClass('')).toBe(
      `${BASE} border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`
    )
    expect(authFieldClass(undefined)).toContain('border-gray-200')
  })

  it('renders the red border for any truthy error (exact string lock)', () => {
    expect(authFieldClass('Email is required')).toBe(
      `${BASE} border-red-400 dark:border-red-500`
    )
  })
})
