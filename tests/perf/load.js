/**
 * k6 Performance / Load Tests — Tradeo API
 *
 * Scenarios:
 *  1. auth_flow        — signup → login (warm-up, 5 VUs, 30s)
 *  2. trade_crud       — login → create → list → close trades (50 VUs, 2min)
 *  3. concurrent_burst — 100 VUs spike for 30s, simulate market-open rush
 *  4. dashboard_load   — repeated dashboard reads under load (20 VUs, 3min)
 *
 * Requirements:
 *  - k6 installed: https://k6.io/docs/get-started/installation/
 *  - Backend running on API_BASE (default: http://localhost:5000)
 *
 * Run: k6 run tests/perf/load.js
 * With options: k6 run --env SCENARIO=trade_crud tests/perf/load.js
 */

import http    from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

// ── Config ─────────────────────────────────────────────────────────────────────

const API_BASE = __ENV.API_BASE || 'http://localhost:5000'
const SCENARIO = __ENV.SCENARIO || 'all'

// ── Custom metrics ─────────────────────────────────────────────────────────────

const tradeCreateErrors = new Counter('trade_create_errors')
const tradeCreateTime   = new Trend('trade_create_duration')
const loginSuccess      = new Rate('login_success_rate')
const p99Threshold      = new Trend('p99_response_time')

// ── k6 options ─────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    auth_flow: {
      executor:    'constant-vus',
      vus:          5,
      duration:    '30s',
      exec:        'authFlow',
      tags:        { scenario: 'auth' },
    },
    trade_crud: {
      executor:    'ramping-vus',
      startVUs:     5,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '1m',  target: 50 },
        { duration: '30s', target: 0  },
      ],
      exec:        'tradeCrud',
      tags:        { scenario: 'trade' },
    },
    concurrent_burst: {
      executor:    'ramping-arrival-rate',
      startRate:    10,
      timeUnit:    '1s',
      preAllocatedVUs: 50,
      maxVUs:       150,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0   },
      ],
      exec:        'burstTradeCreate',
      tags:        { scenario: 'burst' },
    },
    dashboard_load: {
      executor:    'constant-vus',
      vus:          20,
      duration:    '3m',
      exec:        'dashboardLoad',
      tags:        { scenario: 'dashboard' },
    },
  },
  thresholds: {
    // 95% of requests < 500ms
    http_req_duration:      ['p(95)<500', 'p(99)<1000'],
    // Login must succeed > 95% of the time
    login_success_rate:     ['rate>0.95'],
    // Trade create errors < 1%
    trade_create_errors:    ['count<5'],
    // No 5xx errors
    'http_req_failed':      ['rate<0.01'],
  },
}

// ── Shared auth helper ─────────────────────────────────────────────────────────

function getAuthToken(email, password) {
  const loginRes = http.post(
    `${API_BASE}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  const success = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'token present':    (r) => {
      try { return !!JSON.parse(r.body).token } catch { return false }
    },
  })
  loginSuccess.add(success)
  if (!success) return null
  return JSON.parse(loginRes.body).token
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
}

// ── Scenario: Auth Flow ────────────────────────────────────────────────────────

export function authFlow() {
  const uid   = uuidv4().slice(0, 8)
  const email = `perf_${uid}@loadtest.com`
  const pass  = 'loadtest123'

  group('signup', () => {
    const res = http.post(
      `${API_BASE}/api/auth/signup`,
      JSON.stringify({ name: 'Load Tester', email, password: pass }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    check(res, {
      'signup 201': (r) => r.status === 201,
      'no error':   (r) => !JSON.parse(r.body || '{}').error,
    })
  })

  sleep(0.5)

  group('login', () => {
    getAuthToken(email, pass)
  })

  sleep(1)
}

// ── Scenario: Trade CRUD ───────────────────────────────────────────────────────

export function tradeCrud() {
  // Each VU creates its own account
  const uid   = `${__VU}_${__ITER}`
  const email = `trade_vu${uid}@loadtest.com`
  const pass  = 'loadtest123'

  // Signup (only once per VU — first iteration)
  if (__ITER === 0) {
    http.post(
      `${API_BASE}/api/auth/signup`,
      JSON.stringify({ name: `VU ${__VU}`, email, password: pass }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const token = getAuthToken(email, pass)
  if (!token) { sleep(1); return }

  const headers = authHeaders(token)
  let tradeId

  group('create_trade', () => {
    const start = Date.now()
    const res   = http.post(
      `${API_BASE}/api/tradelog`,
      JSON.stringify({
        date:        '2025-04-01',
        symbol:      `VU${__VU}`,
        position:    'LONG',
        quantity:    100,
        entry_price: 500,
      }),
      { headers }
    )
    const dur = Date.now() - start
    tradeCreateTime.add(dur)
    p99Threshold.add(dur)

    const ok = check(res, {
      'trade created 201': (r) => r.status === 201,
      'has trade id':      (r) => {
        try { return !!JSON.parse(r.body).id } catch { return false }
      },
    })
    if (!ok) { tradeCreateErrors.add(1); return }
    tradeId = JSON.parse(res.body).id
  })

  sleep(0.2)

  if (!tradeId) return

  group('list_trades', () => {
    const res = http.get(`${API_BASE}/api/tradelog`, { headers })
    check(res, { 'list trades 200': (r) => r.status === 200 })
  })

  sleep(0.2)

  group('close_trade', () => {
    const res = http.post(
      `${API_BASE}/api/tradelog/${tradeId}/close`,
      JSON.stringify({ exit_price: 550 }),
      { headers }
    )
    check(res, {
      'trade closed 200': (r) => r.status === 200,
      'status CLOSED':    (r) => {
        try { return JSON.parse(r.body).status === 'CLOSED' } catch { return false }
      },
    })
  })

  sleep(0.5)

  group('delete_trade', () => {
    const res = http.del(`${API_BASE}/api/tradelog/${tradeId}`, null, { headers })
    check(res, { 'trade deleted 200/204': (r) => r.status === 200 || r.status === 204 })
  })

  sleep(1)
}

// ── Scenario: Concurrent Burst ─────────────────────────────────────────────────

export function burstTradeCreate() {
  const uid   = `${__VU}_${__ITER}_${Date.now()}`
  const email = `burst_${uid.slice(-8)}@loadtest.com`
  const pass  = 'loadtest123'

  // Signup + immediate trade create
  const signup = http.post(
    `${API_BASE}/api/auth/signup`,
    JSON.stringify({ name: 'Burst User', email, password: pass }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  if (signup.status !== 201) return

  const token = JSON.parse(signup.body).token
  if (!token) return

  const res = http.post(
    `${API_BASE}/api/tradelog`,
    JSON.stringify({
      date:        '2025-04-01',
      symbol:      'BURST',
      position:    'LONG',
      quantity:    10,
      entry_price: 100,
    }),
    { headers: authHeaders(token) }
  )

  check(res, {
    'burst create 201': (r) => r.status === 201,
    'unique id':        (r) => {
      try { return !!JSON.parse(r.body).id } catch { return false }
    },
  })
  if (res.status !== 201) tradeCreateErrors.add(1)
}

// ── Scenario: Dashboard Load ───────────────────────────────────────────────────

export function dashboardLoad() {
  const uid   = `dash_${__VU}`
  const email = `${uid}@loadtest.com`
  const pass  = 'loadtest123'

  // Signup once per VU
  if (__ITER === 0) {
    http.post(
      `${API_BASE}/api/auth/signup`,
      JSON.stringify({ name: 'Dash VU', email, password: pass }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const token = getAuthToken(email, pass)
  if (!token) { sleep(2); return }

  const headers = authHeaders(token)

  group('dashboard_requests', () => {
    // Typical dashboard makes several parallel requests
    const [trades, dash, portfolio] = http.batch([
      ['GET', `${API_BASE}/api/tradelog`,   null, { headers }],
      ['GET', `${API_BASE}/api/dashboard`,  null, { headers }],
      ['GET', `${API_BASE}/api/portfolio`,  null, { headers }],
    ])

    check(trades,    { 'tradelog 200':   (r) => r.status === 200 })
    check(dash,      { 'dashboard 200':  (r) => r.status === 200 || r.status === 404 })
    check(portfolio, { 'portfolio 200':  (r) => r.status === 200 })
  })

  sleep(2)
}
