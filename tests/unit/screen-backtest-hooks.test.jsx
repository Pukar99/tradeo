// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useBacktestSession } from '../../src/hooks/useBacktestSession'
import { useBacktestEngine } from '../../src/hooks/useBacktestEngine'
import { btGetOHLCV, btUpdateSession, btExitOrder } from '../../src/api/backtest'
import { nptToday } from '../../src/utils/nepseCalendar'

vi.mock('../../src/api/backtest', () => ({
  btGetSession: vi.fn(),
  btGetOHLCV: vi.fn(),
  btUpdateSession: vi.fn(),
  btSettleOrder: vi.fn(),
  btExitOrder: vi.fn(),
  btLogBehavior: vi.fn(),
}))

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  btGetOHLCV.mockResolvedValue({ data: { candles: [] } })
  btUpdateSession.mockResolvedValue({ data: { ok: true } })
  btExitOrder.mockResolvedValue({ data: { status: 'CLOSED' } })
})

test('nptToday uses Nepal time instead of the UTC calendar date', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T18:30:00.000Z'))
  expect(nptToday()).toBe('2026-01-02')
})

describe('useBacktestSession canonical script state', () => {
  test('keeps position changes in session.scripts when switching tabs', async () => {
    const first = { id: 's1', symbol: 'NABIL', start_date: '2025-01-01', positions: [] }
    const second = { id: 's2', symbol: 'NICA', start_date: '2025-01-01', positions: [] }
    const session = {
      id: 'session-1',
      active_script: 'NABIL',
      available_capital: 100000,
      scripts: [first, second],
    }
    const { result } = renderHook(() => useBacktestSession())

    await act(async () => result.current.onSessionStarted(session))
    act(() =>
      result.current.addPositionLocal({
        id: 'order-1',
        symbol: 'NABIL',
        status: 'OPEN',
        available_capital_after: 90000,
      })
    )

    expect(result.current.session.scripts[0].positions).toHaveLength(1)
    await act(async () =>
      result.current.switchToScript(result.current.session, result.current.session.scripts[1])
    )
    await act(async () =>
      result.current.switchToScript(result.current.session, result.current.session.scripts[0])
    )
    expect(result.current.currentScript.positions[0].id).toBe('order-1')
  })

  test('registers a newly added script in the session tab list', async () => {
    const first = { id: 's1', symbol: 'NABIL', start_date: '2025-01-01', positions: [] }
    const session = { id: 'session-1', active_script: 'NABIL', scripts: [first] }
    const added = { id: 's2', symbol: 'NICA', start_date: '2025-01-01', positions: [] }
    const { result } = renderHook(() => useBacktestSession())

    await act(async () => result.current.onSessionStarted(session))
    await act(async () => result.current.switchToScript(result.current.session, added))

    expect(result.current.session.scripts.map((script) => script.id)).toEqual(['s1', 's2'])
  })
})

describe('useBacktestEngine candle ordering', () => {
  function props(overrides = {}) {
    return {
      session: { id: 'session-1', sl_mode: 'AUTO' },
      currentScript: { id: 's1', positions: [] },
      candles: [
        { date: '2025-01-01', open: 100, high: 110, low: 80, close: 100 },
        { date: '2025-01-02', open: 100, high: 105, low: 99, close: 102 },
      ],
      cursorIndex: 0,
      advanceCursor: vi.fn(),
      settlePositions: vi.fn().mockResolvedValue([]),
      closePositionLocal: vi.fn(),
      onSLBreach: vi.fn(),
      onTPHit: vi.fn(),
      onDataEnd: vi.fn(),
      onActionError: vi.fn(),
      ...overrides,
    }
  }

  test('processes the next hidden candle, not the already-visible candle', async () => {
    const options = props()
    const { result } = renderHook(() => useBacktestEngine(options))

    await act(async () => result.current.stepForward())

    expect(options.settlePositions).toHaveBeenCalledWith('2025-01-02')
    expect(options.advanceCursor).toHaveBeenCalledWith(1, '2025-01-02')
  })

  test('treats an exact stop-price touch as an SL hit', async () => {
    const position = {
      id: 'order-1',
      symbol: 'NABIL',
      status: 'OPEN',
      settled: true,
      sl: 99,
    }
    const options = props({ currentScript: { id: 's1', positions: [position] } })
    const { result } = renderHook(() => useBacktestEngine(options))

    await act(async () => result.current.stepForward())

    expect(btExitOrder).toHaveBeenCalledWith('session-1', 'order-1', {
      exit_date: '2025-01-02',
      exit_price: 99,
      reason: 'SL_HIT',
    })
    expect(options.closePositionLocal).toHaveBeenCalledWith('order-1', { status: 'CLOSED' })
  })
})
