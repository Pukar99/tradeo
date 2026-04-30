import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMeroshareDpList, getMeroshareAccounts, addMeroshareAccount, deleteMeroshareAccount,
  getMeroshareIPOs, getMeroshareResults, applyMeroshareIPO,
  getMerosharePortfolio, cancelMeroshareIPO, getMeroshareAllotment,
  getMeroshareBanks, getMeroshareDisclaimer, updateMeroshareAccount,
} from '../api'

const fmt = (n) => n != null ? Number(n).toLocaleString() : '—'

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-[11px] text-gray-900 dark:text-white ${bold ? 'font-bold text-[14px]' : 'font-semibold'} text-right max-w-[60%] truncate`}>{value || '—'}</span>
    </div>
  )
}

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

// ── Add Account Modal — 3-step wizard ────────────────────────────────────────
// Step 1: Credentials → verify with Meroshare
// Step 2: ASBA bank selection (fetched live)
// Step 3: Auto-apply + PIN
function AddAccountModal({ dpList, onClose, onAdded }) {
  const [step,          setStep]         = useState(1)
  const [creds,         setCreds]        = useState({ label: '', dp_id: '', username: '', password: '' })
  const [showPass,      setShowPass]     = useState(false)
  const [tempId,        setTempId]       = useState(null)  // DB row id from step 1
  const [banks,         setBanks]        = useState([])
  const [bankId,        setBankId]       = useState('')
  const [bankName,      setBankName]     = useState('')
  const [accountNumber, setAccountNumber]= useState('')
  const [accountBranchId, setAccountBranchId] = useState('')
  const [accountTypeId, setAccountTypeId] = useState(1)
  const [kitta,         setKitta]        = useState(10)
  const [crnNumber,     setCrnNumber]    = useState('')
  const [autoApply,     setAutoApply]    = useState(false)
  const [pin,           setPin]          = useState('')
  const [showPin,       setShowPin]      = useState(false)
  const [busy,          setBusy]         = useState(false)
  const [error,         setError]        = useState(null)
  const setCred = (k, v) => setCreds(f => ({ ...f, [k]: v }))

  const STEPS = ['Credentials', 'ASBA Bank', 'Auto-apply']
  // step 1=creds, 2=asba, 3=auto-apply — maps directly to visible step
  const visStep = step

  // Step 1: verify credentials → backend logs in, saves bare account, returns banks
  const handleVerify = async (e) => {
    e.preventDefault()
    if (!creds.label.trim() || !creds.dp_id || !creds.username.trim() || !creds.password)
      return setError('All fields are required')
    setBusy(true); setError(null)
    try {
      const res = await addMeroshareAccount({ ...creds })
      if (res.data.step === 'asba_setup') {
        setTempId(res.data.account_id)  // partial row already saved
        const bankList = res.data.banks || []
        setBanks(bankList)
        if (bankList.length > 0) {
          const first = bankList[0]
          setBankId(String(first.bankId))
          setBankName(first.displayName || first.bankName || '')
          setAccountNumber(first.accountNumber || '')
          setAccountBranchId(String(first.accountBranchId || first.bankId))
          setAccountTypeId(first.accountTypeId || 1)
        }
        setStep(2)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect. Check your credentials and try again.')
    } finally {
      setBusy(false)
    }
  }

  // Step 2: proceed to auto-apply
  const handleAsbaNext = () => {
    if (!bankId || !accountBranchId) return setError('Please select your ASBA bank account')
    setError(null); setStep(3)
  }

  // Step 3: save ASBA + auto-apply settings via PUT (no re-login)
  const handleSave = async () => {
    if (autoApply && !pin.trim()) return setError('Transaction PIN is required for auto-apply')
    setBusy(true); setError(null)
    try {
      const res = await updateMeroshareAccount(tempId, {
        bank_id: bankId, bank_name: bankName,
        account_branch_id: accountBranchId, account_number: accountNumber,
        account_type_id: accountTypeId,
        crn_number: crnNumber, default_kitta: kitta,
        auto_apply: autoApply,
        transaction_pin: autoApply ? pin : undefined,
      })
      onAdded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save account')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">Connect Meroshare Account</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {step === 1 ? 'Enter your Meroshare login credentials'
                : step === 2 ? 'Select your ASBA bank account'
                : 'Configure auto-apply settings'}
            </p>
          </div>
          {!busy && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>}
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex items-center flex-shrink-0">
          {STEPS.map((label, i) => {
            const idx = i + 1
            const done = visStep > idx
            const active = visStep === idx
            return (
              <div key={i} className="flex items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-colors ${
                  done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                :          'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>{done ? '✓' : idx}</div>
                <span className={`text-[9px] font-semibold ml-1.5 ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
                {i < 2 && <div className={`flex-1 h-px mx-2 transition-colors ${done ? 'bg-emerald-400' : 'bg-gray-100 dark:bg-gray-800'}`} />}
              </div>
            )
          })}
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── Step 1: Credentials ── */}
          {step === 1 && (
            <form onSubmit={handleVerify} className="p-5 space-y-3">
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Label <span className="text-gray-400 font-normal normal-case">(e.g. Self, Dad, Mom)</span></label>
                <input type="text" placeholder="Self" value={creds.label} onChange={e => setCred('label', e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Broker / DP</label>
                <select value={creds.dp_id} onChange={e => setCred('dp_id', e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                >
                  <option value="">Select your broker / DP…</option>
                  {dpList.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Meroshare Username (BOID)</label>
                <input type="text" placeholder="e.g. 1301760000271197" value={creds.username} onChange={e => setCred('username', e.target.value)} autoComplete="off"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={creds.password} onChange={e => setCred('password', e.target.value)} autoComplete="new-password"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">Credentials are AES-256 encrypted — never stored in plain text</p>
              </div>
              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {busy && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {busy ? 'Verifying…' : 'Next →'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: ASBA Bank ── */}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Select the bank account you use for ASBA IPO applications. This is your linked bank in Meroshare.
              </p>
              {banks.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-4 text-center">
                  <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 mb-1">No ASBA bank found</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-300">Please link a bank in your Meroshare account first, then try again.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {banks.map((b, i) => {
                    const key = `${b.bankId}-${b.accountBranchId}-${i}`
                    const selKey = `${bankId}-${accountBranchId}`
                    const thisKey = `${b.bankId}-${b.accountBranchId}`
                    const selected = selKey === thisKey
                    return (
                      <label key={key} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
                        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                        <input type="radio" name="bank" value={thisKey} checked={selected}
                          onChange={() => {
                            setBankId(String(b.bankId))
                            setBankName(b.displayName || b.bankName || '')
                            setAccountNumber(b.accountNumber || '')
                            setAccountBranchId(String(b.accountBranchId))
                            setAccountTypeId(b.accountTypeId || 1)
                          }}
                          className="accent-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{b.displayName || b.bankName}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{b.accountNumber || '—'}</p>
                        </div>
                        {selected && <svg className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Default Kitta</label>
                  <input type="number" min={10} step={10} value={kitta}
                    onChange={e => setKitta(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[13px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">CRN Number <span className="font-normal normal-case text-gray-300">(optional)</span></label>
                  <input type="text" placeholder="Optional" value={crnNumber} onChange={e => setCrnNumber(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep(1); setError(null) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  ← Back
                </button>
                <button onClick={handleAsbaNext} disabled={banks.length > 0 && (!bankId || !accountBranchId)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50">
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Auto-apply ── */}
          {step === 3 && (
            <div className="p-5 space-y-4">
              {/* Summary card */}
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2 border border-gray-100 dark:border-gray-700">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Account Summary</p>
                <Row label="Label" value={creds.label} />
                <Row label="Bank" value={bankName} />
                <Row label="Account No." value={accountNumber} />
                <Row label="Default Kitta" value={kitta} />
              </div>

              <label className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                autoApply ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
                <input type="checkbox" checked={autoApply} onChange={e => { setAutoApply(e.target.checked); if (!e.target.checked) setPin('') }} className="accent-emerald-600 mt-0.5 flex-shrink-0 w-4 h-4" />
                <div>
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-white">Enable Auto-apply</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Automatically apply for new IPOs every day at 11:05 AM NPT. Uses {kitta} kitta by default.
                    Will NOT retry on failure to protect your account.
                  </p>
                </div>
              </label>

              {autoApply && (
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Transaction PIN</label>
                  <div className="relative">
                    <input type={showPin ? 'text' : 'password'} placeholder="Your Meroshare transaction PIN"
                      value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest"
                    />
                    <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">
                      {showPin ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1.5">PIN is AES-256 encrypted. We never store or log it in plain text.</p>
                </div>
              )}

              {!autoApply && (
                <p className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
                  You can enable auto-apply later from account settings (gear icon).
                </p>
              )}

              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep(2); setError(null) }} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                  ← Back
                </button>
                <button onClick={handleSave} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {busy && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {busy ? 'Saving…' : 'Save Account'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Edit Account Modal — settings + optional ASBA setup ──────────────────────
function EditAccountModal({ account, onClose, onUpdated }) {
  const [tab,           setTab]          = useState(account.bank_id ? 'settings' : 'bank')
  const [banks,         setBanks]        = useState([])
  const [loadingBanks,  setLoadingBanks] = useState(false)
  const [bankId,        setBankId]       = useState(String(account.bank_id || ''))
  const [bankName,      setBankName]     = useState(account.bank_name || '')
  const [accountNumber, setAccountNumber]= useState(account.account_number || '')
  const [accountBranchId, setAccountBranchId] = useState(String(account.account_branch_id || ''))
  const [accountTypeId, setAccountTypeId] = useState(account.account_type_id || 1)
  const [kitta,         setKitta]        = useState(account.default_kitta || 10)
  const [crnNumber,     setCrnNumber]    = useState(account.crn_number || '')
  const [autoApply,     setAutoApply]    = useState(account.auto_apply || false)
  const [pin,           setPin]          = useState('')
  const [showPin,       setShowPin]      = useState(false)
  const [saving,        setSaving]       = useState(false)
  const [error,         setError]        = useState(null)

  useEffect(() => {
    if (tab !== 'bank' || banks.length > 0) return
    setLoadingBanks(true)
    getMeroshareBanks(account.id)
      .then(r => {
        const list = r.data?.banks || []
        setBanks(list)
        // Pre-select matching bank (by accountBranchId) or first if none set
        const existing = account.account_branch_id
          ? list.find(b => String(b.accountBranchId) === String(account.account_branch_id))
          : null
        const first = existing || list[0]
        if (first && !account.bank_id) {
          setBankId(String(first.bankId))
          setBankName(first.displayName || first.bankName || '')
          setAccountNumber(first.accountNumber || '')
          setAccountBranchId(String(first.accountBranchId))
          setAccountTypeId(first.accountTypeId || 1)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBanks(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleSave = async () => {
    if (autoApply && !pin.trim() && !account.encrypted_pin)
      return setError('PIN required to enable auto-apply')
    setSaving(true); setError(null)
    try {
      const payload = {
        auto_apply:    autoApply,
        default_kitta: kitta,
        crn_number:    crnNumber,
      }
      if (pin.trim()) payload.transaction_pin = pin.trim()
      if (bankId) {
        payload.bank_id           = bankId
        payload.bank_name         = bankName
        payload.account_branch_id = accountBranchId
        payload.account_number    = accountNumber
        payload.account_type_id   = accountTypeId
      }
      const res = await updateMeroshareAccount(account.id, payload)
      onUpdated(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  const hasBankSetup = !!(account.bank_id && account.account_number)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">Account Settings</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{account.label} · {account.dp_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
          <button onClick={() => setTab('settings')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${tab === 'settings' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            Settings
          </button>
          <button onClick={() => setTab('bank')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 ${tab === 'bank' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            ASBA Bank
            {!hasBankSetup && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Settings tab ── */}
          {tab === 'settings' && (
            <>
              {!hasBankSetup && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2.5">
                  <span className="text-amber-500 text-sm">⚠</span>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">ASBA bank not set up</p>
                    <button onClick={() => setTab('bank')} className="text-[10px] text-amber-600 dark:text-amber-300 underline">Set up bank →</button>
                  </div>
                </div>
              )}
              {hasBankSetup && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                  <Row label="Bank" value={account.bank_name || '—'} />
                  <Row label="Account No." value={account.account_number || '—'} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Default Kitta</label>
                  <input type="number" min={10} step={10} value={kitta}
                    onChange={e => setKitta(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">CRN Number</label>
                  <input type="text" placeholder="Optional" value={crnNumber} onChange={e => setCrnNumber(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
                autoApply ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
                <input type="checkbox" checked={autoApply} onChange={e => { setAutoApply(e.target.checked); if (!e.target.checked) setPin('') }} className="accent-emerald-600 mt-0.5 flex-shrink-0 w-4 h-4" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">Auto-apply</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Apply for new IPOs daily at 11:05 AM NPT</p>
                </div>
              </label>
              {autoApply && (
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                    Transaction PIN {account.auto_apply ? <span className="font-normal normal-case">(leave blank to keep existing)</span> : ''}
                  </label>
                  <div className="relative">
                    <input type={showPin ? 'text' : 'password'} placeholder={account.auto_apply ? '••••••••' : 'Enter Meroshare PIN'}
                      value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest"
                    />
                    <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">
                      {showPin ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ASBA Bank tab ── */}
          {tab === 'bank' && (
            <>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Your ASBA bank account linked in Meroshare. Required for IPO applications.
              </p>
              {loadingBanks ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : banks.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-4 text-center">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">No ASBA bank found</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Please link a bank in Meroshare first, then try again.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {banks.map((b, i) => {
                    const thisKey = `${b.bankId}-${b.accountBranchId}`
                    const selKey  = `${bankId}-${accountBranchId}`
                    const selected = selKey === thisKey
                    return (
                      <label key={`${thisKey}-${i}`} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
                        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                        <input type="radio" name="editbank" value={thisKey} checked={selected}
                          onChange={() => {
                            setBankId(String(b.bankId))
                            setBankName(b.displayName || b.bankName || '')
                            setAccountNumber(b.accountNumber || '')
                            setAccountBranchId(String(b.accountBranchId))
                            setAccountTypeId(b.accountTypeId || 1)
                          }}
                          className="accent-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{b.displayName || b.bankName}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{b.accountNumber || '—'}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ ipo, accounts, activeAccountId, onClose }) {
  const initAcc      = accounts.find(a => a.id === activeAccountId) || accounts[0]
  const [accountId,  setAccountId]  = useState(initAcc?.id || '')
  const [sharePrice, setSharePrice] = useState(null)
  const [minKitta,   setMinKitta]   = useState(10)
  const [maxKitta,   setMaxKitta]   = useState(null)
  const [multipleOf, setMultipleOf] = useState(10)
  const [kitta,      setKitta]      = useState(initAcc?.default_kitta || 10)
  const [crnNumber,  setCrnNumber]  = useState(initAcc?.crn_number || '')
  const [declared,   setDeclared]   = useState(false)
  const [pin,        setPin]        = useState('')
  const [showPin,    setShowPin]    = useState(false)
  const [applying,   setApplying]   = useState(false)
  const [error,      setError]      = useState(null)
  const [result,     setResult]     = useState(null)

  const selectedAccount = accounts.find(a => a.id === accountId)
  const amount          = sharePrice && kitta ? sharePrice * kitta : null
  const alreadyApplied  = ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE'
  const hasBank         = !!(selectedAccount?.bank_id && selectedAccount?.account_number)

  useEffect(() => {
    if (!accountId) return
    getMeroshareDisclaimer(accountId, ipo.companyShareId)
      .then(res => {
        const d = res.data
        setSharePrice(d.sharePrice ? Number(d.sharePrice) : null)
        setMinKitta(d.minKitta   || 10)
        setMaxKitta(d.maxKitta   || null)
        setMultipleOf(d.multipleOf || 10)
      })
      .catch(() => {})
  }, [accountId, ipo.companyShareId])

  useEffect(() => {
    if (!selectedAccount) return
    setKitta(selectedAccount.default_kitta || 10)
    setCrnNumber(selectedAccount.crn_number || '')
  }, [accountId])

  const handleApply = async () => {
    if (!hasBank)    { setError('No ASBA bank set up. Go to account settings (gear icon) and set up your bank first.'); return }
    if (!declared)   { setError('Please accept the declaration'); return }
    if (!pin.trim()) { setError('Transaction PIN is required'); return }
    setApplying(true); setError(null)
    try {
      const res = await applyMeroshareIPO({
        account_id:        accountId,
        company_share_id:  ipo.companyShareId,
        applied_kitta:     kitta,
        bank_id:           selectedAccount.bank_id,
        account_branch_id: selectedAccount.account_branch_id,
        account_number:    selectedAccount.account_number,
        account_type_id:   selectedAccount.account_type_id || 1,
        crn_number:        crnNumber.trim(),
        transaction_pin:   pin.trim(),
      })
      setResult({ success: true, message: res.data.message || 'Applied successfully' })
    } catch (err) {
      setError(err.response?.data?.error || 'Application failed. Please check your PIN and try again.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">
              {result ? 'Application Result' : alreadyApplied ? 'Edit Application' : 'Apply for IPO'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{ipo.companyName} · {ipo.scrip}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            <div className={`flex flex-col items-center gap-2 px-4 py-6 rounded-xl border ${
              result.success ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                             : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${result.success ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-red-100 dark:bg-red-800/40'}`}>
                {result.success ? '✓' : '✗'}
              </div>
              <span className={`text-[12px] font-semibold text-center ${result.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {result.message}
              </span>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-semibold hover:opacity-90">Done</button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="p-5 space-y-4">

              {/* Account selector */}
              {accounts.length > 1 && (
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Apply With</p>
                  <div className="space-y-1.5">
                    {accounts.map(a => (
                      <label key={a.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        accountId === a.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                        <input type="radio" name="account" value={a.id} checked={accountId === a.id} onChange={() => setAccountId(a.id)} className="accent-blue-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{a.label}</p>
                          <p className="text-[9px] text-gray-400 truncate">{a.bank_name || a.dp_name} {a.account_number ? `· ${a.account_number.slice(-6)}` : ''}</p>
                        </div>
                        {a.auto_apply && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex-shrink-0">AUTO</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank info — read-only */}
              {selectedAccount && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">ASBA Details</p>
                  {hasBank ? (
                    <div className="space-y-1.5">
                      <Row label="Bank" value={selectedAccount.bank_name} />
                      <Row label="Account No." value={selectedAccount.account_number} />
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      No ASBA bank linked. Set up bank in account settings first.
                    </p>
                  )}
                </div>
              )}

              {/* Kitta + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Applied Kitta</label>
                  <input type="number"
                    min={minKitta} max={maxKitta || undefined} step={multipleOf}
                    value={kitta}
                    onChange={e => {
                      const v = parseInt(e.target.value) || minKitta
                      const snapped = Math.round(v / multipleOf) * multipleOf
                      const clamped = Math.max(minKitta, maxKitta ? Math.min(snapped, maxKitta) : snapped)
                      setKitta(clamped)
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Amount (Rs.)</label>
                  <div className="w-full bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-500 dark:text-gray-400 select-none">
                    {amount != null ? Number(amount).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
              {sharePrice && (
                <p className="text-[9px] text-gray-400 -mt-2">
                  Rs.{Number(sharePrice).toLocaleString()}/share · Min {minKitta}{maxKitta ? ` · Max ${maxKitta}` : ''} · Multiple of {multipleOf}
                </p>
              )}

              {/* CRN */}
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">CRN Number <span className="font-normal normal-case">(optional)</span></label>
                <input type="text" placeholder="Leave blank if not required" value={crnNumber} onChange={e => setCrnNumber(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Declaration */}
              <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
                declared ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
                <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} className="accent-blue-600 mt-0.5 flex-shrink-0 w-4 h-4" />
                <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  I hereby declare that the information provided is true and I agree to the terms and conditions of this IPO application.
                </p>
              </label>

              {/* PIN */}
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Transaction PIN</label>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'} placeholder="Your Meroshare transaction PIN"
                    value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest"
                  />
                  <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">
                    {showPin ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}

              <button onClick={handleApply} disabled={applying || !declared || !pin.trim()}
                className="w-full py-3 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                {applying && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {applying ? 'Submitting…' : alreadyApplied ? 'Update Application' : 'Submit Application'}
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
  const [selectedAcc,  setSelectedAcc]  = useState(null)
  const [ipos,         setIpos]         = useState([])
  const [results,      setResults]      = useState([])
  const [portfolio,    setPortfolio]    = useState([])
  const [totalValue,   setTotalValue]   = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editAccount,  setEditAccount]  = useState(null)
  const [applyIPO,     setApplyIPO]     = useState(null)
  const [deleting,     setDeleting]     = useState(null)
  const [cancelingId,  setCancelingId]  = useState(null)
  const [allotmentMap, setAllotmentMap] = useState({})
  const [checkingId,   setCheckingId]   = useState(null)

  const tabCache = useRef({})

  useEffect(() => {
    getMeroshareDpList().then(r => setDpList(r.data || [])).catch(() => {})
    getMeroshareAccounts().then(r => {
      const list = r.data || []
      setAccounts(list)
      if (list.length > 0) setSelectedAcc(list[0].id)
    }).catch(() => {})
  }, [])

  const loadData = useCallback(async (accId, tab, force = false) => {
    if (!accId) return
    const cacheKey = `${accId}:${tab}`
    if (!force && tabCache.current[cacheKey]) {
      const cached = tabCache.current[cacheKey]
      if (tab === 'ipos')      { setIpos(cached); return }
      if (tab === 'results')   { setResults(cached.results); return }
      if (tab === 'portfolio') { setPortfolio(cached.holdings); setTotalValue(cached.totalValue); return }
    }
    setLoading(true); setError(null)
    try {
      if (tab === 'ipos') {
        const res  = await getMeroshareIPOs(accId)
        const data = Array.isArray(res.data.ipos) ? res.data.ipos : []
        tabCache.current[cacheKey] = data
        setIpos(data)
      } else if (tab === 'results') {
        const res  = await getMeroshareResults(accId)
        const data = Array.isArray(res.data.results) ? res.data.results : []
        tabCache.current[cacheKey] = { results: data }
        setResults(data)
      } else if (tab === 'portfolio') {
        const res      = await getMerosharePortfolio(accId)
        const holdings = Array.isArray(res.data.holdings) ? res.data.holdings : []
        const tv       = res.data.totalValue || null
        tabCache.current[cacheKey] = { holdings, totalValue: tv }
        setPortfolio(holdings)
        setTotalValue(tv)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedAcc) loadData(selectedAcc, activeTab)
  }, [selectedAcc, activeTab, loadData])

  const handleSelectAccount = (id) => {
    setSelectedAcc(id)
    setIpos([]); setResults([]); setPortfolio([])
    setAllotmentMap({}); setError(null)
  }

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Remove this Meroshare account? This cannot be undone.')) return
    setDeleting(id)
    try {
      await deleteMeroshareAccount(id)
      Object.keys(tabCache.current).forEach(k => { if (k.startsWith(`${id}:`)) delete tabCache.current[k] })
      const updated = accounts.filter(x => x.id !== id)
      setAccounts(updated)
      if (selectedAcc === id) setSelectedAcc(updated[0]?.id || null)
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
      const res  = await getMeroshareAllotment(selectedAcc, formId)
      const data = res.data.allotment
      if (!data || Object.keys(data).length === 0) throw new Error('Result not published yet')
      setAllotmentMap(m => ({ ...m, [formId]: data }))
    } catch (err) {
      setAllotmentMap(m => ({ ...m, [formId]: { error: err.response?.data?.error || err.message || 'Failed' } }))
    } finally {
      setCheckingId(null)
    }
  }, [selectedAcc])

  const handleAccountUpdated = (updated) => {
    setAccounts(list => list.map(a => a.id === updated.id ? updated : a))
  }

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
          <p className="text-[11px] text-gray-400 mb-6">Connect your Meroshare account to view open IPOs, past results, and holdings</p>
          <div className="flex items-start justify-center gap-0 mb-6 max-w-md mx-auto">
            {[
              { n: '1', label: 'Add Account', desc: 'Enter your Meroshare credentials' },
              { n: '2', label: 'ASBA Setup', desc: 'Link your bank account once' },
              { n: '3', label: 'Apply & Track', desc: 'One-click IPO applications' },
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
          <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700">
            Connect Your First Account
          </button>
        </div>
      )}

      {/* Main layout */}
      {hasAccounts && (
        <div className="flex gap-5 items-start">

          {/* ── Accounts Sidebar ── */}
          <div className="w-52 flex-shrink-0 space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-1 mb-2">Accounts</p>
            {accounts.map(a => {
              const noBankSetup = !a.bank_id || !a.account_number
              return (
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

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold truncate">{a.label}</p>
                      {a.auto_apply && (
                        <span className={`text-[7px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${
                          selectedAcc === a.id ? 'bg-white/20 text-white dark:bg-black/20 dark:text-emerald-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        }`}>AUTO</span>
                      )}
                    </div>
                    <p className={`text-[9px] truncate ${selectedAcc === a.id ? 'opacity-60' : 'text-gray-400'}`}>
                      {noBankSetup ? '⚠ Bank not set up' : (a.bank_name || a.dp_name)}
                    </p>
                  </div>

                  {/* Action buttons — shown on hover */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Settings */}
                    <button
                      onClick={e => { e.stopPropagation(); setEditAccount(a) }}
                      title="Account settings"
                      className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${selectedAcc === a.id ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteAccount(a.id) }}
                      disabled={deleting === a.id}
                      title="Remove account"
                      className={`p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 ${selectedAcc === a.id ? 'text-white/60 hover:text-white' : 'text-red-400 hover:text-red-600'} disabled:opacity-40`}
                    >
                      <span className="text-[11px] font-bold leading-none">{deleting === a.id ? '…' : '×'}</span>
                    </button>
                  </div>
                </div>
              )
            })}

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
                  <div className="w-8 h-8 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-[12px] font-bold flex-shrink-0">
                    {activeAccount.label.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white">{activeAccount.label}</p>
                      {activeAccount.auto_apply && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">AUTO-APPLY ON</span>
                      )}
                      {(!activeAccount.bank_id || !activeAccount.account_number) && (
                        <button onClick={() => setEditAccount(activeAccount)}
                          className="text-[9px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors">
                          ⚠ Setup ASBA →
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">{activeAccount.username} · {activeAccount.dp_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditAccount(activeAccount)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-[10px] font-semibold">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </span>
                </div>
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
              <button onClick={() => loadData(selectedAcc, activeTab, true)}
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" title="Refresh">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Error */}
            {error && !loading && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-3 text-[11px] text-red-500 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => loadData(selectedAcc, activeTab, true)} className="text-red-400 hover:text-red-600 font-semibold text-[10px]">Retry</button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
              </div>
            )}

            {/* ── Open IPOs ── */}
            {!loading && activeTab === 'ipos' && (
              <>
                {ipos.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                    <p className="text-[13px] font-semibold text-gray-400">No open IPOs at the moment</p>
                    <p className="text-[10px] text-gray-400 mt-1">Check back when a new IPO is open</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ipos.map((ipo, i) => {
                      const applied = ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE'
                      const noBankSetup = !activeAccount?.bank_id || !activeAccount?.account_number
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
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800/50">
                                    ✓ Applied
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
                            {noBankSetup ? (
                              <button onClick={() => setEditAccount(activeAccount)}
                                className="px-3.5 py-2 rounded-xl text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 flex-shrink-0">
                                Setup ASBA to Apply →
                              </button>
                            ) : (
                              <button onClick={() => setApplyIPO(ipo)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors flex-shrink-0 ${
                                  applied
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}>
                                {applied ? 'Edit →' : 'Apply →'}
                              </button>
                            )}
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
                      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{results.length} application{results.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className="text-left px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Company</th>
                            <th className="text-center px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Applied</th>
                            <th className="text-center px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Result</th>
                            <th className="text-left px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Remark</th>
                            <th className="px-4 py-2.5 w-32" />
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r, i) => {
                            const appId     = r.applicantFormId || r.id
                            const status    = r.statusName || ''
                            const canCancel = status === 'APPROVED' || status === 'BLOCKED_APPROVE'
                            const allotment = appId ? allotmentMap[appId] : null
                            const isChecking= checkingId === appId
                            return (
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
                            )
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

      {/* ── Modals ── */}
      {showAddModal && (
        <AddAccountModal dpList={dpList} onClose={() => setShowAddModal(false)}
          onAdded={acc => {
            setAccounts(a => [...a, acc])
            setSelectedAcc(acc.id)
            setShowAddModal(false)
          }}
        />
      )}
      {editAccount && (
        <EditAccountModal
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onUpdated={updated => { handleAccountUpdated(updated); setEditAccount(null) }}
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
