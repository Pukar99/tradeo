// @vitest-environment happy-dom
import { useState } from 'react'
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

// New required props (S3 T6): view is now controlled by the parent (BreakdownPage);
// compare carries the A/B sides for the Compare view.
const compareProp = { a: null, b: null, onChangeA() {}, onChangeB() {} }

// Small stateful wrapper so tests can exercise the now-lifted `view` control
// the same way BreakdownPage does (view state lives in the parent).
function Harness({ selectedCycles }) {
  const [view, setView] = useState('movers')
  return (
    <CycleAnalyticsCards
      selectedCycles={selectedCycles}
      view={view}
      onViewChange={setView}
      compare={compareProp}
    />
  )
}

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
    render(<Harness selectedCycles={[]} />)
    expect(screen.getAllByText(/select a cycle/i).length).toBeGreaterThan(0)
    expect(movers).not.toHaveBeenCalled()
  })

  test('renders movers + consistency; corr null shows dash; honest footer', async () => {
    render(<Harness selectedCycles={CYCLES} />)
    await waitFor(() => expect(screen.getAllByText('WINA').length).toBeGreaterThan(0), {
      timeout: 2000,
    })
    // Movers view is shown by default — WINA (gainer) and LOSA (loser) both visible.
    expect(screen.getByText('WINA')).toBeInTheDocument()
    expect(screen.getByText('LOSA')).toBeInTheDocument()

    // Switching to Consistency must NOT refetch — same debounced fetch stays put.
    fireEvent.click(screen.getByRole('tab', { name: 'Consistency' }))
    expect(screen.getByText(/selected cycle/)).toBeInTheDocument()
    expect(screen.getByText(/1 of 1/)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument() // corr null
    expect(screen.getByText('history, not a promise')).toBeInTheDocument()
    expect(screen.queryByText(/probability/i)).toBeNull()

    // payload shape: exactly the 3 fields + bumped n (owner addition: 15 per side)
    expect(movers).toHaveBeenCalledWith(
      { cycles: [{ start_date: '2023-01-01', end_date: '2023-06-01', type: 'bull' }], n: 15 },
      expect.anything()
    )
    expect(movers).toHaveBeenCalledTimes(1)
  })
})
