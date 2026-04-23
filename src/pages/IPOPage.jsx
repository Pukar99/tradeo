import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMeroshareDpList, getMeroshareAccounts, addMeroshareAccount, deleteMeroshareAccount,
  getMeroshareIPOs, getMeroshareResults, applyMeroshareIPO, applyMeroshareIPOBulk,
  getMerosharePortfolio, cancelMeroshareIPO, getMeroshareAllotment,
} from '../api'

const fmt = (n) => n != null ? Number(n).toLocaleString() : '—'

function StatusBadge({ status }) {
  const map = {
    SUCCESS:  'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
    APPROVED: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
    PENDING:  'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
    FAILED:   'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800/50',
  }
  const cls = map[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {status || '—'}
    </span>
  )
}

// ── Add Account Modal ─────────────────────────────────────────────────────────
function AddAccountModal({ dpList, onClose, onAdded }) {
  const [step,      setStep]      = useState(1) // 1=fill form, 2=verifying, 3=done
  const [form,      setForm]      = useState({ label: '', dp_id: '', username: '', password: '' })
  const [error,     setError]     = useState(null)
  const [showPass,  setShowPass]  = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.label || !form.dp_id || !form.username || !form.password)
      return setError('All fields are required')
    setStep(2)
    setError(null)
    try {
      const res = await addMeroshareAccount(form)
      onAdded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect account')
      setStep(1)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">Connect Meroshare Account</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Step {step} of 2 — {step === 1 ? 'Enter credentials' : 'Verifying with Meroshare…'}</p>
          </div>
          {step === 1 && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>}
        </div>

        {/* Step indicators */}
        <div className="px-5 pt-4 flex items-center gap-2">
          {['Enter Details', 'Verify & Save'].map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-blue-600 text-white' :
                'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>{step > i + 1 ? '✓' : i + 1}</div>
              <span className={`text-[10px] font-semibold ${step === i + 1 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
              {i === 0 && <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Label (who is this?)</label>
            <input type="text" placeholder="e.g. Self, Dad, Mom, Wife"
              value={form.label} onChange={e => set('label', e.target.value)} disabled={step === 2}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Depository Participant (Broker)</label>
            <select value={form.dp_id} onChange={e => set('dp_id', e.target.value)} disabled={step === 2}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Select your broker / DP…</option>
              {dpList.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Meroshare Username (BOID)</label>
            <input type="text" placeholder="e.g. 1301760000271197"
              value={form.username} onChange={e => set('username', e.target.value)} disabled={step === 2}
              autoComplete="off"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Meroshare Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)} disabled={step === 2}
                autoComplete="new-password"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 pr-10 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px]">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-0.5">AES-256 encrypted storage</p>
            <p className="text-[10px] text-blue-500">Credentials are encrypted on your private server. Used only to communicate with Meroshare on your behalf.</p>
          </div>

          {error && (
            <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={step === 2}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={step === 2}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {step === 2 && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {step === 2 ? 'Verifying with Meroshare…' : 'Connect Account →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ ipo, accounts, activeAccountId, onClose }) {
  const [step,       setStep]      = useState(1) // 1=select, 2=confirm, 3=result
  const [accountId,  setAccountId] = useState(activeAccountId || accounts[0]?.id || 'all')
  const [kitta,      setKitta]     = useState(10)
  const [applying,   setApplying]  = useState(false)
  const [results,    setResults]   = useState(null)
  const [error,      setError]     = useState(null)

  const selectedAccount = accounts.find(a => a.id === accountId)

  const handleApply = async () => {
    setApplying(true)
    setError(null)
    try {
      if (accountId === 'all') {
        const res = await applyMeroshareIPOBulk({ company_share_id: ipo.companyShareId, applied_kitta: kitta })
        setResults(res.data.results)
      } else {
        const res = await applyMeroshareIPO({ account_id: accountId, company_share_id: ipo.companyShareId, applied_kitta: kitta })
        setResults([{ label: selectedAccount?.label || 'Account', status: 'success', message: res.data.message }])
      }
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Application failed')
    } finally {
      setApplying(false)
    }
  }

  const alreadyApplied = ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">
              {step === 3 ? 'Application Result' : alreadyApplied ? 'Edit Application' : 'Apply for IPO'}
            </p>
            <p className="text-[10px] text-gray-400">{ipo.companyName} · {ipo.scrip}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Step 1 — Select account + kitta */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            {/* Account selector */}
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Apply With</p>
              <div className="space-y-1.5">
                {accounts.length > 1 && (
                  <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    accountId === 'all' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input type="radio" name="account" value="all" checked={accountId === 'all'} onChange={() => setAccountId('all')} className="accent-blue-600" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white">All Accounts (Bulk Apply)</p>
                      <p className="text-[9px] text-gray-400">{accounts.length} accounts — apply to all at once</p>
                    </div>
                  </label>
                )}
                {accounts.map(a => (
                  <label key={a.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    accountId === a.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input type="radio" name="account" value={a.id} checked={accountId === a.id} onChange={() => setAccountId(a.id)} className="accent-blue-600" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{a.label}</p>
                      <p className="text-[9px] text-gray-400">{a.username} · {a.dp_name}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Kitta */}
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Units (Kitta)</p>
              <input type="number" min={10} step={10} value={kitta}
                onChange={e => setKitta(Math.max(10, parseInt(e.target.value) || 10))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[13px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
              />
              <p className="text-[9px] text-gray-400 mt-1">Minimum 10 kitta per application</p>
            </div>

            <button onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700">
              Review & Confirm →
            </button>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && (
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2.5">
              <Row label="Company" value={ipo.companyName} />
              <Row label="Scrip" value={ipo.scrip} />
              <Row label="Type" value={ipo.shareTypeName} />
              <Row label="Close Date" value={ipo.issueCloseDate?.split(' ').slice(0,3).join(' ')} />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                <Row label="Account" value={accountId === 'all' ? `All ${accounts.length} accounts` : selectedAccount?.label} />
                <Row label="Kitta" value={kitta} bold />
              </div>
            </div>

            {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setStep(1); setError(null) }} disabled={applying}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                ← Back
              </button>
              <button onClick={handleApply} disabled={applying}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {applying && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {applying ? 'Submitting…' : 'Confirm Apply'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Result */}
        {step === 3 && results && (
          <div className="p-5 space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-3 rounded-xl border ${
                r.status === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
              }`}>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{r.label}</span>
                <span className={`text-[10px] font-semibold ${r.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {r.status === 'success' ? '✓ ' : '✗ '}{r.message || r.status}
                </span>
              </div>
            ))}
            <button onClick={onClose}
              className="w-full mt-2 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-semibold">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-[11px] text-gray-900 dark:text-white ${bold ? 'font-bold text-[14px]' : 'font-semibold'}`}>{value || '—'}</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function IPOPage() {
  const { user } = useAuth()
  const [activeTab,    setActiveTab]    = useState('ipos')
  const [accounts,     setAccounts]     = useState([])
  const [dpList,       setDpList]       = useState([])
  const [selectedAcc,  setSelectedAcc]  = useState(null)
  const [ipos,         setIpos]         = useState([])
  const [results,      setResults]      = useState([])
  const [portfolio,    setPortfolio]    = useState([])
  const [totalValue,   setTotalValue]   = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [applyIPO,     setApplyIPO]     = useState(null)
  const [deleting,     setDeleting]     = useState(null)
  const [cancelingId,  setCancelingId]  = useState(null)
  const [allotmentMap, setAllotmentMap] = useState({})
  const [checkingId,   setCheckingId]   = useState(null)

  // Cache: `${accId}:${tab}` → fetched data. Cleared when account is deleted.
  const tabCache = useRef({})

  useEffect(() => {
    getMeroshareDpList().then(r => setDpList(r.data)).catch(() => {})
    getMeroshareAccounts().then(r => {
      const list = r.data || []
      setAccounts(list)
      if (list.length > 0) setSelectedAcc(list[0].id)
    }).catch(() => {})
  }, [])

  const loadData = useCallback(async (accId, tab, force = false) => {
    if (!accId) return
    const cacheKey = `${accId}:${tab}`
    // Return cached data immediately — skip network request
    if (!force && tabCache.current[cacheKey]) {
      const cached = tabCache.current[cacheKey]
      if (tab === 'ipos')      { setIpos(cached); return }
      if (tab === 'results')   { setResults(cached.results); return }
      if (tab === 'portfolio') { setPortfolio(cached.holdings); setTotalValue(cached.totalValue); return }
    }
    setLoading(true)
    setError(null)
    try {
      if (tab === 'ipos') {
        const res = await getMeroshareIPOs(accId)
        const data = Array.isArray(res.data.ipos) ? res.data.ipos : []
        tabCache.current[cacheKey] = data
        setIpos(data)
      } else if (tab === 'results') {
        const res = await getMeroshareResults(accId)
        const data = Array.isArray(res.data.results) ? res.data.results : []
        tabCache.current[cacheKey] = { results: data }
        setResults(data)
      } else if (tab === 'portfolio') {
        const res = await getMerosharePortfolio(accId)
        const holdings = Array.isArray(res.data.holdings) ? res.data.holdings : []
        const totalValue = res.data.totalValue || null
        tabCache.current[cacheKey] = { holdings, totalValue }
        setPortfolio(holdings)
        setTotalValue(totalValue)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload when account or tab changes
  useEffect(() => {
    if (selectedAcc) loadData(selectedAcc, activeTab)
  }, [selectedAcc, activeTab, loadData])

  const handleSelectAccount = (id) => {
    setSelectedAcc(id)
    setIpos([]); setResults([]); setPortfolio([])
    setAllotmentMap({})
    setError(null)
  }

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Remove this Meroshare account?')) return
    setDeleting(id)
    try {
      await deleteMeroshareAccount(id)
      // Clear cached data for the deleted account
      Object.keys(tabCache.current).forEach(k => { if (k.startsWith(`${id}:`)) delete tabCache.current[k] })
      const updated = accounts.filter(x => x.id !== id)
      setAccounts(updated)
      if (selectedAcc === id) {
        const next = updated[0]?.id || null
        setSelectedAcc(next)
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove account')
    } finally {
      setDeleting(null)
    }
  }

  const handleCancelIPO = async (applicationId) => {
    if (!window.confirm('Cancel this IPO application? This cannot be undone.')) return
    setCancelingId(applicationId)
    try {
      await cancelMeroshareIPO({ account_id: selectedAcc, application_id: applicationId })
      setResults(r => r.filter(x => (x.applicantFormId || x.id) !== applicationId))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel')
    } finally {
      setCancelingId(null)
    }
  }


  const handleCheckAllotment = useCallback(async (formId) => {
    if (!formId) return
    setCheckingId(formId)
    try {
      const res = await getMeroshareAllotment(selectedAcc, formId)
      const data = res.data.allotment
      if (!data || Object.keys(data).length === 0) throw new Error('Result not published yet')
      setAllotmentMap(m => ({ ...m, [formId]: data }))
    } catch (err) {
      setAllotmentMap(m => ({ ...m, [formId]: { error: err.response?.data?.error || err.message || 'Failed' } }))
    } finally {
      setCheckingId(null)
    }
  }, [selectedAcc])

  if (!user) return null

  const activeAccount = accounts.find(a => a.id === selectedAcc)
  const hasAccounts   = accounts.length > 0

  return (
    <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Meroshare IPO</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Manage IPO applications across all your family accounts</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* No accounts */}
      {!hasAccounts && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">No accounts connected</p>
          <p className="text-[11px] text-gray-400 mb-5">Connect your Meroshare account to view open IPOs, past results, and holdings</p>
          {/* How it works */}
          <div className="flex items-start justify-center gap-0 mb-6 max-w-md mx-auto">
            {[
              { n: '1', label: 'Add Account', desc: 'Enter your Meroshare credentials' },
              { n: '2', label: 'Select Account', desc: 'Switch between family members' },
              { n: '3', label: 'Apply & Track', desc: 'Apply for IPOs, view results' },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-0 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{s.n}</div>
                  <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mt-2 text-center">{s.label}</p>
                  <p className="text-[9px] text-gray-400 text-center mt-0.5">{s.desc}</p>
                </div>
                {i < 2 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 mt-3.5 flex-shrink-0" />}
              </div>
            ))}
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700">
            Connect Your First Account
          </button>
        </div>
      )}

      {/* Main layout — accounts sidebar + content */}
      {hasAccounts && (
        <div className="flex gap-5 items-start">

          {/* ── Accounts Sidebar ── */}
          <div className="w-48 flex-shrink-0 space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-1 mb-2">Accounts</p>
            {accounts.map(a => (
              <div key={a.id}
                onClick={() => handleSelectAccount(a.id)}
                className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  selectedAcc === a.id
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                  selectedAcc === a.id ? 'bg-white/20 text-white dark:bg-black/20 dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                  {a.label.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate">{a.label}</p>
                  <p className={`text-[9px] truncate ${selectedAcc === a.id ? 'opacity-60' : 'text-gray-400'}`}>{a.dp_name || a.username}</p>
                </div>
                {/* Active dot */}
                {selectedAcc === a.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteAccount(a.id) }}
                  disabled={deleting === a.id}
                  className={`absolute right-2 top-1.5 opacity-0 group-hover:opacity-100 text-[10px] font-bold transition-opacity px-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 ${
                    selectedAcc === a.id ? 'text-white/60 hover:text-white' : 'text-red-400'
                  }`}
                >
                  {deleting === a.id ? '…' : '×'}
                </button>
              </div>
            ))}

            {/* Add another */}
            <button onClick={() => setShowAddModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-[10px] font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Account
            </button>
          </div>

          {/* ── Main Content ── */}
          <div className="flex-1 min-w-0">

            {/* Account header */}
            {activeAccount && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-[12px] font-bold">
                    {activeAccount.label.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white">{activeAccount.label}</p>
                    <p className="text-[10px] text-gray-400">{activeAccount.username} · {activeAccount.dp_name}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1.5 mb-4">
              {[
                { key: 'ipos',      label: 'Open IPOs',  icon: '📋' },
                { key: 'results',   label: 'My Results', icon: '📊' },
                { key: 'portfolio', label: 'Holdings',   icon: '💼' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    activeTab === tab.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
              <button onClick={() => loadData(selectedAcc, activeTab)}
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                title="Refresh">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Error */}
            {error && !loading && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-3 text-[11px] text-red-500 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => loadData(selectedAcc, activeTab)} className="text-red-400 hover:text-red-600 font-semibold text-[10px]">Retry</button>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
              </div>
            )}

            {/* ── Open IPOs ── */}
            {!loading && activeTab === 'ipos' && (
              <>
                {accounts.length > 1 && ipos.length > 0 && (
                  <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                      {accounts.length} accounts connected — use "All Accounts" in the apply modal to bulk apply
                    </p>
                  </div>
                )}
                {ipos.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                    <p className="text-[13px] font-semibold text-gray-400">No open IPOs at the moment</p>
                    <p className="text-[10px] text-gray-400 mt-1">Check back when a new IPO is open</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ipos.map((ipo, i) => {
                      const applied = ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE'
                      return (
                        <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{ipo.companyName}</p>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-800/50">
                                  {ipo.shareTypeName}
                                </span>
                                {applied && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-800/50">
                                    Already Applied
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3">
                                <span className="text-[10px] text-gray-400">Scrip: <span className="font-semibold text-gray-700 dark:text-gray-300">{ipo.scrip}</span></span>
                                {ipo.subGroup?.trim() && <span className="text-[10px] text-gray-400">{ipo.subGroup}</span>}
                                {ipo.issueOpenDate && <span className="text-[10px] text-gray-400">Open: <span className="font-semibold text-gray-700 dark:text-gray-300">{ipo.issueOpenDate.split(' ').slice(0,3).join(' ')}</span></span>}
                                {ipo.issueCloseDate && <span className="text-[10px] text-gray-400">Close: <span className="font-semibold text-gray-700 dark:text-gray-300">{ipo.issueCloseDate.split(' ').slice(0,3).join(' ')}</span></span>}
                              </div>
                            </div>
                            <button onClick={() => setApplyIPO(ipo)}
                              className={`px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors flex-shrink-0 ${
                                applied
                                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}>
                              {applied ? 'Edit Application' : 'Apply →'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Results ── */}
            {!loading && activeTab === 'results' && (
              <>
                {results.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                    <p className="text-[13px] font-semibold text-gray-400">No past applications for {activeAccount?.label}</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{results.length} applications</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className="text-left px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Company</th>
                            <th className="text-center px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Applied</th>
                            <th className="text-center px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Result</th>
                            <th className="text-left px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Remark</th>
                            <th className="px-4 py-2.5 w-28" />
                          </tr>
                        </thead>
                        <tbody>
                          {results.flatMap((r, i) => {
                            const appId      = r.applicantFormId || r.id
                            const status     = r.statusName || ''
                            const canCancel  = status === 'APPROVED' || status === 'BLOCKED_APPROVE'
                            const allotment  = appId ? allotmentMap[appId] : null
                            const isChecking = checkingId === appId

                            const rows = [
                              <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                <td className="px-4 py-3">
                                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{r.companyName}</p>
                                  <p className="text-[9px] text-gray-400">{r.scrip} · {r.shareTypeName}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {allotment && !allotment.error
                                    ? <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{allotment.appliedKitta} kitta</span>
                                    : <span className="text-[10px] text-gray-400">—</span>
                                  }
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {allotment && !allotment.error ? (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                      allotment.receivedKitta > 0
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800/50'
                                    }`}>
                                      {allotment.receivedKitta > 0 ? `✓ ${allotment.receivedKitta} kitta` : '✗ Not Allotted'}
                                    </span>
                                  ) : allotment?.error ? (
                                    <span className="text-[9px] text-red-400">{allotment.error}</span>
                                  ) : (
                                    <span className="text-[9px] text-gray-300 dark:text-gray-600">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {allotment && !allotment.error && (
                                    <span className="text-[9px] text-gray-400">{allotment.meroshareRemark || allotment.reasonOrRemark || ''}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {appId && (
                                      <button onClick={() => handleCheckAllotment(appId)} disabled={isChecking}
                                        className="text-[10px] font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-40 flex items-center gap-1">
                                        {isChecking && <span className="w-2.5 h-2.5 border-2 border-blue-400/40 border-t-blue-500 rounded-full animate-spin" />}
                                        {isChecking ? 'Checking…' : allotment && !allotment.error ? 'Refresh' : 'Check Result'}
                                      </button>
                                    )}
                                    {canCancel && appId && (
                                      <button onClick={() => handleCancelIPO(appId)} disabled={cancelingId === appId}
                                        className="text-[10px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-40">
                                        {cancelingId === appId ? '…' : 'Cancel'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ]
                            return rows
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Holdings ── */}
            {!loading && activeTab === 'portfolio' && (
              <>
                {portfolio.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                    <p className="text-[13px] font-semibold text-gray-400">No holdings for {activeAccount?.label}</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{portfolio.length} holdings · {activeAccount?.label}</p>
                      {totalValue && (
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400">Total Value</p>
                          <p className="text-[13px] font-bold text-gray-900 dark:text-white">Rs. {Number(totalValue).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className="text-left px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Scrip</th>
                            <th className="text-left px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Company</th>
                            <th className="text-right px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Qty</th>
                            <th className="text-right px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">LTP</th>
                            <th className="text-right px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.map((h, i) => (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="px-4 py-3 text-[11px] font-bold text-blue-600 dark:text-blue-400">{h.script}</td>
                              <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400 max-w-[180px] truncate">{h.scriptDesc}</td>
                              <td className="px-4 py-3 text-[11px] text-right font-semibold text-gray-900 dark:text-white">{fmt(h.currentBalance)}</td>
                              <td className="px-4 py-3 text-[11px] text-right text-gray-600 dark:text-gray-300">Rs.{fmt(parseFloat(h.lastTransactionPrice))}</td>
                              <td className="px-4 py-3 text-[11px] text-right font-semibold text-gray-900 dark:text-white">Rs.{fmt(h.valueOfLastTransPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddAccountModal dpList={dpList} onClose={() => setShowAddModal(false)}
          onAdded={acc => {
            setAccounts(a => [...a, acc])
            setSelectedAcc(acc.id)
          }}
        />
      )}
      {applyIPO && (
        <ApplyModal ipo={applyIPO} accounts={accounts} activeAccountId={selectedAcc}
          onClose={() => setApplyIPO(null)}
        />
      )}
    </div>
  )
}

export default IPOPage
