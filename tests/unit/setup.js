/**
 * Vitest global setup for frontend unit tests
 *
 * Imported by vite.config.js → test.setupFiles
 */

import '@testing-library/jest-dom'

// Minimal in-memory sessionStorage polyfill — test env is 'node' (not jsdom,
// to avoid ESM conflicts), so sessionStorage isn't globally available.
// Only installed if not already present (e.g. if env ever switches to jsdom).
if (typeof globalThis.sessionStorage === 'undefined') {
  const _map = new Map()
  const _base = {
    getItem: (k) => (_map.has(k) ? _map.get(k) : null),
    setItem: (k, v) => _map.set(k, String(v)),
    removeItem: (k) => _map.delete(k),
    clear: () => _map.clear(),
    key: (i) => Array.from(_map.keys())[i] ?? null,
    get length() {
      return _map.size
    },
  }
  // Proxy so Object.keys(sessionStorage) enumerates stored keys, matching
  // real browser sessionStorage (used by globalCache's _ss.keys()).
  globalThis.sessionStorage = new Proxy(_base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      return _map.has(prop) ? _map.get(prop) : undefined
    },
    ownKeys() {
      return Array.from(_map.keys())
    },
    getOwnPropertyDescriptor(target, prop) {
      if (_map.has(prop)) {
        return { enumerable: true, configurable: true, value: _map.get(prop) }
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
    has(target, prop) {
      return prop in target || _map.has(prop)
    },
  })
}

