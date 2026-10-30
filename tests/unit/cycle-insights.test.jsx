// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, test, expect, vi, afterEach } from 'vitest'
import CycleInsights from '../../src/components/complex/breakdown/CycleInsights'

afterEach(cleanup)

const CYCLES = [
  { start_date: '2023-01-01', end_date: '2023-06-01', type: 'bull', name: 'Bull 1' },
  { start_date: '2024-01-01', end_date: '2024-06-01', type: 'bull', name: 'Bull 2' },
]
const DATA = {
  index_rets: [20, 30],
  insights: {
    stocks: [
      { symbol: 'WINA', company_name: 'Winner A', per_wave: [40, 50], n_covered: 2, up_count: 2, avg_ret: 45, floor: 40, corr: 0.8 },
      { symbol: 'LOSA', company_name: 'Loser A', per_wave: [-10, -5], n_covered: 2, up_count: 0, avg_ret: -7.5, floor: -10, corr: 0.2 },
    ],
  },
}
const base = { selectedCycles: CYCLES, data: DATA, loading: false, error: '', onDismissError() {}, indexLbl: 'NEPSE', picked: null, dark: false }

describe('CycleInsights', () => {
  test('empty selection shows a friendly prompt', () => {
    render(<CycleInsights {...base} selectedCycles={[]} data={null} onPick={() => {}} />)
    expect(screen.getByText(/select a cycle/i)).toBeTruthy()
  })
  test('summary names the best reliable winner', () => {
    render(<CycleInsights {...base} onPick={() => {}} />)
    expect(screen.getByText(/reliable winners/i)).toBeTruthy()
    expect(screen.getAllByText('WINA').length).toBeGreaterThan(0)
  })
  test('table row click opens the deep dive for that stock', () => {
    const onPick = vi.fn()
    render(<CycleInsights {...base} onPick={onPick} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }))
    fireEvent.click(screen.getByText('LOSA'))
    expect(onPick).toHaveBeenCalledWith('LOSA')
  })
  test('lens re-sorts the same list (Top losers puts LOSA first)', () => {
    render(<CycleInsights {...base} onPick={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }))
    fireEvent.click(screen.getByText('Top losers'))
    const firstRow = document.querySelector('tbody tr')
    expect(firstRow.textContent).toContain('LOSA')
  })
})
