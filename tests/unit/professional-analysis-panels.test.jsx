// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfessionalPARightPanel } from '../../src/components/screen/ProfessionalAnalysisPanels'

const incompletePatternData = {
  structure: { trend: 'uptrend' },
  support_resistance: [],
  demand_supply: [],
  volume_spikes: [],
  patterns: [{ date: '2026-07-19', direction: 'bull' }],
}

describe('ProfessionalPARightPanel', () => {
  it('renders incomplete pattern records without crashing', () => {
    render(
      <ProfessionalPARightPanel
        paData={incompletePatternData}
        chartData={[{ time: '2026-07-19', close: 100 }]}
        currentPrice={100}
        kpis={null}
      />
    )

    expect(screen.getByText('Unclassified pattern')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Research' }))

    expect(screen.getByText('Unclassified pattern')).toBeInTheDocument()
  })
})
