// @vitest-environment happy-dom
// (jsdom hits ERR_REQUIRE_ESM here — see vite.config.js test env note; happy-dom doesn't)
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
vi.mock('../../src/api/admin', () => ({ getAiUsage: (...a) => mockGet(...a) }))

import AIUsageTab from '../../src/components/admin/AIUsageTab'

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

beforeEach(() => { mockGet.mockReset(); mockGet.mockResolvedValue({ data: payload }) })

describe('AIUsageTab', () => {
  test('renders today/left, total calls tile, and top users after load', async () => {
    render(<AIUsageTab />)
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())
    expect(screen.getByText(/997/)).toBeInTheDocument()      // capLeft
    expect(screen.getByText('3')).toBeInTheDocument()         // total calls (30d)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('clicking a top-user row refetches with that user_id filter', async () => {
    render(<AIUsageTab />)
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument())
    fireEvent.click(screen.getByText('bob'))
    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith({ user_id: 2 })
    )
  })

  test('shows error text when the fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    render(<AIUsageTab />)
    await waitFor(() => expect(screen.getByText(/went wrong|try again|boom/i)).toBeInTheDocument())
  })
})
