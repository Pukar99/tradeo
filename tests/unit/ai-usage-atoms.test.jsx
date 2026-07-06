// @vitest-environment happy-dom
// (jsdom hits ERR_REQUIRE_ESM here — see vite.config.js test env note; happy-dom doesn't)
import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import StatCard from '../../src/components/admin/StatCard'
import UsageBar from '../../src/components/admin/UsageBar'

describe('StatCard', () => {
  test('renders label and value', () => {
    render(<StatCard label="Total calls" value={1234} />)
    expect(screen.getByText('Total calls')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
  })
})

describe('UsageBar', () => {
  test('clamps fill width to 0..100 and exposes percent via aria', () => {
    const { rerender } = render(<UsageBar value={50} max={100} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    rerender(<UsageBar value={150} max={100} />) // over cap → clamps to 100
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  test('handles max=0 without NaN (divide-by-zero guard)', () => {
    render(<UsageBar value={5} max={0} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
