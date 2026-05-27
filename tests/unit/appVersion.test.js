/**
 * Frontend Unit Tests — Build metadata
 *
 * Ensures the app version is available at runtime via Vite env injection.
 */

import { describe, test, expect } from 'vitest'

describe('app version', () => {
  test('exposes VITE_APP_VERSION', () => {
    expect(import.meta.env.VITE_APP_VERSION).toBeDefined()
    expect(import.meta.env.VITE_APP_VERSION).toBe(process.env.npm_package_version)
  })
})

