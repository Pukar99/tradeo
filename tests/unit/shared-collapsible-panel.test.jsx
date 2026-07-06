// @vitest-environment happy-dom
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { describe, test, expect, beforeEach } from 'vitest'
import {
  usePanelOpen,
  CollapsiblePanel,
  PanelToggle,
} from '../../src/components/shared/CollapsiblePanel'

beforeEach(() => localStorage.clear())

describe('usePanelOpen', () => {
  test('defaults open and persists toggle to localStorage', () => {
    const { result } = renderHook(() => usePanelOpen('t_key'))
    expect(result.current[0]).toBe(true)
    act(() => result.current[1]()) // toggle
    expect(result.current[0]).toBe(false)
    expect(JSON.parse(localStorage.getItem('t_key'))).toBe(false)
  })
})

describe('CollapsiblePanel', () => {
  test('open: renders children, no collapsed class', () => {
    const { container } = render(
      <CollapsiblePanel side="left" open>
        <span>panel body</span>
      </CollapsiblePanel>
    )
    expect(screen.getByText('panel body')).toBeInTheDocument()
    expect(container.firstChild.className).not.toContain('screen-panel-collapsed')
  })
  test('closed: width classes go to w-0 and collapsed class applied', () => {
    const { container } = render(
      <CollapsiblePanel side="right" open={false}>
        <span>panel body</span>
      </CollapsiblePanel>
    )
    expect(container.firstChild.className).toContain('w-0')
    expect(container.firstChild.className).toContain('screen-panel-collapsed')
  })
})

describe('PanelToggle', () => {
  test('fires onToggle and titles by state', () => {
    let calls = 0
    render(<PanelToggle side="left" open onToggle={() => calls++} label="left panel" />)
    const btn = screen.getByTitle('Hide left panel')
    fireEvent.click(btn)
    expect(calls).toBe(1)
  })
})
