// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import ViewSwitcher from '../../src/components/shared/ViewSwitcher'

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cycles', label: 'All cycles' },
]

describe('ViewSwitcher', () => {
  test('renders one pressed pill per view and fires onChange with the view id', () => {
    let got = null
    render(
      <ViewSwitcher views={VIEWS} active="overview" onChange={(id) => (got = id)} ariaLabel="Performance view" />
    )
    const active = screen.getByRole('tab', { name: 'Overview' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'All cycles' }))
    expect(got).toBe('cycles')
  })
})
