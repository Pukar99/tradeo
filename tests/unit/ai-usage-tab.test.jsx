// @vitest-environment happy-dom
// (jsdom hits ERR_REQUIRE_ESM here — see vite.config.js test env note; happy-dom doesn't)
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
vi.mock('../../src/api/admin', () => ({ getAiUsage: (...a) => mockGet(...a) }))

import AIUsageTab from '../../src/components/admin/AIUsageTab'
import { ThemeProvider } from '../../src/context/ThemeContext'
import { clearAdminCache } from '../../src/utils/adminCache'

function renderTab() {
  return render(
    <ThemeProvider>
      <AIUsageTab />
    </ThemeProvider>
  )
}

const payload = {
  today: { calls: 3, tokens: 42, capCalls: 1000, capLeft: 997 },
  last30: { totalCalls: 3 },
  topUsers: [
    { user_id: 1, username: 'alice', calls: 2, tokens: 42 },
    { user_id: 2, username: 'bob', calls: 1, tokens: 0 },
  ],
  recentCalls: [
    { created_at: '2026-07-06T10:00:00Z', user_id: 1, username: 'alice', action: 'chat', model: 'llama-3.3-70b-versatile', fallback_used: false, success: true, error_code: null, total_tokens: 30 },
  ],
}

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockResolvedValue({ data: payload })
  // getAiUsage goes through adminCache's TTL cache, which is keyed on params and
  // persists across tests in this file (module state isn't reset per-test) —
  // without clearing it, a later test's call can silently hit an earlier test's
  // cached response instead of the freshly mocked one.
  clearAdminCache()
})
// No global afterEach(cleanup) is wired for this suite (default test env is 'node',
// this file opts into happy-dom) — without it, each renderTab() stacks a new tree
// onto the same document and `screen` queries pick up stale DOM from prior tests.
afterEach(cleanup)

describe('AIUsageTab', () => {
  test('renders today/left, total calls tile, and top users after load', async () => {
    renderTab()
    await waitFor(() => expect(screen.getAllByText('alice').length).toBeGreaterThan(0))
    expect(screen.getByText(/997/)).toBeInTheDocument()      // capLeft
    expect(screen.getByText('3')).toBeInTheDocument()         // total calls (30d)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('clicking a top-user row refetches with that user_id filter', async () => {
    renderTab()
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument())
    fireEvent.click(screen.getByText('bob'))
    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith({ user_id: 2 })
    )
  })

  test('shows error text when the fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    renderTab()
    await waitFor(() => expect(screen.getByText(/went wrong|try again|boom/i)).toBeInTheDocument())
  })
})
