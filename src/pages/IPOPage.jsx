import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMeroshareDpList, getMeroshareAccounts, addMeroshareAccount, deleteMeroshareAccount,
  getMeroshareIPOs, getMeroshareResults, applyMeroshareIPO, applyMeroshareIPOBulk,
  getMerosharePortfolio,
} from '../api'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => n != null ? Number(n).toLocaleString() : '—'

function StatusBadge({ status }) {
  const map = {
    'ALLOTED':     'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
    'NOT ALLOTED': 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800/50',
    'PENDING':     'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
  }
  const cls = map[status?.toUpperCase()] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cls}`}>
      {status || '—'}
    </span>
  )
}

// ── Add Account Modal ─────────────────────────────────────────────────────────
function AddAccountModal({ dpList, onClose, onAdded }) {
  const [form, setForm]       = useState({ label: '', dp_id: '', username: '', password: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [showPass, setShowPass] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.label || !form.dp_id || !form.username || !form.password) {
      return setError('All fields are required')
    }
    setSaving(true)
    setError(null)
    try {
      const res = await addMeroshareAccount(form)
      onAdded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white">Connect Meroshare Account</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Label */}
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Label</label>
            <input
              type="text" placeholder="e.g. Self, Dad, Mom"
              value={form.label} onChange={e => set('label', e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* DP / Broker */}
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Depository Participant (Broker)</label>
            <select
              value={form.dp_id} onChange={e => set('dp_id', e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
            >
              <option value="">Select your broker / DP…</option>
              {dpList.map(dp => (
                <option key={dp.id} value={dp.id}>{dp.name}</option>
              ))}
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Meroshare Username</label>
            <input
              type="text" placeholder="Your BOID / username"
              value={form.username} onChange={e => set('username', e.target.value)}
              autoComplete="off"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Meroshare Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)}
                autoComplete="new-password"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 pr-10 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px]">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Security note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Your credentials are encrypted</p>
            <p className="text-[10px] text-blue-500 dark:text-blue-500">
              Stored with AES-256 encryption on your private server. Never shared. Used only to communicate with Meroshare on your behalf.
            </p>
          </div>

          {error && (
            <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Verifying & Saving…' : 'Connect Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ ipo, accounts, onClose, onSuccess }) {
  const [kitta,      setKitta]      = useState(10)
  const [accountId,  setAccountId]  = useState('all')
  const [applying,   setApplying]   = useState(false)
  const [error,      setError]      = useState(null)
  const [results,    setResults]    = useState(null)

  const handleApply = async () => {
    setApplying(true)
    setError(null)
    try {
      if (accountId === 'all') {
        const res = await applyMeroshareIPOBulk({
          company_share_id: ipo.companyShareId,
          applied_kitta:    kitta,
        })
        setResults(res.data.results)
      } else {
        const res = await applyMeroshareIPO({
          account_id:       accountId,
          company_share_id: ipo.companyShareId,
          applied_kitta:    kitta,
        })
        setResults([{ label: accounts.find(a => a.id === accountId)?.label, status: 'success', message: res.data.message }])
      }
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Application failed')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">Apply for IPO</p>
            <p className="text-[10px] text-gray-400">{ipo.companyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">×</button>
        </div>

        {results ? (
          <div className="p-5 space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                r.status === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
              }`}>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{r.label}</span>
                <span className={`text-[10px] font-semibold ${r.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {r.status === 'success' ? '✓ ' : '✗ '}{r.message}
                </span>
              </div>
            ))}
            <button onClick={onClose}
              className="w-full mt-2 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {/* Account selector */}
            <div>
              <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Apply With</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none">
                <option value="all">All Accounts (Bulk Apply)</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.label} — {a.username}</option>)}
              </select>
            </div>

            {/* Kitta */}
            <div>
              <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Units (Kitta)</label>
              <input type="number" min={10} step={10}
                value={kitta} onChange={e => setKitta(parseInt(e.target.value))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
              />
              <p className="text-[9px] text-gray-400 mt-1">
                Price: Rs.{fmt(ipo.sharePrice)} · Total: Rs.{fmt((ipo.sharePrice || 0) * kitta)}
              </p>
            </div>

            {error && (
              <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleApply} disabled={applying}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50">
                {applying ? 'Applying…' : accountId === 'all' ? `Apply All (${accounts.length})` : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function IPOPage() {
  const { user } = useAuth()
  const [activeTab,    setActiveTab]    = useState('ipos')
  const [accounts,     setAccounts]     = useState([])
  const [dpList,       setDpList]       = useState([])
  const [ipos,         setIpos]         = useState([])
  const [results,      setResults]      = useState([])
  const [portfolio,    setPortfolio]    = useState([])
  const [selectedAcc,  setSelectedAcc]  = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [applyIPO,     setApplyIPO]     = useState(null)
  const [deleting,     setDeleting]     = useState(null)

  // Load accounts + DP list on mount
  useEffect(() => {
    getMeroshareDpList().then(r => setDpList(r.data)).catch(() => {})
    getMeroshareAccounts().then(r => setAccounts(r.data)).catch(() => {})
  }, [])

  const loadIPOs = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMeroshareIPOs(accountId)
      setIpos(res.data.ipos || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load IPOs')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadResults = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMeroshareResults(accountId)
      setResults(res.data.results || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPortfolio = useCallback(async (accountId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMerosharePortfolio(accountId)
      setPortfolio(res.data.holdings || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data when tab or selected account changes
  useEffect(() => {
    if (accounts.length === 0) return
    const accId = selectedAcc || accounts[0]?.id
    if (activeTab === 'ipos')      loadIPOs(accId)
    if (activeTab === 'results')   loadResults(accId)
    if (activeTab === 'portfolio') loadPortfolio(accId)
  }, [activeTab, selectedAcc, accounts, loadIPOs, loadResults, loadPortfolio])

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Remove this Meroshare account?')) return
    setDeleting(id)
    try {
      await deleteMeroshareAccount(id)
      setAccounts(a => a.filter(x => x.id !== id))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove account')
    } finally {
      setDeleting(null)
    }
  }

  if (!user) return null

  const hasAccounts = accounts.length > 0
  const activeAccount = accounts.find(a => a.id === selectedAcc) || accounts[0]

  return (
    <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Meroshare IPO</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Auto-apply for IPOs across all your family accounts</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Connect Account
        </button>
      </div>

      {/* No accounts state */}
      {!hasAccounts && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">No Meroshare accounts connected</p>
          <p className="text-[11px] text-gray-400 mb-4">Connect your Meroshare account to view open IPOs and apply automatically</p>
          <button onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700">
            Connect Your First Account
          </button>
        </div>
      )}

      {hasAccounts && (
        <>
          {/* Connected Accounts strip */}
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Accounts:</span>
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAcc(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  (selectedAcc === a.id || (!selectedAcc && a.id === accounts[0]?.id))
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {a.label}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteAccount(a.id) }}
                  disabled={deleting === a.id}
                  className="ml-1 opacity-40 hover:opacity-100 text-red-400 text-[10px] leading-none"
                >
                  {deleting === a.id ? '…' : '×'}
                </button>
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 mb-5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { key: 'ipos',      label: 'Open IPOs' },
              { key: 'results',   label: 'My Results' },
              { key: 'portfolio', label: 'Holdings' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-3 text-[11px] text-red-500">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          )}

          {/* ── Open IPOs tab ── */}
          {!loading && activeTab === 'ipos' && (
            <>
              {ipos.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                  <p className="text-[12px] text-gray-400">No open IPOs at the moment</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Bulk apply bar */}
                  {ipos.length > 0 && accounts.length > 1 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        {accounts.length} accounts connected — apply to all at once
                      </p>
                    </div>
                  )}

                  {ipos.map((ipo, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{ipo.companyName}</p>
                          <div className="flex flex-wrap gap-3 mt-1">
                            <span className="text-[10px] text-gray-400">
                              Price: <span className="font-semibold text-gray-600 dark:text-gray-300">Rs.{fmt(ipo.sharePrice)}</span>
                            </span>
                            {ipo.openDate && (
                              <span className="text-[10px] text-gray-400">
                                Open: <span className="font-semibold text-gray-600 dark:text-gray-300">{ipo.openDate}</span>
                              </span>
                            )}
                            {ipo.closeDate && (
                              <span className="text-[10px] text-gray-400">
                                Close: <span className="font-semibold text-gray-600 dark:text-gray-300">{ipo.closeDate}</span>
                              </span>
                            )}
                            {ipo.minUnit && (
                              <span className="text-[10px] text-gray-400">
                                Min: <span className="font-semibold text-gray-600 dark:text-gray-300">{ipo.minUnit} kitta</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setApplyIPO(ipo)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors flex-shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Results tab ── */}
          {!loading && activeTab === 'results' && (
            <>
              {results.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                  <p className="text-[12px] text-gray-400">No past IPO applications found</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Company</th>
                          <th className="text-right px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Applied</th>
                          <th className="text-right px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Allotted</th>
                          <th className="text-center px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Status</th>
                          <th className="text-right px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-4 py-3 text-[11px] font-semibold text-gray-900 dark:text-white">{r.companyName || r.company || '—'}</td>
                            <td className="px-4 py-3 text-[11px] text-right text-gray-600 dark:text-gray-300">{fmt(r.appliedKitta)}</td>
                            <td className="px-4 py-3 text-[11px] text-right text-gray-600 dark:text-gray-300">{fmt(r.allottedKitta)}</td>
                            <td className="px-4 py-3 text-center"><StatusBadge status={r.statusName || r.status} /></td>
                            <td className="px-4 py-3 text-[10px] text-right text-gray-400">{r.appliedDate || r.date || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Portfolio tab ── */}
          {!loading && activeTab === 'portfolio' && (
            <>
              {portfolio.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                  <p className="text-[12px] text-gray-400">No holdings found for {activeAccount?.label}</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Symbol</th>
                          <th className="text-left px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Company</th>
                          <th className="text-right px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Balance</th>
                          <th className="text-right px-4 py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.map((h, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-4 py-3 text-[11px] font-bold text-blue-600 dark:text-blue-400">{h.scrip || h.symbol || '—'}</td>
                            <td className="px-4 py-3 text-[11px] text-gray-700 dark:text-gray-300">{h.currentBalance != null ? h.companyName || '—' : '—'}</td>
                            <td className="px-4 py-3 text-[11px] text-right font-semibold text-gray-900 dark:text-white">{fmt(h.currentBalance)}</td>
                            <td className="px-4 py-3 text-[11px] text-right text-gray-600 dark:text-gray-300">{fmt(h.remainingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddAccountModal
          dpList={dpList}
          onClose={() => setShowAddModal(false)}
          onAdded={(acc) => setAccounts(a => [...a, acc])}
        />
      )}
      {applyIPO && (
        <ApplyModal
          ipo={applyIPO}
          accounts={accounts}
          onClose={() => setApplyIPO(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}

export default IPOPage
