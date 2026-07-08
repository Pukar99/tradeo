import { describe, expect, test, beforeEach } from 'vitest'
import { gCache } from '../../src/utils/globalCache'

beforeEach(() => { sessionStorage.clear(); gCache.clear() })

describe('gCache sessionStorage persistence', () => {
  test('persist:session survives a memory wipe (simulated reload)', () => {
    gCache.set('k1', { a: 1 }, 60_000, { persist: 'session' })
    // simulate reload: drop in-memory store but keep sessionStorage
    gCache._dropMemory() // test-only helper (see impl)
    expect(gCache.get('k1')).toEqual({ a: 1 })
  })
  test('memory-only default is NOT written to sessionStorage', () => {
    gCache.set('k2', 5, 60_000)
    expect(sessionStorage.getItem('gc:k2')).toBeNull()
  })
  test('expired persisted entry is ignored', () => {
    gCache.set('k3', 1, -1, { persist: 'session' }) // already expired
    gCache._dropMemory()
    expect(gCache.get('k3')).toBeUndefined()
  })
  test('del removes the persisted copy', () => {
    gCache.set('k4', 1, 60_000, { persist: 'session' })
    gCache.del('k4')
    expect(sessionStorage.getItem('gc:k4')).toBeNull()
  })
  test('corrupt sessionStorage value is ignored (no throw)', () => {
    sessionStorage.setItem('gc:k5', '{not json')
    gCache._dropMemory()
    expect(() => gCache.get('k5')).not.toThrow()
    expect(gCache.get('k5')).toBeUndefined()
  })
})
