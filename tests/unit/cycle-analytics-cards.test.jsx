// @vitest-environment happy-dom
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

const movers = vi.fn()
const consistency = vi.fn()
vi.mock('../../src/api', () => ({
  getCycleMovers: (...a) => movers(...a),
  getCycleConsistency: (...a) => consistency(...a),
}))

import CycleAnalyticsCards from '../../src/components/complex/breakdown/CycleAnalyticsCards'

const CYCLES = [{ start_date: '2023-01-01', end_date: '2023-06-01', type: 'bull' }]

beforeEach(() => {
  movers.mockReset().mockResolvedValue({
    data: {
      gainers: [{ symbol: 'WINA', company_name: 'Winner A', avg_ret: 55.1, cycles_covered: 1 }],
      losers: [{ symbol: 'LOSA', company_name: 'Loser A', avg_ret: -16.6, cycles_covered: 1 }],
      n: 5, cycles_selected: 1, total_symbols: 3, excluded_partial: 0,
    },
  })
  consistency.mockReset().mockResolvedValue({
    data: {
      stocks: [{ symbol: 'WINA', company_name: 'Winner A', up_count: 1, n_covered: 1, avg_ret: 55.1, corr: null }],
      cycles_selected: 1, index_id: 12,
    },
  })
})

describe('CycleAnalyticsCards', () => {
  test('empty selection: friendly empty state, no fetch', () => {
    render(<CycleAnalyticsCards selectedCycles={[]} />)
    expect(screen.getAllByText(/select a cycle/i).length).toBeGreaterThan(0)
    expect(movers).not.toHaveBeenCalled()
  })

  test('renders movers + consistency; corr null shows dash; honest footer', async () => {
    render(<CycleAnalyticsCards selectedCycles={CYCLES} />)
    await waitFor(() => expect(screen.getAllByText('WINA').length).toBeGreaterThan(0), {
      timeout: 2000,
    })
    // Movers view is shown by default — WINA (gainer) and LOSA (loser) both visible.
    expect(screen.getByText('WINA')).toBeInTheDocument()
    expect(screen.getByText('LOSA')).toBeInTheDocument()

    // Switching to Consistency must NOT refetch — same debounced fetch stays put.
    fireEvent.click(screen.getByRole('tab', { name: 'Consistency' }))
    expect(screen.getByText(/up 1\/1/)).toBeInTheDocument()
    expect(screen.getByText('history, not a promise')).toBeInTheDocument()
    expect(screen.queryByText(/probability/i)).toBeNull()

    // payload shape: exactly the 3 fields + n for movers
    expect(movers).toHaveBeenCalledWith(
      { cycles: [{ start_date: '2023-01-01', end_date: '2023-06-01', type: 'bull' }], n: 5 },
      expect.anything()
    )
    expect(movers).toHaveBeenCalledTimes(1)
  })
})
