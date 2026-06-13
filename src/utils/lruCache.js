// === utils/lruCache.js — module-level LRU + TTL cache factory (Rule 46) ===
// True LRU: get() promotes via delete+set (Map preserves insertion order).
// This is the blessed client-side cache for API data layers — see
// components/complex/insight/useMonthDetail.js for the reference usage
// (cache + AbortController + key guard). Don't hand-roll new variants.
export function makeLruCache(max, ttl) {
  const map = new Map()
  return {
    get(key) {
      const e = map.get(key)
      if (!e) return null
      if (Date.now() - e.ts >= ttl) {
        map.delete(key)
        return null
      }
      map.delete(key)
      map.set(key, e)
      return e.data
    },
    set(key, data) {
      if (map.has(key)) map.delete(key)
      else if (map.size >= max) map.delete(map.keys().next().value)
      map.set(key, { data, ts: Date.now() })
    },
    clear() {
      map.clear()
    },
  }
}
