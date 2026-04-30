import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMeroshareDpList, getMeroshareAccounts, addMeroshareAccount, deleteMeroshareAccount,
  getMeroshareIPOs, getMeroshareResults, applyMeroshareIPO, applyMeroshareIPOBulk,
  getMerosharePortfolio, cancelMeroshareIPO, getMeroshareAllotment,
  getMeroshareBanks, getMeroshareDisclaimer, updateMeroshareAccount,
} from '../api'

const fmt = (n) => n != null ? Number(n).toLocaleString() : '—'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className="text-[11px] font-semibold text-gray-900 dark:text-white text-right max-w-[60%] truncate">{value || '—'}</span>
    </div>
  )
}

// ── Add Account Modal ─────────────────────────────────────────────────────────
function AddAccountModal({ dpList, onClose, onAdded }) {
  const [step,            setStep]           = useState(1)
  const [creds,           setCreds]          = useState({ label: '', dp_id: '', username: '', password: '' })
  const [showPass,        setShowPass]       = useState(false)
  const [tempId,          setTempId]         = useState(null)
  const [banks,           setBanks]          = useState([])
  const [bankId,          setBankId]         = useState('')
  const [bankName,        setBankName]       = useState('')
  const [bankAccountId,   setBankAccountId]  = useState(null)
  const [accountNumber,   setAccountNumber]  = useState('')
  const [accountBranchId, setAccountBranchId] = useState('')
  const [accountTypeId,   setAccountTypeId]  = useState(1)
  const [kitta,           setKitta]          = useState(10)
  const [crnNumber,       setCrnNumber]      = useState('')
  const [autoApply,       setAutoApply]      = useState(false)
  const [pin,             setPin]            = useState('')
  const [showPin,         setShowPin]        = useState(false)
  const [busy,            setBusy]           = useState(false)
  const [error,           setError]          = useState(null)
  const setCred = (k, v) => setCreds(f => ({ ...f, [k]: v }))

  const STEPS = ['Credentials', 'ASBA Bank', 'Auto-apply']

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!creds.label.trim() || !creds.dp_id || !creds.username.trim() || !creds.password)
      return setError('All fields are required')
    setBusy(true); setError(null)
    try {
      const res = await addMeroshareAccount({ ...creds })
      if (res.data.step === 'asba_setup') {
        setTempId(res.data.account_id)
        const list = res.data.banks || []
        setBanks(list)
        if (list.length > 0) {
          const f = list[0]
          setBankId(String(f.bankId)); setBankName(f.displayName || f.bankName || '')
          setBankAccountId(f.bankAccountId || null); setAccountNumber(f.accountNumber || '')
          setAccountBranchId(String(f.accountBranchId)); setAccountTypeId(f.accountTypeId || 1)
        }
        setStep(2)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect. Check your credentials.')
    } finally { setBusy(false) }
  }

  const handleAsbaNext = () => {
    if (!bankId || !accountBranchId) return setError('Please select your ASBA bank account')
    setError(null); setStep(3)
  }

  const handleSave = async () => {
    if (autoApply && !pin.trim()) return setError('Transaction PIN is required for auto-apply')
    setBusy(true); setError(null)
    try {
      const res = await updateMeroshareAccount(tempId, {
        bank_id: bankId, bank_name: bankName, bank_account_id: bankAccountId,
        account_branch_id: accountBranchId, account_number: accountNumber,
        account_type_id: accountTypeId, crn_number: crnNumber,
        default_kitta: kitta, auto_apply: autoApply,
        transaction_pin: autoApply ? pin : undefined,
      })
      onAdded(res.data); onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save account')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">Connect Meroshare Account</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {step === 1 ? 'Enter your Meroshare credentials' : step === 2 ? 'Select your ASBA bank account' : 'Configure auto-apply'}
            </p>
          </div>
          {!busy && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-7 h-7 flex items-center justify-center">×</button>}
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex items-center flex-shrink-0">
          {STEPS.map((label, i) => {
            const idx = i + 1; const done = step > idx; const active = step === idx
            return (
              <div key={i} className="flex items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-colors ${
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>{done ? '✓' : idx}</div>
                <span className={`text-[9px] font-semibold ml-1.5 ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
                {i < 2 && <div className={`flex-1 h-px mx-2 ${done ? 'bg-emerald-400' : 'bg-gray-100 dark:bg-gray-800'}`} />}
              </div>
            )
          })}
        </div>

        <div className="overflow-y-auto flex-1">

          {/* Step 1: Credentials */}
          {step === 1 && (
            <form onSubmit={handleVerify} className="p-5 space-y-3">
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Label</label>
                <input type="text" placeholder="e.g. Self, Dad, Mom" value={creds.label} onChange={e => setCred('label', e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Broker / DP</label>
                <select value={creds.dp_id} onChange={e => setCred('dp_id', e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500">
                  <option value="">Select your broker / DP…</option>
                  {dpList.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Meroshare Username</label>
                <input type="text" placeholder="Your Meroshare username" value={creds.username} onChange={e => setCred('username', e.target.value)} autoComplete="off"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={creds.password} onChange={e => setCred('password', e.target.value)} autoComplete="new-password"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPass ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-[9px] text-blue-600 dark:text-blue-300 leading-relaxed">
                  Your credentials are encrypted (AES-256) and stored securely. We never share them.
                </p>
              </div>
              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}
              <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {busy ? 'Verifying…' : 'Verify & Continue →'}
              </button>
            </form>
          )}

          {/* Step 2: ASBA Bank */}
          {step === 2 && (
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Select the ASBA bank account linked to your Meroshare account.</p>
              {banks.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-4 text-center">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">No ASBA bank found</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Please link a bank in Meroshare first, then try again.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {banks.map((b, i) => {
                    const key = `${b.bankId}-${b.accountBranchId}`
                    const sel = `${bankId}-${accountBranchId}`
                    return (
                      <label key={`${key}-${i}`} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
                        sel === key ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                        <input type="radio" name="bank" checked={sel === key} onChange={() => {
                          setBankId(String(b.bankId)); setBankName(b.displayName || b.bankName || '')
                          setBankAccountId(b.bankAccountId || null); setAccountNumber(b.accountNumber || '')
                          setAccountBranchId(String(b.accountBranchId)); setAccountTypeId(b.accountTypeId || 1)
                        }} className="accent-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{b.displayName || b.bankName}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{b.accountNumber || '—'}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">CRN Number <span className="font-normal normal-case">(from your bank passbook — leave blank if unsure)</span></label>
                <input type="text" placeholder="e.g. 123456789" value={crnNumber} onChange={e => setCrnNumber(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep(1); setError(null) }} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-40">← Back</button>
                <button onClick={handleAsbaNext} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60">Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3: Auto-apply */}
          {step === 3 && (
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                <Row label="Bank" value={bankName} />
                <Row label="Account No." value={accountNumber} />
                <Row label="CRN" value={crnNumber || '—'} />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Default Kitta</label>
                <input type="number" min={10} step={10} value={kitta} onChange={e => setKitta(parseInt(e.target.value) || 10)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${autoApply ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <input type="checkbox" checked={autoApply} onChange={e => setAutoApply(e.target.checked)} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">Enable Auto-apply</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Automatically apply for all open IPOs daily at 11 AM</p>
                </div>
              </label>
              {autoApply && (
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Transaction PIN</label>
                  <div className="relative">
                    <input type={showPin ? 'text' : 'password'} placeholder="Your Meroshare transaction PIN" value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest" />
                    <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
              )}
              {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep(2); setError(null) }} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-40">← Back</button>
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

// ── Edit Account Modal ────────────────────────────────────────────────────────
function EditAccountModal({ account, onClose, onUpdated }) {
  const [tab,             setTab]            = useState(account.bank_id ? 'settings' : 'bank')
  const [banks,           setBanks]          = useState([])
  const [loadingBanks,    setLoadingBanks]   = useState(false)
  const [bankId,          setBankId]         = useState(String(account.bank_id || ''))
  const [bankName,        setBankName]       = useState(account.bank_name || '')
  const [bankAccountId,   setBankAccountId]  = useState(account.bank_account_id || null)
  const [accountNumber,   setAccountNumber]  = useState(account.account_number || '')
  const [accountBranchId, setAccountBranchId] = useState(String(account.account_branch_id || ''))
  const [accountTypeId,   setAccountTypeId]  = useState(account.account_type_id || 1)
  const [crnNumber,       setCrnNumber]      = useState(account.crn_number || '')
  const [kitta,           setKitta]          = useState(account.default_kitta || 10)
  const [autoApply,       setAutoApply]      = useState(account.auto_apply || false)
  const [pin,             setPin]            = useState('')
  const [showPin,         setShowPin]        = useState(false)
  const [saving,          setSaving]         = useState(false)
  const [error,           setError]          = useState(null)

  useEffect(() => {
    if (tab !== 'bank' || banks.length > 0) return
    setLoadingBanks(true)
    getMeroshareBanks(account.id)
      .then(r => {
        const list = r.data?.banks || []
        setBanks(list)
        const existing = account.account_branch_id
          ? list.find(b => String(b.accountBranchId) === String(account.account_branch_id))
          : null
        const first = existing || list[0]
        if (first && !account.bank_id) {
          setBankId(String(first.bankId)); setBankName(first.displayName || first.bankName || '')
          setBankAccountId(first.bankAccountId || null); setAccountNumber(first.accountNumber || '')
          setAccountBranchId(String(first.accountBranchId)); setAccountTypeId(first.accountTypeId || 1)
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
      const payload = { auto_apply: autoApply, default_kitta: kitta, crn_number: crnNumber }
      if (pin.trim()) payload.transaction_pin = pin.trim()
      if (bankId) {
        payload.bank_id = bankId; payload.bank_name = bankName
        payload.bank_account_id = bankAccountId; payload.account_branch_id = accountBranchId
        payload.account_number = accountNumber; payload.account_type_id = accountTypeId
      }
      const res = await updateMeroshareAccount(account.id, payload)
      onUpdated(res.data); onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  const hasBankSetup = !!(account.bank_id && account.account_number)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col">

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">Account Settings</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{account.label} · {account.dp_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>

        <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
          {['settings', 'bank'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 ${
              tab === t ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}>
              {t === 'settings' ? 'Settings' : 'ASBA Bank'}
              {t === 'bank' && !hasBankSetup && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

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
                  <Row label="CRN" value={crnNumber || '—'} />
                </div>
              )}
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">CRN Number</label>
                <input type="text" placeholder="CRN from bank passbook" value={crnNumber} onChange={e => setCrnNumber(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Default Kitta</label>
                <input type="number" min={10} step={10} value={kitta} onChange={e => setKitta(parseInt(e.target.value) || 10)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${autoApply ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <input type="checkbox" checked={autoApply} onChange={e => setAutoApply(e.target.checked)} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">Auto-apply</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Apply for all open IPOs automatically every day</p>
                </div>
              </label>
              {autoApply && (
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                    Transaction PIN {account.auto_apply ? <span className="font-normal normal-case">(leave blank to keep existing)</span> : ''}
                  </label>
                  <div className="relative">
                    <input type={showPin ? 'text' : 'password'} placeholder={account.auto_apply ? '••••••••' : 'Enter PIN'}
                      value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest" />
                    <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'bank' && (
            <>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">ASBA bank account linked in Meroshare. Required for IPO applications.</p>
              {loadingBanks ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
              ) : banks.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-4 text-center">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">No ASBA bank found</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Please link a bank in Meroshare first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {banks.map((b, i) => {
                    const key = `${b.bankId}-${b.accountBranchId}`, sel = `${bankId}-${accountBranchId}`
                    return (
                      <label key={`${key}-${i}`} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${
                        sel === key ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}>
                        <input type="radio" name="editbank" checked={sel === key} onChange={() => {
                          setBankId(String(b.bankId)); setBankName(b.displayName || b.bankName || '')
                          setBankAccountId(b.bankAccountId || null); setAccountNumber(b.accountNumber || '')
                          setAccountBranchId(String(b.accountBranchId)); setAccountTypeId(b.accountTypeId || 1)
                        }} className="accent-blue-600 flex-shrink-0" />
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
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
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

// ── Apply Modal (single account) ──────────────────────────────────────────────
function ApplyModal({ ipo, accounts, activeAccountId, onClose, onApplied }) {
  const initAcc     = accounts.find(a => a.id === activeAccountId) || accounts[0]
  const [accountId, setAccountId] = useState(initAcc?.id || '')
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
  const hasBank         = !!(selectedAccount?.bank_id && selectedAccount?.account_number)
  const alreadyApplied  = ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE'
  const amount          = sharePrice && kitta ? sharePrice * kitta : null

  useEffect(() => {
    if (!accountId) return
    getMeroshareDisclaimer(accountId, ipo.companyShareId)
      .then(r => {
        const d = r.data
        setSharePrice(d.sharePrice ? Number(d.sharePrice) : null)
        setMinKitta(d.minKitta || 10); setMaxKitta(d.maxKitta || null); setMultipleOf(d.multipleOf || 10)
      }).catch(() => {})
  }, [accountId, ipo.companyShareId])

  useEffect(() => {
    if (!selectedAccount) return
    setKitta(selectedAccount.default_kitta || 10)
    setCrnNumber(selectedAccount.crn_number || '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const handleApply = async () => {
    if (!hasBank) { setError('No ASBA bank set up. Open account settings (gear icon) and set up your bank first.'); return }
    if (!declared) { setError('Please accept the declaration'); return }
    if (!pin.trim()) { setError('Transaction PIN is required'); return }
    setApplying(true); setError(null)
    try {
      const res = await applyMeroshareIPO({
        account_id: accountId, company_share_id: ipo.companyShareId, applied_kitta: kitta,
        bank_id: selectedAccount.bank_id, account_branch_id: selectedAccount.account_branch_id,
        account_number: selectedAccount.account_number, account_type_id: selectedAccount.account_type_id || 1,
        crn_number: crnNumber.trim(), transaction_pin: pin.trim(),
      })
      setResult({ success: true, message: res.data.message || 'Applied successfully' })
      onApplied?.(ipo.companyShareId, accountId)
    } catch (err) {
      setError(err.response?.data?.error || 'Application failed. Check your PIN and try again.')
    } finally { setApplying(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">{result ? 'Application Result' : alreadyApplied ? 'Edit Application' : 'Apply for IPO'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{ipo.companyName} · {ipo.scrip}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            <div className={`flex flex-col items-center gap-2 px-4 py-6 rounded-xl border ${
              result.success ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${result.success ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-red-100 dark:bg-red-800/40'}`}>
                {result.success ? '✓' : '✗'}
              </div>
              <span className={`text-[12px] font-semibold text-center ${result.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{result.message}</span>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-semibold hover:opacity-90">Done</button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

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
                        <p className="text-[9px] text-gray-400 truncate">{a.bank_name || a.dp_name}{a.account_number ? ` · ****${a.account_number.slice(-4)}` : ''}</p>
                      </div>
                      {a.auto_apply && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex-shrink-0">AUTO</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedAccount && !hasBank && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2.5 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                ⚠ No ASBA bank linked. Set up bank in account settings.
              </div>
            )}

            {selectedAccount && hasBank && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">ASBA Details</p>
                <Row label="Bank" value={selectedAccount.bank_name} />
                <Row label="Account" value={selectedAccount.account_number ? `****${selectedAccount.account_number.slice(-4)}` : '—'} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Kitta</label>
                <input type="number" min={minKitta} max={maxKitta || undefined} step={multipleOf} value={kitta}
                  onChange={e => {
                    const v = parseInt(e.target.value) || minKitta
                    const snapped = Math.round(v / multipleOf) * multipleOf
                    setKitta(Math.max(minKitta, maxKitta ? Math.min(snapped, maxKitta) : snapped))
                  }}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Amount (Rs.)</label>
                <div className="w-full bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-500 dark:text-gray-400">
                  {amount != null ? Number(amount).toLocaleString() : '—'}
                </div>
              </div>
            </div>
            {sharePrice && <p className="text-[9px] text-gray-400 -mt-2">Rs.{Number(sharePrice).toLocaleString()}/share · Min {minKitta}{maxKitta ? ` · Max ${maxKitta}` : ''} · Multiple of {multipleOf}</p>}

            <div>
              <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">CRN Number</label>
              <input type="text" placeholder="Leave blank if not required" value={crnNumber} onChange={e => setCrnNumber(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus:border-blue-500" />
            </div>

            <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${declared ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} className="accent-blue-600 mt-0.5 flex-shrink-0 w-4 h-4" />
              <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">I declare that the information provided is true and I agree to the terms of this IPO application.</p>
            </label>

            <div>
              <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Transaction PIN</label>
              <div className="relative">
                <input type={showPin ? 'text' : 'password'} placeholder="Your Meroshare transaction PIN"
                  value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-14 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest" />
                <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}

            <button onClick={handleApply} disabled={applying || !declared || !pin.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              {applying && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {applying ? 'Submitting…' : alreadyApplied ? 'Update Application' : 'Submit Application'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bulk Apply Modal ──────────────────────────────────────────────────────────
// Collects per-account PINs (for accounts without stored PIN) then applies to all
function BulkApplyModal({ ipo, accounts, onClose, onApplied }) {
  // Per-account PIN input (only for accounts without auto-apply PIN)
  const needsPin = accounts.filter(a => a.bank_id && a.account_branch_id && !a.auto_apply)
  const [pins,    setPins]    = useState({})
  const [kitta,   setKitta]   = useState(10)
  const [applying, setApplying] = useState(false)
  const [results, setResults] = useState(null)
  const [error,   setError]   = useState(null)

  const handleApply = async () => {
    setApplying(true); setError(null)
    try {
      const res = await applyMeroshareIPOBulk({
        company_share_id: ipo.companyShareId,
        applied_kitta:    kitta,
        transaction_pins: pins,
      })
      setResults(res.data.results || [])
      onApplied?.(ipo.companyShareId)
    } catch (err) {
      setError(err.response?.data?.error || 'Bulk apply failed')
    } finally { setApplying(false) }
  }

  const readyAccounts  = accounts.filter(a => a.bank_id && a.account_branch_id)
  const skippedAccounts = accounts.filter(a => !a.bank_id || !a.account_branch_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">
              {results ? 'Bulk Apply Results' : 'Apply for All Accounts'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{ipo.companyName} · {ipo.scrip}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {results ? (
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                r.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                : r.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
              }`}>
                <span className={`text-base flex-shrink-0 mt-0.5 ${r.status === 'success' ? 'text-emerald-500' : r.status === 'skipped' ? 'text-gray-400' : 'text-red-500'}`}>
                  {r.status === 'success' ? '✓' : r.status === 'skipped' ? '—' : '✗'}
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{r.label}</p>
                  <p className={`text-[10px] mt-0.5 ${r.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : r.status === 'skipped' ? 'text-gray-400' : 'text-red-500'}`}>{r.message}</p>
                </div>
              </div>
            ))}
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-semibold hover:opacity-90 mt-2">Done</button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            <div>
              <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Kitta per Account</label>
              <input type="number" min={10} step={10} value={kitta} onChange={e => setKitta(parseInt(e.target.value) || 10)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              <p className="text-[9px] text-gray-400 mt-1">Each account applies for this many kitta (overrides each account's default).</p>
            </div>

            {/* Accounts summary */}
            <div className="space-y-2">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{readyAccounts.length} Account{readyAccounts.length !== 1 ? 's' : ''} Ready</p>
              {readyAccounts.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <div className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {a.label.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{a.label}</p>
                      {a.auto_apply && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">AUTO PIN</span>}
                    </div>
                    <p className="text-[9px] text-gray-400">{a.bank_name} · ****{a.account_number?.slice(-4)}</p>
                  </div>
                  {/* PIN input for accounts without stored PIN */}
                  {!a.auto_apply && (
                    <input type="password" placeholder="PIN" maxLength={10}
                      value={pins[a.id] || ''} onChange={e => setPins(p => ({ ...p, [a.id]: e.target.value }))}
                      className="w-24 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-blue-500 tracking-widest text-center" />
                  )}
                </div>
              ))}
              {skippedAccounts.length > 0 && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400">
                  {skippedAccounts.map(a => a.label).join(', ')} {skippedAccounts.length === 1 ? 'has' : 'have'} no bank set up and will be skipped.
                </p>
              )}
            </div>

            {error && <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50">{error}</p>}

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl px-3 py-2">
              <p className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">Takes 4–9 seconds per account to avoid detection. Please wait.</p>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} disabled={applying} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
              <button onClick={handleApply} disabled={applying || readyAccounts.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {applying && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {applying ? 'Applying…' : `Apply for ${readyAccounts.length} Account${readyAccounts.length !== 1 ? 's' : ''}`}
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
  const [activeTab,     setActiveTab]     = useState('ipos')
  const [accounts,      setAccounts]      = useState([])
  const [dpList,        setDpList]        = useState([])
  const [selectedAcc,   setSelectedAcc]   = useState(null)
  const [ipos,          setIpos]          = useState([])
  const [results,       setResults]       = useState([])
  const [portfolio,     setPortfolio]     = useState([])
  const [totalValue,    setTotalValue]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [editAccount,   setEditAccount]   = useState(null)
  const [applyIPO,      setApplyIPO]      = useState(null)
  const [bulkApplyIPO,  setBulkApplyIPO]  = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [cancelingId,   setCancelingId]   = useState(null)
  const [allotmentMap,  setAllotmentMap]  = useState({})
  const [checkingId,    setCheckingId]    = useState(null)
  // Track which IPOs have been applied per account (companyShareId → Set<accountId>)
  const [appliedMap,    setAppliedMap]    = useState({})

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
    const key = `${accId}:${tab}`
    if (!force && tabCache.current[key]) {
      const c = tabCache.current[key]
      if (tab === 'ipos')      setIpos(c)
      if (tab === 'results')   setResults(c.results)
      if (tab === 'portfolio') { setPortfolio(c.holdings); setTotalValue(c.totalValue) }
      return
    }
    setLoading(true); setError(null)
    try {
      if (tab === 'ipos') {
        const res  = await getMeroshareIPOs(accId)
        const data = Array.isArray(res.data.ipos) ? res.data.ipos : []
        tabCache.current[key] = data
        setIpos(data)
        // Seed appliedMap from IPO status
        const applied = {}
        data.forEach(ipo => {
          if (ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE') {
            applied[ipo.companyShareId] = (applied[ipo.companyShareId] || new Set()).add(accId)
          }
        })
        setAppliedMap(m => ({ ...m, ...applied }))
      } else if (tab === 'results') {
        const res  = await getMeroshareResults(accId)
        const data = Array.isArray(res.data.results) ? res.data.results : []
        tabCache.current[key] = { results: data }
        setResults(data)
      } else if (tab === 'portfolio') {
        const res      = await getMerosharePortfolio(accId)
        const holdings = Array.isArray(res.data.holdings) ? res.data.holdings : []
        const tv       = res.data.totalValue || null
        tabCache.current[key] = { holdings, totalValue: tv }
        setPortfolio(holdings); setTotalValue(tv)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data')
    } finally { setLoading(false) }
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
    } finally { setDeleting(null) }
  }

  const handleCancelIPO = async (applicationId) => {
    if (!window.confirm('Cancel this IPO application? This cannot be undone.')) return
    setCancelingId(applicationId)
    try {
      await cancelMeroshareIPO({ account_id: selectedAcc, application_id: applicationId })
      setResults(r => r.filter(x => (x.applicantFormId || x.id) !== applicationId))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel')
    } finally { setCancelingId(null) }
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
    } finally { setCheckingId(null) }
  }, [selectedAcc])

  // Mark IPO as applied after successful single/bulk apply
  const handleApplied = useCallback((companyShareId, accountId) => {
    setAppliedMap(m => {
      const s = new Set(m[companyShareId] || [])
      if (accountId) s.add(accountId)
      else accounts.forEach(a => s.add(a.id))  // bulk — mark all
      return { ...m, [companyShareId]: s }
    })
    // Invalidate IPO cache for this account
    if (accountId) delete tabCache.current[`${accountId}:ipos`]
    else accounts.forEach(a => { delete tabCache.current[`${a.id}:ipos`] })
  }, [accounts])

  const handleAccountUpdated = (updated) => {
    setAccounts(list => list.map(a => a.id === updated.id ? updated : a))
  }

  if (!user) return null

  const activeAccount  = accounts.find(a => a.id === selectedAcc)
  const hasAccounts    = accounts.length > 0
  const hasMultipleAcc = accounts.length > 1

  return (
    <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Meroshare IPO</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Manage IPO applications across all your family accounts</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Account
        </button>
      </div>

      {/* Empty state */}
      {!hasAccounts && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <p className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">No accounts connected</p>
          <p className="text-[11px] text-gray-400 mb-6">Connect your Meroshare account to view open IPOs, results, and holdings</p>
          <div className="flex items-start justify-center gap-0 mb-6 max-w-md mx-auto">
            {[
              { n: '1', label: 'Add Account', desc: 'Enter Meroshare credentials' },
              { n: '2', label: 'ASBA Setup', desc: 'Link your bank once' },
              { n: '3', label: 'Apply & Track', desc: 'One-click applications' },
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

          {/* Accounts sidebar */}
          <div className="w-52 flex-shrink-0 space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-1 mb-2">Accounts</p>
            {accounts.map(a => {
              const noBankSetup = !a.bank_id || !a.account_number
              return (
                <div key={a.id} onClick={() => handleSelectAccount(a.id)}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    selectedAcc === a.id
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    selectedAcc === a.id ? 'bg-white/20 text-white dark:bg-black/20 dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{a.label.charAt(0).toUpperCase()}</div>
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
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); setEditAccount(a) }} title="Settings"
                      className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${selectedAcc === a.id ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteAccount(a.id) }} disabled={deleting === a.id} title="Remove"
                      className={`p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 ${selectedAcc === a.id ? 'text-white/60 hover:text-white' : 'text-red-400 hover:text-red-600'} disabled:opacity-40`}>
                      <span className="text-[11px] font-bold leading-none">{deleting === a.id ? '…' : '×'}</span>
                    </button>
                  </div>
                </div>
              )
            })}
            <button onClick={() => setShowAddModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-[10px] font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Add Account
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Account header bar */}
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
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Connected
                  </span>
                </div>
              </div>
            )}

            {/* Tabs + refresh */}
            <div className="flex items-center gap-1.5 mb-4">
              {[
                { key: 'ipos',      label: 'Open IPOs' },
                { key: 'results',   label: 'My Results' },
                { key: 'portfolio', label: 'Holdings' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    activeTab === tab.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>{tab.label}</button>
              ))}
              <button onClick={() => loadData(selectedAcc, activeTab, true)}
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" title="Refresh">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {error && !loading && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl px-4 py-3 text-[11px] text-red-500 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => loadData(selectedAcc, activeTab, true)} className="text-red-400 hover:text-red-600 font-semibold text-[10px]">Retry</button>
              </div>
            )}

            {loading && (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            )}

            {/* ── Open IPOs ── */}
            {!loading && activeTab === 'ipos' && (
              <>
                {ipos.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                    <p className="text-[13px] font-semibold text-gray-400">No open IPOs at the moment</p>
                    <p className="text-[10px] text-gray-400 mt-1">Check back when a new IPO opens</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ipos.map((ipo, i) => {
                      const noBankSetup  = !activeAccount?.bank_id || !activeAccount?.account_number
                      const thisApplied  = appliedMap[ipo.companyShareId]
                      const appliedHere  = thisApplied?.has(selectedAcc)
                      const appliedAll   = hasMultipleAcc && accounts.every(a => thisApplied?.has(a.id))

                      return (
                        <div key={i} className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 transition-colors ${
                          appliedHere ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-gray-100 dark:border-gray-800'
                        }`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{ipo.companyName}</p>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-800/50">
                                  {ipo.shareTypeName}
                                </span>
                                {appliedHere && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800/50">
                                    ✓ Applied
                                  </span>
                                )}
                                {appliedAll && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50">
                                    ✓ All Applied
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

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Bulk apply button — only when multiple accounts exist */}
                              {hasMultipleAcc && !noBankSetup && (
                                <button onClick={() => setBulkApplyIPO(ipo)}
                                  className={`px-3.5 py-2 rounded-xl text-[10px] font-semibold transition-colors border ${
                                    appliedAll
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                                      : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                  }`}>
                                  {appliedAll ? '✓ All Applied' : `Apply All (${accounts.length})`}
                                </button>
                              )}
                              {/* Single apply */}
                              {noBankSetup ? (
                                <button onClick={() => setEditAccount(activeAccount)}
                                  className="px-3.5 py-2 rounded-xl text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100">
                                  Setup ASBA →
                                </button>
                              ) : (
                                <button onClick={() => setApplyIPO(ipo)}
                                  className={`px-4 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                                    appliedHere
                                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}>
                                  {appliedHere ? 'Edit →' : 'Apply →'}
                                </button>
                              )}
                            </div>
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
                    <p className="text-[13px] font-semibold text-gray-400">No applications for {activeAccount?.label}</p>
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
                            const appId      = r.applicantFormId || r.id
                            const canCancel  = r.statusName === 'APPROVED' || r.statusName === 'BLOCKED_APPROVE'
                            const allotment  = appId ? allotmentMap[appId] : null
                            const isChecking = checkingId === appId
                            return (
                              <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                <td className="px-4 py-3">
                                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{r.companyName}</p>
                                  <p className="text-[9px] text-gray-400">{r.scrip} · {r.shareTypeName}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {allotment && !allotment.error
                                    ? <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{allotment.appliedKitta} kitta</span>
                                    : <span className="text-[10px] text-gray-400">—</span>}
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
          onAdded={acc => { setAccounts(a => [...a, acc]); setSelectedAcc(acc.id); setShowAddModal(false) }} />
      )}
      {editAccount && (
        <EditAccountModal account={editAccount}
          onClose={() => setEditAccount(null)}
          onUpdated={updated => { handleAccountUpdated(updated); setEditAccount(null) }} />
      )}
      {applyIPO && (
        <ApplyModal ipo={applyIPO} accounts={accounts} activeAccountId={selectedAcc}
          onClose={() => setApplyIPO(null)}
          onApplied={(csid, accId) => { handleApplied(csid, accId); setApplyIPO(null) }} />
      )}
      {bulkApplyIPO && (
        <BulkApplyModal ipo={bulkApplyIPO} accounts={accounts}
          onClose={() => setBulkApplyIPO(null)}
          onApplied={(csid) => { handleApplied(csid, null); setBulkApplyIPO(null) }} />
      )}
    </div>
  )
}

export default IPOPage
