// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ProfessionalPARightPanel,
  ProfessionalSMCRightPanel,
  SMCShadowEvidence,
} from '../../src/components/screen/ProfessionalAnalysisPanels'

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

const shadowResult = {
  mode: 'shadow',
  asOf: '2026-07-23',
  candles: 750,
  displayEligible: false,
  reliability: { label: 'UNVALIDATED', outcomeAudit: 'HOLD' },
  dataQuality: { quality: 'LIMITED', canScan: true },
  decision: {
    state: 'DEVELOPING',
    reason: 'Waiting for a confirmed retest.',
    nextConfirmation: 'Bullish displacement close',
    displayAction: 'HOLD_SHADOW',
    leadSetup: null,
  },
  context: {
    structureBias: 'BULLISH',
    regime: { classification: 'TRENDING' },
    execution: {
      severity: 'CAUTION',
      explanation: 'Participation is below its recent baseline.',
    },
  },
  active: {
    structureEvents: [{ id: 's1' }],
    liquidityEvents: [
      {
        id: 'l1',
        type: 'LIQUIDITY_SWEEP',
        direction: 'BULLISH',
        status: 'ACTIVE',
        originTime: '2026-07-20',
        confirmedAt: '2026-07-22',
      },
    ],
    liquidityPools: [],
    orderBlocks: [],
    fairValueGaps: [],
    setups: [],
  },
}

describe('SMCShadowEvidence', () => {
  it('shows loading without inventing evidence', () => {
    render(<SMCShadowEvidence loading />)

    expect(screen.getByLabelText('Loading V2 shadow evidence')).toBeInTheDocument()
    expect(screen.queryByText('UNVALIDATED · HOLD')).not.toBeInTheDocument()
  })

  it('keeps V1 available when shadow loading fails', () => {
    render(<SMCShadowEvidence error="V2 shadow evidence is temporarily unavailable." />)

    expect(screen.getByText('Shadow unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('V1 evidence and chart overlays continue normally.')
    ).toBeInTheDocument()
  })

  it('shows rejected data as blocked and remains shadow-only', () => {
    render(
      <SMCShadowEvidence
        data={{
          ...shadowResult,
          dataQuality: { quality: 'REJECTED', canScan: false },
          decision: {
            ...shadowResult.decision,
            state: 'SCANNING',
            reason: 'Dataset qualification must pass before the V2 engine can scan.',
          },
          context: null,
          active: {
            structureEvents: [],
            liquidityEvents: [],
            liquidityPools: [],
            orderBlocks: [],
            fairValueGaps: [],
            setups: [],
          },
        }}
      />
    )

    expect(screen.getByText('REJECTED')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText(/SHADOW ONLY/)).toBeInTheDocument()
  })

  it('renders technical state and plain-language next confirmation without performance claims', () => {
    const { container } = render(<SMCShadowEvidence data={shadowResult} />)

    expect(screen.getByText('UNVALIDATED · HOLD')).toBeInTheDocument()
    expect(screen.getByText('Waiting for a confirmed retest.')).toBeInTheDocument()
    expect(screen.getByText('Bullish displacement close')).toBeInTheDocument()
    expect(screen.getByText('TRENDING')).toBeInTheDocument()
    expect(screen.getByText('CAUTION')).toBeInTheDocument()
    expect(screen.getByText('Participation is below its recent baseline.')).toBeInTheDocument()
    expect(screen.getByText('LIQUIDITY SWEEP')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/probability|win rate/i)
  })

  it('distinguishes an authenticated pending entry from a factual entered setup', () => {
    const armedSetup = {
      id: 'armed-1',
      family: 'SELL_SIDE_SWEEP_REVERSAL',
      decisionState: 'ARMED',
      reason: 'Every evidence gate passed; the fixed entry is waiting for a later candle to trade.',
      nextConfirmation: 'Wait for price to trade 422.60 within 3 completed candles.',
    }
    const { rerender } = render(
      <SMCShadowEvidence
        data={{
          ...shadowResult,
          decision: {
            ...shadowResult.decision,
            state: 'ARMED',
            reason: armedSetup.reason,
            nextConfirmation: armedSetup.nextConfirmation,
            leadSetup: armedSetup,
          },
          active: { ...shadowResult.active, setups: [armedSetup] },
        }}
      />
    )

    expect(screen.getAllByText('ARMED').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/fixed entry is waiting/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/within 3 completed candles/i).length).toBeGreaterThan(0)

    const enteredSetup = {
      ...armedSetup,
      decisionState: 'ENTERED',
      reason: 'The planned entry traded on a later completed candle.',
      nextConfirmation: 'Monitor the fixed stop and observed target; do not move the risk plan.',
    }
    rerender(
      <SMCShadowEvidence
        data={{
          ...shadowResult,
          decision: {
            ...shadowResult.decision,
            state: 'ENTERED',
            reason: enteredSetup.reason,
            nextConfirmation: enteredSetup.nextConfirmation,
            leadSetup: enteredSetup,
          },
          active: { ...shadowResult.active, setups: [enteredSetup] },
        }}
      />
    )

    expect(screen.getAllByText('ENTERED').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/planned entry traded/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/do not move the risk plan/i).length).toBeGreaterThan(0)
  })
})

describe('ProfessionalSMCRightPanel legacy boundary', () => {
  it('hides V1 diagnostics by default and labels them when expanded', () => {
    render(
      <ProfessionalSMCRightPanel
        smcData={{
          bos: [{ date: '2026-07-20', type: 'bullish', level: 545 }],
          choch: [],
          sweeps: [],
          order_blocks: [],
          fvg: [],
        }}
        signals={[
          {
            date: '2026-07-02',
            entryPrice: 541,
            conditions: {},
          },
        ]}
        config={{}}
        chartData={[
          { time: '2026-07-02', close: 541 },
          { time: '2026-07-20', close: 550 },
        ]}
        currentPrice={550}
        shadowData={shadowResult}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }))

    expect(screen.getByText('Legacy V1 reference')).toBeInTheDocument()
    expect(screen.queryByText('V1 latest candidate')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show legacy diagnostics' }))

    expect(screen.getByText('V1 latest candidate')).toBeInTheDocument()
    expect(screen.getByText('V1 candidate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide legacy diagnostics' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
