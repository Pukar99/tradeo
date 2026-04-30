import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMeroshareDpList, getMeroshareAccounts, addMeroshareAccount, deleteMeroshareAccount,
  getMeroshareIPOs, getMeroshareResults, applyMeroshareIPO, applyMeroshareIPOBulk,
  getMerosharePortfolio, cancelMeroshareIPO, getMeroshareAllotment,
  getMeroshareBanks, getMeroshareDisclaimer, updateMeroshareAccount,
  toggleMeroshareAutoApply, runMeroshareAutoApply,
} from '../api'

const fmt = (n) => n != null ? Number(n).toLocaleString() : '—'

// Days remaining from Meroshare date — handles "2024-05-12 00:00:00" and "May 5, 2026 00:00:00"
function daysLeft(dateStr) {
  if (!dateStr) return null
  const close = new Date(dateStr)
  if (isNaN(close.getTime())) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((close - today) / 86400000)
}

// Format Meroshare date to "Apr 29, 2026" regardless of input format
function fmtIpoDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr.split(' ')[0]
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className="text-[11px] font-semibold text-gray-900 dark:text-white text-right max-w-[60%] truncate font-mono">{value || '—'}</span>
    </div>
  )
}

// ── Inline Confirm ────────────────────────────────────────────────────────────
function InlineConfirm({ label, onConfirm, onCancel, danger = true, disabled = false }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return (
    <span className="flex items-center gap-1">
      <span className="text-[9px] text-gray-500 dark:text-gray-400">Sure?</span>
      <button onClick={() => { setConfirming(false); onConfirm() }}
        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-blue-600 hover:bg-blue-50'}`}>
        Yes
      </button>
      <button onClick={() => setConfirming(false)} className="text-[9px] font-semibold text-gray-400 hover:text-gray-600 px-1">No</button>
    </span>
  )
  return (
    <button onClick={() => setConfirming(true)} disabled={disabled}
      className={`text-[10px] font-semibold disabled:opacity-40 ${danger ? 'text-red-500 hover:text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
      {label}
    </button>
  )
}

// ── Field Label ───────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{children}</label>
}

// ── Input ─────────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-[12px] text-gray-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus:border-blue-500 transition-colors"

// ── Error Box ─────────────────────────────────────────────────────────────────
function ErrorBox({ children }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-r-xl px-3 py-2">
      <p className="text-[11px] text-red-600 dark:text-red-400">{children}</p>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 3 }) {
  return <span className={`w-${size} h-${size} border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0`} />
}

// ── Add Account Modal ─────────────────────────────────────────────────────────
// Phase 1: enter creds → verify → get banks. Phase 2: pick bank + configure all at once.
function AddAccountModal({ dpList, onClose, onAdded }) {
  const [phase,           setPhase]          = useState('creds')   // 'creds' | 'setup'
  const [label,           setLabel]          = useState('')
  const [dpId,            setDpId]           = useState('')
  const [username,        setUsername]       = useState('')
  const [password,        setPassword]       = useState('')
  const [showPass,        setShowPass]       = useState(false)
  const [tempId,          setTempId]         = useState(null)
  const [banks,           setBanks]          = useState([])
  const [bankId,          setBankId]         = useState('')
  const [bankName,        setBankName]       = useState('')
  const [bankAccountId,   setBankAccountId]  = useState(null)
  const [accountNumber,   setAccountNumber]  = useState('')
  const [accountBranchId, setAccountBranchId] = useState('')
  const [accountTypeId,   setAccountTypeId]  = useState(1)
  const [crnNumber,       setCrnNumber]      = useState('')
  const [kitta,           setKitta]          = useState(10)
  const [savePin,         setSavePin]        = useState(false)
  const [pin,             setPin]            = useState('')
  const [showPin,         setShowPin]        = useState(false)
  const [busy,            setBusy]           = useState(false)
  const [error,           setError]          = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !busy) handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = async () => {
    if (tempId) await deleteMeroshareAccount(tempId).catch(() => {})
    onClose()
  }

  // Phase 1: verify credentials, get bank list
  const handleVerify = async (e) => {
    e.preventDefault()
    if (!label.trim() || !dpId || !username.trim() || !password)
      return setError('All fields are required')
    setBusy(true); setError(null)
    try {
      const res = await addMeroshareAccount({ label: label.trim(), dp_id: dpId, username: username.trim(), password })
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
        setPhase('setup')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect. Check your credentials.')
    } finally { setBusy(false) }
  }

  // Phase 2: save everything (bank + kitta + optional PIN)
  const handleSave = async () => {
    if (!bankId || !accountBranchId) return setError('Select your ASBA bank account')
    if (savePin && !pin.trim()) return setError('Enter your transaction PIN to save it')
    setBusy(true); setError(null)
    try {
      const res = await updateMeroshareAccount(tempId, {
        bank_id: bankId, bank_name: bankName, bank_account_id: bankAccountId,
        account_branch_id: accountBranchId, account_number: accountNumber,
        account_type_id: accountTypeId, crn_number: crnNumber,
        default_kitta: kitta,
        auto_apply: savePin,
        transaction_pin: savePin ? pin.trim() : undefined,
      })
      setTempId(null)  // committed — don't delete on close
      onAdded(res.data); onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save account')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">
              {phase === 'creds' ? 'Connect Meroshare Account' : 'Finish Account Setup'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {phase === 'creds' ? 'Enter your Meroshare login credentials' : 'Select bank and configure apply settings'}
            </p>
          </div>
          {!busy && <button onClick={handleClose} title="Close" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none">×</button>}
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── Phase 1: Credentials ── */}
          {phase === 'creds' && (
            <form onSubmit={handleVerify} className="p-5 space-y-3">
              <div><FieldLabel>Account Label</FieldLabel>
                <input type="text" placeholder="e.g. Self, Dad, Mom" value={label} onChange={e => setLabel(e.target.value)} className={inputCls} />
              </div>
              <div><FieldLabel>Broker / DP</FieldLabel>
                <select value={dpId} onChange={e => setDpId(e.target.value)} className={inputCls}>
                  <option value="">Select your broker / DP…</option>
                  {dpList.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                </select>
              </div>
              <div><FieldLabel>Meroshare Username</FieldLabel>
                <input type="text" placeholder="Your Meroshare username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" className={inputCls} />
              </div>
              <div><FieldLabel>Password</FieldLabel>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={inputCls + ' pr-14'} />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPass ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-[9px] text-blue-600 dark:text-blue-300 leading-relaxed">Credentials are AES-256 encrypted. Never stored in plaintext.</p>
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {busy && <Spinner />}{busy ? 'Verifying credentials…' : 'Verify & Continue →'}
              </button>
            </form>
          )}

          {/* ── Phase 2: Bank + Config ── */}
          {phase === 'setup' && (
            <div className="p-5 space-y-4">
              {/* ASBA Bank */}
              <div>
                <FieldLabel>ASBA Bank Account</FieldLabel>
                <p className="text-[10px] text-gray-400 mb-2">Banks linked to your Meroshare profile. Select one for IPO applications.</p>
                {banks.length === 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-4 text-center">
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">No ASBA bank found</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Link a bank in Meroshare first, then add this account again.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {banks.map((b, i) => {
                      const key = `${b.bankId}-${b.accountBranchId}`, sel = `${bankId}-${accountBranchId}`
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
              </div>

              {/* CRN + Kitta */}
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>CRN Number</FieldLabel>
                  <input type="text" placeholder="From passbook" value={crnNumber} onChange={e => setCrnNumber(e.target.value)} className={inputCls} />
                </div>
                <div><FieldLabel>Default Kitta</FieldLabel>
                  <input type="number" min={10} step={10} value={kitta} onChange={e => setKitta(parseInt(e.target.value) || 10)} className={inputCls} />
                </div>
              </div>

              {/* Save PIN for 1-click apply */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${savePin ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <input type="checkbox" checked={savePin} onChange={e => setSavePin(e.target.checked)} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-900 dark:text-white">Save PIN for 1-click apply</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Apply without entering PIN every time. Also enables auto-apply at 11 AM.</p>
                  </div>
                </label>
                {savePin && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <FieldLabel>Transaction PIN</FieldLabel>
                    <div className="relative">
                      <input type={showPin ? 'text' : 'password'} placeholder="Your Meroshare PIN" value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                        className={inputCls + ' pr-14 font-mono tracking-widest'} />
                      <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>
                )}
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button onClick={handleSave} disabled={busy || banks.length === 0} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {busy && <Spinner />}{busy ? 'Saving…' : 'Save Account'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit Account Modal ────────────────────────────────────────────────────────
// Single scrollable form — all fields editable. Bank section loads from Meroshare.
function EditAccountModal({ account, dpList, onClose, onUpdated }) {
  const [label,           setLabel]          = useState(account.label || '')
  const [dpId,            setDpId]           = useState(String(account.dp_id || ''))
  const [username,        setUsername]       = useState(account.username || '')
  const [password,        setPassword]       = useState('')
  const [showPass,        setShowPass]       = useState(false)

  const [banks,           setBanks]          = useState([])
  const [loadingBanks,    setLoadingBanks]   = useState(false)
  const [bankError,       setBankError]      = useState(null)
  const [bankId,          setBankId]         = useState(String(account.bank_id || ''))
  const [bankName,        setBankName]       = useState(account.bank_name || '')
  const [bankAccountId,   setBankAccountId]  = useState(account.bank_account_id || null)
  const [accountNumber,   setAccountNumber]  = useState(account.account_number || '')
  const [accountBranchId, setAccountBranchId] = useState(String(account.account_branch_id || ''))
  const [accountTypeId,   setAccountTypeId]  = useState(account.account_type_id || 1)

  const [crnNumber,       setCrnNumber]      = useState(account.crn_number || '')
  const [kitta,           setKitta]          = useState(account.default_kitta || 10)
  const [savePin,         setSavePin]        = useState(account.auto_apply || false)
  const [pin,             setPin]            = useState('')
  const [showPin,         setShowPin]        = useState(false)
  const [saving,          setSaving]         = useState(false)
  const [error,           setError]          = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, saving])

  const fetchBanks = () => {
    setLoadingBanks(true); setBankError(null)
    getMeroshareBanks(account.id)
      .then(r => {
        const list = r.data?.banks || []
        setBanks(list)
        // Pre-select existing bank if still in list, otherwise first
        const existing = account.account_branch_id
          ? list.find(b => String(b.accountBranchId) === String(account.account_branch_id))
          : null
        const pick = existing || list[0]
        if (pick) {
          setBankId(String(pick.bankId)); setBankName(pick.displayName || pick.bankName || '')
          setBankAccountId(pick.bankAccountId || null); setAccountNumber(pick.accountNumber || '')
          setAccountBranchId(String(pick.accountBranchId)); setAccountTypeId(pick.accountTypeId || 1)
        }
      })
      .catch(err => setBankError(err.response?.data?.error || err.message || 'Failed to load banks'))
      .finally(() => setLoadingBanks(false))
  }

  useEffect(() => { fetchBanks() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (savePin && !pin.trim() && !account.auto_apply)
      return setError('Enter your transaction PIN to save it')
    setSaving(true); setError(null)
    try {
      const payload = {
        label: label.trim(), dp_id: dpId, username: username.trim(),
        crn_number: crnNumber, default_kitta: kitta,
        auto_apply: savePin,
        transaction_pin: savePin && pin.trim() ? pin.trim() : undefined,
      }
      if (password.trim()) payload.password = password.trim()
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">Edit Account</p>
            <p className="text-[10px] text-gray-400 mt-0.5">All fields are editable</p>
          </div>
          <button onClick={onClose} disabled={saving} title="Close" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Login Details ── */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Login Details</p>
            <div className="space-y-3">
              <div><FieldLabel>Label</FieldLabel>
                <input type="text" value={label} onChange={e => setLabel(e.target.value)} className={inputCls} />
              </div>
              <div><FieldLabel>Broker / DP</FieldLabel>
                <select value={dpId} onChange={e => setDpId(e.target.value)} className={inputCls}>
                  <option value="">Select broker / DP…</option>
                  {(dpList || []).map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                </select>
              </div>
              <div><FieldLabel>Meroshare Username</FieldLabel>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" className={inputCls} />
              </div>
              <div><FieldLabel>Password <span className="font-normal normal-case text-gray-400">(leave blank to keep existing)</span></FieldLabel>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={inputCls + ' pr-14'} />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPass ? 'Hide' : 'Show'}</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── ASBA Bank ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">ASBA Bank</p>
              <button onClick={fetchBanks} disabled={loadingBanks} className="text-[9px] font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-40 flex items-center gap-1 transition-colors">
                <svg className={`w-3 h-3 ${loadingBanks ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            {loadingBanks ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : bankError ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-[11px] font-semibold text-red-700 dark:text-red-400">Could not load banks</p>
                <p className="text-[10px] text-red-500 mt-1 break-words">{bankError}</p>
                <button onClick={fetchBanks} className="mt-1.5 text-[10px] font-semibold text-red-600 underline">Try again</button>
              </div>
            ) : banks.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">No ASBA bank found</p>
                <p className="text-[10px] text-amber-600 mt-1">Link a bank in Meroshare first, then tap Refresh.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {banks.map((b, i) => {
                  const key = `${b.bankId}-${b.accountBranchId}`, sel = `${bankId}-${accountBranchId}`
                  return (
                    <label key={`${key}-${i}`} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
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
          </div>

          {/* ── Apply Settings ── */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Apply Settings</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>CRN Number</FieldLabel>
                  <input type="text" placeholder="From passbook" value={crnNumber} onChange={e => setCrnNumber(e.target.value)} className={inputCls} />
                </div>
                <div><FieldLabel>Default Kitta</FieldLabel>
                  <input type="number" min={10} step={10} value={kitta} onChange={e => setKitta(parseInt(e.target.value) || 10)} className={inputCls} />
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${savePin ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <input type="checkbox" checked={savePin} onChange={e => setSavePin(e.target.checked)} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-900 dark:text-white">Save PIN for 1-click apply</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      {account.auto_apply ? 'PIN saved · enter new PIN to change it' : 'Apply without entering PIN every time'}
                    </p>
                  </div>
                </label>
                {savePin && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <FieldLabel>Transaction PIN <span className="font-normal normal-case">{account.auto_apply ? '(blank = keep existing)' : ''}</span></FieldLabel>
                    <div className="relative">
                      <input type={showPin ? 'text' : 'password'} placeholder={account.auto_apply ? '••••••••' : 'Enter PIN'} value={pin} onChange={e => setPin(e.target.value)} maxLength={10} autoComplete="off"
                        className={inputCls + ' pr-14 font-mono tracking-widest'} />
                      <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <ErrorBox>{error}</ErrorBox>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
              {saving && <Spinner />}{saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
// If account has saved PIN, shows 1-click apply. Otherwise shows PIN field.
function ApplyModal({ ipo, accounts, activeAccountId, onClose, onApplied }) {
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
  const [applying,        setApplying]       = useState(false)
  const [error,           setError]          = useState(null)
  const [result,          setResult]         = useState(null)
  const [disclaimerError, setDisclaimerError] = useState(false)

  const selectedAccount = accounts.find(a => a.id === accountId)
  const hasBank         = !!(selectedAccount?.bank_id && selectedAccount?.account_number)
  const hasSavedPin     = !!selectedAccount?.auto_apply   // auto_apply = saved PIN present
  const alreadyApplied  = ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE'
  const amount          = sharePrice && kitta ? sharePrice * kitta : null
  // 1-click: PIN saved and declaration accepted, no PIN input needed
  const canSubmit       = hasBank && declared && (hasSavedPin || pin.trim())

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !applying) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [applying, onClose])

  const fetchDisclaimer = () => {
    if (!accountId) return
    setDisclaimerError(false)
    getMeroshareDisclaimer(accountId, ipo.companyShareId)
      .then(r => {
        const d = r.data
        setSharePrice(d.sharePrice ? Number(d.sharePrice) : null)
        setMinKitta(d.minKitta || 10); setMaxKitta(d.maxKitta || null); setMultipleOf(d.multipleOf || 10)
      }).catch(() => setDisclaimerError(true))
  }

  useEffect(() => { fetchDisclaimer() }, [accountId, ipo.companyShareId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedAccount) return
    setKitta(selectedAccount.default_kitta || 10)
    setCrnNumber(selectedAccount.crn_number || '')
    setPin('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const handleApply = async () => {
    if (!hasBank) { setError('No ASBA bank set up. Open account settings first.'); return }
    if (!declared) { setError('Please accept the declaration'); return }
    if (!hasSavedPin && !pin.trim()) { setError('Transaction PIN is required'); return }
    setApplying(true); setError(null)
    try {
      const res = await applyMeroshareIPO({
        account_id: accountId, company_share_id: ipo.companyShareId, applied_kitta: kitta,
        crn_number: crnNumber.trim(),
        // Only send pin if user typed one — backend uses stored PIN when omitted
        ...(pin.trim() ? { transaction_pin: pin.trim() } : {}),
      })
      setPin('')
      setResult({ success: true, message: res.data.message || 'Applied successfully' })
      onApplied?.(ipo.companyShareId, accountId)
    } catch (err) {
      setError(err.response?.data?.error || 'Application failed. Check PIN and try again.')
    } finally { setApplying(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">{result ? 'Application Result' : alreadyApplied ? 'Edit Application' : 'Apply for IPO'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{ipo.companyName} · {ipo.scrip}</p>
          </div>
          <button onClick={onClose} title="Close" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg">×</button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            <div className={`flex flex-col items-center gap-2 px-4 py-6 rounded-xl border ${
              result.success ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${result.success ? 'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600' : 'bg-red-100 dark:bg-red-800/40 text-red-500'}`}>
                {result.success ? '✓' : '✗'}
              </div>
              <span className={`text-[12px] font-semibold text-center ${result.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{result.message}</span>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-semibold hover:opacity-90 transition-opacity">Done</button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Account selector — only shown when multiple accounts */}
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
                        <p className="text-[9px] text-gray-400 truncate font-mono">{a.bank_name || a.dp_name}{a.account_number ? ` · ****${a.account_number.slice(-4)}` : ''}</p>
                      </div>
                      {a.auto_apply && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex-shrink-0">PIN SAVED</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedAccount && !hasBank && (
              <div className="border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-r-xl px-3 py-2 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                No ASBA bank linked. Open account edit and set up bank first.
              </div>
            )}

            {selectedAccount && hasBank && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">ASBA Details</p>
                  {hasSavedPin && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">PIN SAVED · 1-click apply</span>}
                </div>
                <Row label="Bank" value={selectedAccount.bank_name} />
                <Row label="Account" value={selectedAccount.account_number ? `****${selectedAccount.account_number.slice(-4)}` : '—'} />
              </div>
            )}

            {disclaimerError && (
              <div className="flex items-center justify-between border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-r-xl px-3 py-2">
                <p className="text-[10px] text-amber-700 dark:text-amber-400">Could not load IPO details (share price, limits).</p>
                <button onClick={fetchDisclaimer} className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 underline ml-2 flex-shrink-0">Retry</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Kitta</FieldLabel>
                <input type="number" min={minKitta} max={maxKitta || undefined} step={multipleOf} value={kitta}
                  onChange={e => {
                    const v = parseInt(e.target.value) || minKitta
                    const snapped = Math.round(v / multipleOf) * multipleOf
                    setKitta(Math.max(minKitta, maxKitta ? Math.min(snapped, maxKitta) : snapped))
                  }}
                  className={inputCls + ' text-[14px] font-bold font-mono'} />
              </div>
              <div><FieldLabel>Amount (Rs.)</FieldLabel>
                <div className={inputCls + ' text-[14px] font-bold font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/60 cursor-default'}>
                  {amount != null ? Number(amount).toLocaleString() : '—'}
                </div>
              </div>
            </div>
            {sharePrice && <p className="text-[9px] text-gray-400 -mt-2 font-mono">Rs.{Number(sharePrice).toLocaleString()}/share · Min {minKitta}{maxKitta ? ` · Max ${maxKitta}` : ''} · ×{multipleOf}</p>}

            <div><FieldLabel>CRN Number</FieldLabel>
              <input type="text" placeholder="Leave blank if not required" value={crnNumber} onChange={e => setCrnNumber(e.target.value)} className={inputCls} />
            </div>

            <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all ${declared ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} className="accent-blue-600 mt-0.5 flex-shrink-0 w-4 h-4" />
              <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">I declare that the information provided is true and I agree to the terms of this IPO application.</p>
            </label>

            {/* PIN field — only shown if no saved PIN */}
            {!hasSavedPin && (
              <div><FieldLabel>Transaction PIN</FieldLabel>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'} placeholder="Your Meroshare PIN"
                    value={pin} onChange={e => setPin(e.target.value)} maxLength={10}
                    className={inputCls + ' pr-14 font-mono tracking-widest'} />
                  <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">{showPin ? 'Hide' : 'Show'}</button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Save PIN in account edit to skip this step next time.</p>
              </div>
            )}

            {error && <ErrorBox>{error}</ErrorBox>}

            <button onClick={handleApply} disabled={applying || !canSubmit} title="Submit IPO application"
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-blue-500/40">
              {applying && <Spinner size={3.5} />}
              {applying ? 'Submitting…' : alreadyApplied ? 'Update Application' : hasSavedPin ? '1-Click Apply' : 'Submit Application'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bulk Apply Modal ──────────────────────────────────────────────────────────
function BulkApplyModal({ ipo, accounts, inFlightRef, onClose, onApplied }) {
  const readyAccounts   = accounts.filter(a => a.bank_id && a.account_branch_id)
  const skippedAccounts = accounts.filter(a => !a.bank_id || !a.account_branch_id)
  const needsPin        = readyAccounts.filter(a => !a.auto_apply)

  const [pins,     setPins]     = useState({})
  const [kitta,    setKitta]    = useState(10)
  const [applying, setApplying] = useState(false)
  const [results,  setResults]  = useState(null)
  const [error,    setError]    = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !applying) handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    if (inFlightRef) inFlightRef.current = false
  }, [inFlightRef])

  const pinsMissing = needsPin.filter(a => !pins[a.id]?.trim())
  const canApply    = readyAccounts.length > 0 && pinsMissing.length === 0

  const handleApply = async () => {
    if (!canApply) return
    if (inFlightRef) inFlightRef.current = true
    setApplying(true); setError(null)
    abortRef.current = new AbortController()
    try {
      const res = await applyMeroshareIPOBulk({ company_share_id: ipo.companyShareId, applied_kitta: kitta, transaction_pins: pins })
      setResults(res.data.results || [])
      onApplied?.(ipo.companyShareId)
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED')
        setError(err.response?.data?.error || 'Bulk apply failed')
    } finally {
      setApplying(false); abortRef.current = null
      if (inFlightRef) inFlightRef.current = false
    }
  }

  const handleClose = () => { if (applying) return; onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">{results ? 'Bulk Apply Results' : 'Apply for All Accounts'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{ipo.companyName} · {ipo.scrip}</p>
          </div>
          {!applying && <button onClick={handleClose} title="Close" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg">×</button>}
        </div>

        {results ? (
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                r.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
                : r.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
              }`}>
                <span className={`text-base flex-shrink-0 mt-0.5 font-bold ${r.status === 'success' ? 'text-emerald-500' : r.status === 'skipped' ? 'text-gray-400' : 'text-red-500'}`}>
                  {r.status === 'success' ? '✓' : r.status === 'skipped' ? '—' : '✗'}
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{r.label}</p>
                  <p className={`text-[10px] mt-0.5 ${r.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : r.status === 'skipped' ? 'text-gray-400' : 'text-red-500'}`}>{r.message}</p>
                </div>
              </div>
            ))}
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-semibold hover:opacity-90 transition-opacity mt-2">Done</button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div>
              <FieldLabel>Kitta per Account</FieldLabel>
              <input type="number" min={10} step={10} value={kitta} onChange={e => setKitta(parseInt(e.target.value) || 10)} className={inputCls + ' text-[14px] font-bold font-mono'} />
              <p className="text-[9px] text-gray-400 mt-1">Applied per account. Overrides each account's default.</p>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{readyAccounts.length} Account{readyAccounts.length !== 1 ? 's' : ''} Ready</p>
              {readyAccounts.map(a => (
                <div key={a.id} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border bg-gray-50 dark:bg-gray-800 ${
                  !a.auto_apply && !pins[a.id]?.trim() ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {a.label.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{a.label}</p>
                      {a.auto_apply && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">AUTO PIN</span>}
                    </div>
                    <p className="text-[9px] text-gray-400 font-mono">{a.bank_name} · ****{a.account_number?.slice(-4)}</p>
                  </div>
                  {!a.auto_apply && (
                    <input type="password" placeholder="PIN" maxLength={10} autoComplete="off"
                      value={pins[a.id] || ''} onChange={e => setPins(p => ({ ...p, [a.id]: e.target.value }))}
                      className="w-24 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-blue-500 font-mono tracking-widest text-center" />
                  )}
                </div>
              ))}
              {skippedAccounts.length > 0 && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400">
                  {skippedAccounts.map(a => a.label).join(', ')} {skippedAccounts.length === 1 ? 'has' : 'have'} no bank set up and will be skipped.
                </p>
              )}
              {pinsMissing.length > 0 && !applying && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">Enter PIN for: {pinsMissing.map(a => a.label).join(', ')}</p>
              )}
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl px-3 py-2">
              <p className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">Takes 4–9s per account to avoid detection. Do not close this window.</p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleClose} disabled={applying} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors">Cancel</button>
              <button onClick={handleApply} disabled={applying || !canApply} title="Apply for all ready accounts"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                {applying && <Spinner />}
                {applying ? 'Applying… Please wait' : `Apply for ${readyAccounts.length} Account${readyAccounts.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stat Tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, accent }) {
  const borders = { blue: 'border-l-blue-500', emerald: 'border-l-emerald-500', purple: 'border-l-purple-500' }
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 border-l-2 ${borders[accent]} px-4 py-3 flex-1 min-w-0`}>
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-[18px] font-bold text-gray-900 dark:text-white font-mono mt-0.5 tabular-nums">{value}</p>
    </div>
  )
}

// ── Sort arrow ────────────────────────────────────────────────────────────────
function SortArrow({ dir }) {
  if (!dir) return <span className="opacity-20">↕</span>
  return <span>{dir === 'asc' ? '↑' : '↓'}</span>
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
  const [appliedMap,    setAppliedMap]    = useState({})
  const [actionError,   setActionError]   = useState(null)
  const [quickApplying,    setQuickApplying]    = useState(null)   // companyShareId being quick-applied
  const [togglingAutoApply, setTogglingAutoApply] = useState(false)
  const [runningAutoApply,  setRunningAutoApply]  = useState(false)

  // Results search + Holdings search + sort
  const [resultSearch,    setResultSearch]    = useState('')
  const [portfolioSearch, setPortfolioSearch] = useState('')
  const [sortCol,         setSortCol]         = useState(null)
  const [sortDir,         setSortDir]         = useState(null)

  const tabCache          = useRef({})
  const bulkApplyInFlight = useRef(false)
  const [sidebarOpen,     setSidebarOpen]   = useState(false)

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
        tabCache.current[key] = data; setIpos(data)
        const applied = {}
        data.forEach(ipo => {
          if (ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE')
            applied[ipo.companyShareId] = (applied[ipo.companyShareId] || new Set()).add(accId)
        })
        setAppliedMap(m => ({ ...m, ...applied }))
      } else if (tab === 'results') {
        const res  = await getMeroshareResults(accId)
        const data = Array.isArray(res.data.results) ? res.data.results : []
        tabCache.current[key] = { results: data }; setResults(data)
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

  useEffect(() => {
    if (!ipos.length || !selectedAcc) return
    const patch = {}
    ipos.forEach(ipo => {
      if (ipo.action === 'edit' || ipo.statusName === 'EDIT_APPROVE') {
        if (!patch[ipo.companyShareId]) patch[ipo.companyShareId] = new Set()
        patch[ipo.companyShareId].add(selectedAcc)
      }
    })
    if (Object.keys(patch).length > 0) setAppliedMap(m => ({ ...m, ...patch }))
  }, [ipos, selectedAcc])

  const handleSelectAccount = (id) => {
    setSelectedAcc(id); setIpos([]); setResults([]); setPortfolio([])
    setAllotmentMap({}); setError(null); setActionError(null)
    setSidebarOpen(false)
  }

  const handleDeleteAccount = async (id) => {
    setDeleting(id); setActionError(null)
    try {
      await deleteMeroshareAccount(id)
      Object.keys(tabCache.current).forEach(k => { if (k.startsWith(`${id}:`)) delete tabCache.current[k] })
      const updated = accounts.filter(x => x.id !== id)
      setAccounts(updated)
      if (selectedAcc === id) setSelectedAcc(updated[0]?.id || null)
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to remove account')
    } finally { setDeleting(null) }
  }

  const handleCancelIPO = async (applicationId) => {
    setCancelingId(applicationId); setActionError(null)
    try {
      await cancelMeroshareIPO({ account_id: selectedAcc, application_id: applicationId })
      setResults(r => r.filter(x => (x.applicantFormId || x.id) !== applicationId))
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to cancel application')
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

  const handleApplied = useCallback((companyShareId, accountId) => {
    setAppliedMap(m => {
      const s = new Set(m[companyShareId] || [])
      if (accountId) s.add(accountId)
      else accounts.forEach(a => s.add(a.id))
      return { ...m, [companyShareId]: s }
    })
    if (accountId) delete tabCache.current[`${accountId}:ipos`]
    else accounts.forEach(a => { delete tabCache.current[`${a.id}:ipos`] })
  }, [accounts])

  const handleAccountUpdated = (updated) => setAccounts(list => list.map(a => a.id === updated.id ? updated : a))

  const handleToggleAutoApply = async (account, enable) => {
    setTogglingAutoApply(true); setActionError(null)
    try {
      await toggleMeroshareAutoApply(account.id, enable)
      setAccounts(list => list.map(a => a.id === account.id
        ? { ...a, auto_apply: enable, ...(enable ? {} : { encrypted_pin: null }) }
        : a
      ))
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update auto-apply'
      setActionError(msg)
      // If no PIN saved, open edit modal
      if (err.response?.status === 400 && msg.includes('No PIN')) setEditAccount(account)
    } finally { setTogglingAutoApply(false) }
  }

  const handleRunAutoApply = async () => {
    setRunningAutoApply(true); setActionError(null)
    try {
      await runMeroshareAutoApply()
      setActionError(null)
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to trigger auto-apply')
    } finally {
      setTimeout(() => setRunningAutoApply(false), 3000)  // brief "Running…" state
    }
  }

  // 1-click apply — only works when account has saved PIN and bank is set up
  const handleQuickApply = useCallback(async (ipo, account) => {
    const id = ipo.companyShareId
    setQuickApplying(id); setActionError(null)
    try {
      await applyMeroshareIPO({
        account_id: account.id, company_share_id: id,
        applied_kitta: account.default_kitta || 10,
        crn_number: account.crn_number || '',
      })
      handleApplied(id, account.id)
      delete tabCache.current[`${account.id}:ipos`]
    } catch (err) {
      setActionError(err.response?.data?.error || 'Quick apply failed — open Apply to retry')
    } finally { setQuickApplying(null) }
  }, [handleApplied]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null

  const activeAccount  = accounts.find(a => a.id === selectedAcc)
  const hasAccounts    = accounts.length > 0
  const hasMultipleAcc = accounts.length > 1

  // Stats
  const appliedCount  = ipos.filter(ipo => appliedMap[ipo.companyShareId]?.has(selectedAcc)).length
  const holdingsCount = portfolio.length

  // Sorted portfolio
  const cycleSort = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir('desc') }
    else if (sortDir === 'desc') setSortDir('asc')
    else { setSortCol(null); setSortDir(null) }
  }
  const sortedPortfolio = [...portfolio]
    .filter(h => !portfolioSearch || h.script?.toLowerCase().includes(portfolioSearch.toLowerCase()) || h.scriptDesc?.toLowerCase().includes(portfolioSearch.toLowerCase()))
    .sort((a, b) => {
      if (!sortCol || !sortDir) return 0
      const va = parseFloat(sortCol === 'qty' ? a.currentBalance : sortCol === 'ltp' ? a.lastTransactionPrice : a.valueOfLastTransPrice) || 0
      const vb = parseFloat(sortCol === 'qty' ? b.currentBalance : sortCol === 'ltp' ? b.lastTransactionPrice : b.valueOfLastTransPrice) || 0
      return sortDir === 'asc' ? va - vb : vb - va
    })

  const filteredResults = results.filter(r => !resultSearch || r.companyName?.toLowerCase().includes(resultSearch.toLowerCase()) || r.scrip?.toLowerCase().includes(resultSearch.toLowerCase()))

  const thCls = "px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400 select-none"
  const sortThCls = thCls + " cursor-pointer hover:text-gray-600 dark:hover:text-gray-200 transition-colors"

  return (
    <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-10 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Mobile: toggle sidebar drawer */}
          {hasAccounts && (
            <button onClick={() => setSidebarOpen(s => !s)} title="Accounts"
              className="sm:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-[11px] font-semibold">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              {activeAccount?.label || 'Accounts'}
            </button>
          )}
          <div>
            <h1 className="text-[18px] font-bold text-gray-900 dark:text-white tracking-tight">Meroshare IPO</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Manage applications across all your family accounts</p>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} title="Add Meroshare account"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Account
        </button>
      </div>

      {/* Mobile sidebar drawer backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Empty state */}
      {!hasAccounts && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">No accounts connected</p>
          <p className="text-[11px] text-gray-400 mb-6">Connect your Meroshare account to view open IPOs, results, and holdings</p>
          <div className="flex items-start justify-center mb-6 max-w-sm mx-auto">
            {[
              { n: '1', label: 'Add Account', desc: 'Enter Meroshare credentials' },
              { n: '2', label: 'ASBA Setup',  desc: 'Link your bank once' },
              { n: '3', label: 'Apply & Track', desc: 'One-click applications' },
            ].map((s, i) => (
              <div key={i} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{s.n}</div>
                  <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mt-2 text-center">{s.label}</p>
                  <p className="text-[9px] text-gray-400 text-center mt-0.5">{s.desc}</p>
                </div>
                {i < 2 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 mt-3.5 flex-shrink-0" />}
              </div>
            ))}
          </div>
          <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors">
            Connect Your First Account
          </button>
        </div>
      )}

      {hasAccounts && (
        <div className="flex gap-5 items-start">

          {/* ── Sidebar ── */}
          {/* On mobile: fixed drawer from left. On sm+: static column. */}
          <div className={`
            fixed sm:static inset-y-0 left-0 z-50 sm:z-auto
            w-64 sm:w-52 flex-shrink-0
            bg-white dark:bg-gray-950 sm:bg-transparent dark:sm:bg-transparent
            border-r sm:border-0 border-gray-100 dark:border-gray-800
            pt-16 sm:pt-0 px-4 sm:px-0
            overflow-y-auto sm:overflow-visible
            transition-transform duration-200 ease-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
            space-y-1.5
          `}>
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Accounts</p>
              <button onClick={() => setSidebarOpen(false)} className="sm:hidden text-gray-400 hover:text-gray-600 text-lg leading-none p-1">×</button>
            </div>
            {accounts.map(a => {
              const noBankSetup = !a.bank_id || !a.account_number
              const isSelected  = selectedAcc === a.id
              return (
                <div key={a.id} onClick={() => handleSelectAccount(a.id)}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-l-2 border-blue-500'
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:-translate-y-px'
                  }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    isSelected ? 'bg-white/20 text-white dark:bg-black/20 dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>{a.label.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold truncate">{a.label}</p>
                      {a.auto_apply && (
                        <span className={`text-[7px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${
                          isSelected ? 'bg-white/20 text-white dark:bg-black/20 dark:text-emerald-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        }`}>AUTO</span>
                      )}
                    </div>
                    <p className={`text-[9px] truncate font-mono ${isSelected ? 'opacity-60' : 'text-gray-400'}`}>
                      {noBankSetup ? '⚠ Bank not set up' : (a.account_number ? `****${a.account_number.slice(-4)}` : a.bank_name || a.dp_name)}
                    </p>
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); setEditAccount(a) }} title="Settings"
                      className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${isSelected ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <InlineConfirm label="×" danger onConfirm={() => handleDeleteAccount(a.id)} disabled={deleting === a.id} />
                  </div>
                </div>
              )
            })}
            <button onClick={() => setShowAddModal(true)} title="Add another account"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-[10px] font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Add Account
            </button>
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">

            {/* Account header bar */}
            {activeAccount && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-[12px] font-bold flex-shrink-0">
                      {activeAccount.label.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white">{activeAccount.label}</p>
                        {(!activeAccount.bank_id || !activeAccount.account_number) && (
                          <button onClick={() => setEditAccount(activeAccount)}
                            className="text-[9px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors">
                            ⚠ Setup ASBA →
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{activeAccount.username} · {activeAccount.dp_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditAccount(activeAccount)} title="Account settings"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-[10px] font-semibold">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Connected
                    </span>
                  </div>
                </div>

                {/* Auto-apply toggle row */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none" title={activeAccount.auto_apply ? 'Click to disable auto-apply' : 'Click to enable auto-apply at 11 AM daily'}>
                      <div onClick={() => !togglingAutoApply && handleToggleAutoApply(activeAccount, !activeAccount.auto_apply)}
                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${togglingAutoApply ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${activeAccount.auto_apply ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${activeAccount.auto_apply ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <div>
                        <p className={`text-[11px] font-semibold ${activeAccount.auto_apply ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          Auto-apply {activeAccount.auto_apply ? 'ON' : 'OFF'}
                        </p>
                        <p className="text-[9px] text-gray-400">Applies at 11:05 AM on weekdays</p>
                      </div>
                    </label>
                  </div>
                  {activeAccount.auto_apply && (
                    <button onClick={handleRunAutoApply} disabled={runningAutoApply || togglingAutoApply}
                      title="Run auto-apply now for all enabled accounts"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-wait transition-colors">
                      {runningAutoApply
                        ? <><span className="w-2.5 h-2.5 border-2 border-emerald-400/40 border-t-emerald-500 rounded-full animate-spin" />Running…</>
                        : <>▶ Run Now</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Stats strip */}
            {activeAccount && (
              <div className="flex gap-3 mb-4">
                <StatTile label="Open IPOs"   value={ipos.length}    accent="blue" />
                <StatTile label="Applied"     value={appliedCount}   accent="emerald" />
                <StatTile label="Holdings"    value={holdingsCount}  accent="purple" />
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
              <button onClick={() => loadData(selectedAcc, activeTab, true)} title="Refresh"
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {actionError && (
              <div className="mb-4 flex items-center gap-2 border-l-2 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-r-xl px-4 py-3">
                <span className="text-[11px] text-red-500 flex-1">{actionError}</span>
                <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            )}

            {error && !loading && (
              <div className="mb-4 flex items-center gap-2 border-l-2 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-r-xl px-4 py-3">
                <span className="text-[11px] text-red-500 flex-1">{error}</span>
                <button onClick={() => loadData(selectedAcc, activeTab, true)} className="text-red-400 hover:text-red-600 font-semibold text-[10px]">Retry</button>
              </div>
            )}

            {loading && (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}</div>
            )}

            {/* ── Open IPOs ── */}
            {!loading && activeTab === 'ipos' && (
              ipos.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
                  <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-[13px] font-semibold text-gray-400">No open IPOs at the moment</p>
                  <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">Check back when a new IPO opens</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ipos.map((ipo, i) => {
                    const noBankSetup   = !activeAccount?.bank_id || !activeAccount?.account_number
                    const hasSavedPin   = !!activeAccount?.auto_apply
                    const thisApplied   = appliedMap[ipo.companyShareId]
                    const appliedHere   = thisApplied?.has(selectedAcc)
                    const appliedAll    = hasMultipleAcc && accounts.every(a => thisApplied?.has(a.id))
                    const days          = daysLeft(ipo.issueCloseDate)
                    const urgent        = days != null && days <= 3
                    const isQuickBusy   = quickApplying === ipo.companyShareId
                    // Single account with saved PIN — show 1-click button
                    const oneClickReady = !hasMultipleAcc && hasSavedPin && !noBankSetup && !appliedHere

                    return (
                      <div key={i} className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-sm ${
                        appliedHere ? 'border-l-2 border-l-emerald-500 border-emerald-200 dark:border-emerald-800/50' : 'border-gray-100 dark:border-gray-800'
                      }`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <p className="text-[13px] font-bold text-gray-900 dark:text-white">{ipo.companyName}</p>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-800/50">
                                {ipo.shareTypeName}
                              </span>
                              {appliedHere && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800/50">✓ Applied</span>
                              )}
                              {appliedAll && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50">✓ All Applied</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-[10px] text-gray-400">Scrip: <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">{ipo.scrip}</span></span>
                              {ipo.subGroup?.trim() && <span className="text-[10px] text-gray-400">{ipo.subGroup}</span>}
                              {ipo.issueOpenDate && (
                                <span className="text-[10px] text-gray-400">
                                  Open: <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">{fmtIpoDate(ipo.issueOpenDate)}</span>
                                </span>
                              )}
                              {ipo.issueCloseDate && (
                                <span className="text-[10px] text-gray-400">
                                  Close: <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">{fmtIpoDate(ipo.issueCloseDate)}</span>
                                </span>
                              )}
                              {days != null && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  urgent ? 'bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-100 dark:border-red-800/50' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800/50'
                                }`}>{days <= 0 ? 'Closing today' : `${days}d left`}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {/* Multi-account: Apply All button */}
                            {hasMultipleAcc && !noBankSetup && (() => {
                              const readyAccs     = accounts.filter(a => a.bank_id && a.account_branch_id)
                              const unappliedAccs = readyAccs.filter(a => !thisApplied?.has(a.id))
                              if (unappliedAccs.length === 0) return (
                                <span className="px-3 py-1.5 rounded-xl text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-800/50">✓ All Done</span>
                              )
                              return (
                                <button onClick={() => { if (!bulkApplyInFlight.current) setBulkApplyIPO(ipo) }}
                                  disabled={bulkApplyInFlight.current} title="Apply for all accounts"
                                  className="px-3 py-1.5 rounded-xl text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                  Apply All ({unappliedAccs.length})
                                </button>
                              )
                            })()}
                            {/* Single account apply area */}
                            {noBankSetup ? (
                              <button onClick={() => setEditAccount(activeAccount)} title="Set up ASBA bank"
                                className="px-3 py-1.5 rounded-xl text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 transition-colors">
                                Setup ASBA →
                              </button>
                            ) : appliedHere ? (
                              <button onClick={() => setApplyIPO(ipo)} title="Edit application"
                                className="px-4 py-1.5 rounded-xl text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                Edit →
                              </button>
                            ) : oneClickReady ? (
                              // 1-click apply — PIN saved, no modal needed
                              <div className="flex flex-col items-end gap-1">
                                <button onClick={() => handleQuickApply(ipo, activeAccount)} disabled={isQuickBusy || !!quickApplying}
                                  title="Apply instantly using saved PIN"
                                  className="px-4 py-1.5 rounded-xl text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors">
                                  {isQuickBusy ? <><span className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Applying…</> : '⚡ 1-Click Apply'}
                                </button>
                                <button onClick={() => setApplyIPO(ipo)} className="text-[9px] text-gray-400 hover:text-gray-600 transition-colors">change kitta →</button>
                              </div>
                            ) : (
                              <button onClick={() => setApplyIPO(ipo)} title="Apply for IPO"
                                className="px-4 py-1.5 rounded-xl text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40">
                                Apply →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* ── Results ── */}
            {!loading && activeTab === 'results' && (
              results.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
                  <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-[13px] font-semibold text-gray-400">No applications for {activeAccount?.label}</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">{results.length} application{results.length !== 1 ? 's' : ''}</p>
                    <div className="relative flex-1 max-w-xs">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input type="text" placeholder="Search company or scrip…" value={resultSearch} onChange={e => setResultSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className={thCls + ' text-left'}>Company</th>
                          <th className={thCls + ' text-center'}>Applied</th>
                          <th className={thCls + ' text-center'}>Result</th>
                          <th className={thCls + ' text-left'}>Remark</th>
                          <th className="px-4 py-2.5 w-36" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((r, i) => {
                          const appId      = r.applicantFormId || r.id
                          const canCancel  = r.statusName === 'APPROVED' || r.statusName === 'BLOCKED_APPROVE'
                          const allotment  = appId ? allotmentMap[appId] : null
                          const isChecking = checkingId === appId
                          return (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-[11px] font-semibold text-gray-900 dark:text-white">{r.companyName}</p>
                                <p className="text-[9px] text-gray-400 font-mono">{r.scrip} · {r.shareTypeName}</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {allotment && !allotment.error
                                  ? <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 font-mono">{allotment.appliedKitta} kitta</span>
                                  : <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {allotment && !allotment.error ? (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border font-mono ${
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
                                    <button onClick={() => handleCheckAllotment(appId)} disabled={isChecking} title="Check allotment result"
                                      className="text-[10px] font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-40 flex items-center gap-1 transition-colors">
                                      {isChecking && <span className="w-2.5 h-2.5 border-2 border-blue-400/40 border-t-blue-500 rounded-full animate-spin" />}
                                      {isChecking ? 'Checking…' : allotment && !allotment.error ? 'Refresh' : 'Check Result'}
                                    </button>
                                  )}
                                  {canCancel && appId && (
                                    <InlineConfirm label="Cancel" danger onConfirm={() => handleCancelIPO(appId)} disabled={cancelingId === appId} />
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
              )
            )}

            {/* ── Holdings ── */}
            {!loading && activeTab === 'portfolio' && (
              portfolio.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
                  <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[13px] font-semibold text-gray-400">No holdings for {activeAccount?.label}</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{portfolio.length} holdings · {activeAccount?.label}</p>
                      </div>
                      <div className="relative max-w-xs">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" placeholder="Filter by scrip or company…" value={portfolioSearch} onChange={e => setPortfolioSearch(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors" />
                      </div>
                    </div>
                    {totalValue && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest">Total Value</p>
                        <p className="text-[15px] font-bold text-gray-900 dark:text-white font-mono tabular-nums">Rs. {Number(totalValue).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className={thCls + ' text-left'}>Scrip</th>
                          <th className={thCls + ' text-left'}>Company</th>
                          <th className={sortThCls + ' text-right'} onClick={() => cycleSort('qty')}>Qty <SortArrow dir={sortCol === 'qty' ? sortDir : null} /></th>
                          <th className={sortThCls + ' text-right'} onClick={() => cycleSort('ltp')}>LTP <SortArrow dir={sortCol === 'ltp' ? sortDir : null} /></th>
                          <th className={sortThCls + ' text-right'} onClick={() => cycleSort('value')}>Value <SortArrow dir={sortCol === 'value' ? sortDir : null} /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPortfolio.map((h, i) => {
                          const val = parseFloat(h.valueOfLastTransPrice) || 0
                          const tv  = parseFloat(totalValue) || 1
                          const pct = Math.min(100, (val / tv) * 100)
                          return (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                              <td className="px-4 py-3 text-[11px] font-bold text-blue-600 dark:text-blue-400 font-mono">{h.script}</td>
                              <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400 max-w-[180px] truncate">{h.scriptDesc}</td>
                              <td className="px-4 py-3 text-[11px] text-right font-semibold text-gray-900 dark:text-white font-mono tabular-nums">{fmt(h.currentBalance)}</td>
                              <td className="px-4 py-3 text-[11px] text-right text-gray-600 dark:text-gray-300 font-mono tabular-nums">Rs.{fmt(parseFloat(h.lastTransactionPrice))}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-[11px] font-semibold text-gray-900 dark:text-white font-mono tabular-nums">Rs.{fmt(h.valueOfLastTransPrice)}</span>
                                {totalValue && (
                                  <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
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
        <EditAccountModal account={editAccount} dpList={dpList}
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
          inFlightRef={bulkApplyInFlight}
          onClose={() => setBulkApplyIPO(null)}
          onApplied={(csid) => { handleApplied(csid, null); setBulkApplyIPO(null) }} />
      )}
    </div>
  )
}

export default IPOPage
