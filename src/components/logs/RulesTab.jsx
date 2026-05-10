import { useState, useEffect, useCallback } from 'react'
import { getRules, addRule, updateRule, deleteRule, getRuleViolations } from '../../api'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['General', 'Entry', 'Exit', 'Risk Management', 'Psychology', 'Position Sizing']

const VIOLATION_COLORS = {
  NO_SL:              { bg: 'bg-red-50 dark:bg-red-900/20',       badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',       dot: 'bg-red-500'    },
  RR_BELOW_1:         { bg: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', dot: 'bg-orange-500' },
  FOMO_TAG:           { bg: 'bg-purple-50 dark:bg-purple-900/20', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400', dot: 'bg-purple-500' },
  NO_ENTRY_REASON:    { bg: 'bg-yellow-50 dark:bg-yellow-900/20', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400', dot: 'bg-yellow-500' },
  NO_EXIT_REFLECTION: { bg: 'bg-blue-50 dark:bg-blue-900/20',     badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',     dot: 'bg-blue-500'   },
}

const INPUT = 'w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[12px] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'

const fmt = (n) => Number(n).toLocaleString()

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-xl">{icon}</div>
      <p className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">{title}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  )
}

// ── Category badge ────────────────────────────────────────────────────────────
function CatBadge({ cat }) {
  const MAP = {
    'General':          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    'Entry':            'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    'Exit':             'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    'Risk Management':  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    'Psychology':       'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    'Position Sizing':  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide ${MAP[cat] || MAP['General']}`}>
      {cat}
    </span>
  )
}

// ── Inline add / edit form ────────────────────────────────────────────────────
function RuleForm({ initial = null, onSave, onCancel, saving }) {
  const [text,   setText]   = useState(initial?.rule_text || '')
  const [cat,    setCat]    = useState(initial?.category  || 'General')
  const [active, setActive] = useState(initial?.is_active ?? true)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSave({ rule_text: text.trim(), category: cat, is_active: active })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
      <div>
        <label className={LABEL}>Rule</label>
        <textarea
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Never enter without a stop-loss"
          className={INPUT + ' resize-none'}
          autoFocus
          maxLength={500}
        />
        <p className="text-[9px] text-gray-400 mt-1 text-right">{text.length}/500</p>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Category</label>
          <select value={cat} onChange={e => setCat(e.target.value)} className={INPUT}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {initial && (
          <div className="flex flex-col justify-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className={LABEL + ' mb-0'}>Active</span>
              <button
                type="button"
                onClick={() => setActive(a => !a)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={!text.trim() || saving}
          className="px-4 py-1.5 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1.5">
          {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {initial ? 'Update' : 'Add Rule'}
        </button>
      </div>
    </form>
  )
}

// ── Single rule row ───────────────────────────────────────────────────────────
function RuleRow({ rule, onEdit, onDelete, onToggle, deleting }) {
  return (
    <div className={`group flex items-start gap-3 bg-white dark:bg-gray-900 border rounded-xl px-4 py-3 transition-colors ${rule.is_active ? 'border-gray-100 dark:border-gray-800' : 'border-dashed border-gray-200 dark:border-gray-700 opacity-60'}`}>
      <button
        onClick={() => onToggle(rule)}
        title={rule.is_active ? 'Deactivate' : 'Activate'}
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${rule.is_active ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-gray-300 dark:border-gray-600'}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] leading-snug ${rule.is_active ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}`}>
          {rule.rule_text}
        </p>
        <div className="mt-1.5">
          <CatBadge cat={rule.category} />
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(rule)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button onClick={() => onDelete(rule.id)} disabled={deleting === rule.id}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
          {deleting === rule.id
            ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin block" />
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
          }
        </button>
      </div>
    </div>
  )
}

// ── Violation trade row ───────────────────────────────────────────────────────
function ViolationRow({ item }) {
  const [open, setOpen] = useState(false)
  const pnl = item.realized_pnl

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex-shrink-0 w-20">
          <p className="text-[10px] text-gray-400 font-mono">{item.date}</p>
          <p className="text-[12px] font-bold text-gray-900 dark:text-white">{item.symbol}</p>
        </div>
        <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-md ${item.position === 'LONG' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {item.position}
        </span>
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {item.violations.map(v => {
            const c = VIOLATION_COLORS[v.code] || VIOLATION_COLORS.NO_SL
            return (
              <span key={v.code} className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-md ${c.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {v.label}
              </span>
            )
          })}
        </div>
        <div className="flex-shrink-0 text-right">
          {item.cost > 0
            ? <p className="text-[12px] font-bold text-red-500 font-mono">-Rs.{fmt(item.cost)}</p>
            : <p className="text-[10px] text-gray-400">No loss</p>
          }
          <p className={`text-[9px] font-mono ${pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}Rs.{fmt(Math.abs(pnl))}
          </p>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          {item.violations.map(v => {
            const c = VIOLATION_COLORS[v.code] || VIOLATION_COLORS.NO_SL
            return (
              <div key={v.code} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${c.bg}`}>
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                <div>
                  <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{v.label}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{v.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main RulesTab ─────────────────────────────────────────────────────────────
export default function RulesTab() {
  // Rules state
  const [rules,        setRules]        = useState([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError,   setRulesError]   = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editingRule,  setEditingRule]  = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(null)

  // Violations state
  const [violations, setViolations] = useState(null)
  const [vioLoading, setVioLoading] = useState(false)
  const [vioError,   setVioError]   = useState(null)
  const [vioLoaded,  setVioLoaded]  = useState(false)

  // View
  const [subTab,       setSubTab]       = useState('rules')   // 'rules' | 'violations'
  const [filterCat,    setFilterCat]    = useState('All')
  const [filterActive, setFilterActive] = useState('all')

  const fetchRules = useCallback(async () => {
    setRulesLoading(true); setRulesError(null)
    try {
      const res = await getRules()
      setRules(res.data || [])
    } catch {
      setRulesError('Could not load rules.')
    } finally {
      setRulesLoading(false)
    }
  }, [])

  const fetchViolations = useCallback(async () => {
    setVioLoading(true); setVioError(null)
    try {
      const res = await getRuleViolations()
      setViolations(res.data)
      setVioLoaded(true)
    } catch {
      setVioError('Could not load violations.')
    } finally {
      setVioLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  useEffect(() => {
    if (subTab === 'violations' && !vioLoaded) fetchViolations()
  }, [subTab, vioLoaded, fetchViolations])

  const handleAdd = async (data) => {
    setSaving(true)
    try {
      const res = await addRule(data)
      setRules(r => [...r, res.data])
      setShowForm(false)
      toast.success('Rule added')
    } catch {
      toast.error('Failed to add rule')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (data) => {
    setSaving(true)
    try {
      const res = await updateRule(editingRule.id, data)
      setRules(r => r.map(x => x.id === editingRule.id ? res.data : x))
      setEditingRule(null)
      toast.success('Rule updated')
    } catch {
      toast.error('Failed to update rule')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (rule) => {
    try {
      const res = await updateRule(rule.id, { is_active: !rule.is_active })
      setRules(r => r.map(x => x.id === rule.id ? res.data : x))
    } catch {
      toast.error('Could not update rule')
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteRule(id)
      setRules(r => r.filter(x => x.id !== id))
      toast.success('Rule deleted')
    } catch {
      toast.error('Failed to delete rule')
    } finally {
      setDeleting(null)
    }
  }

  const filteredRules = rules.filter(r => {
    if (filterCat !== 'All' && r.category !== filterCat) return false
    if (filterActive === 'active'   && !r.is_active) return false
    if (filterActive === 'inactive' && r.is_active)  return false
    return true
  })

  const activeCount   = rules.filter(r => r.is_active).length
  const inactiveCount = rules.length - activeCount

  return (
    <div className="space-y-4">

      {/* ── Sub-tab switcher ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl p-1">
          {[
            { id: 'rules',      label: 'Playbook',   count: rules.length },
            { id: 'violations', label: 'Violations',  count: violations?.summary?.total_violations ?? null },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${subTab === t.id ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t.label}
              {t.count != null && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${subTab === t.id ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Add button — only on playbook sub-tab */}
        {subTab === 'rules' && (
          <button
            onClick={() => { setShowForm(true); setEditingRule(null) }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/30"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Rule
          </button>
        )}

        {/* Re-scan button — only on violations sub-tab */}
        {subTab === 'violations' && (
          <button
            onClick={fetchViolations}
            disabled={vioLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${vioLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {vioLoading ? 'Scanning…' : 'Re-scan'}
          </button>
        )}
      </div>

      {/* ══════════════════ PLAYBOOK SUB-TAB ══════════════════ */}
      {subTab === 'rules' && (
        <div className="space-y-3">

          {/* Stats row */}
          {rules.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',    value: rules.length,   color: 'text-gray-800 dark:text-gray-100' },
                { label: 'Active',   value: activeCount,    color: 'text-emerald-500' },
                { label: 'Inactive', value: inactiveCount,  color: 'text-gray-400' },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-[20px] font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 outline-none">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 outline-none">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Add form */}
          {showForm && !editingRule && (
            <RuleForm onSave={handleAdd} onCancel={() => setShowForm(false)} saving={saving} />
          )}

          {/* Rule list */}
          {rulesLoading ? (
            <Skeleton rows={4} />
          ) : rulesError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-[12px] text-red-600 dark:text-red-400 flex items-center justify-between">
              {rulesError}
              <button onClick={fetchRules} className="text-red-500 underline text-[11px]">Retry</button>
            </div>
          ) : filteredRules.length === 0 ? (
            rules.length === 0
              ? <Empty icon="📋" title="No rules yet" sub="Add your first rule to start building your personal trading playbook." />
              : <Empty icon="🔍" title="No matches" sub="Try changing the filters." />
          ) : (
            <div className="space-y-2">
              {filteredRules.map(rule =>
                editingRule?.id === rule.id
                  ? <RuleForm key={rule.id} initial={rule} onSave={handleUpdate} onCancel={() => setEditingRule(null)} saving={saving} />
                  : <RuleRow key={rule.id} rule={rule} onEdit={r => { setEditingRule(r); setShowForm(false) }} onDelete={handleDelete} onToggle={handleToggle} deleting={deleting} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ VIOLATIONS SUB-TAB ══════════════════ */}
      {subTab === 'violations' && (
        <div className="space-y-3">
          {vioLoading ? (
            <Skeleton rows={5} />
          ) : vioError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-[12px] text-red-600 dark:text-red-400 flex items-center justify-between">
              {vioError}
              <button onClick={fetchViolations} className="text-red-500 underline text-[11px]">Retry</button>
            </div>
          ) : !violations ? null : violations.violations.length === 0 ? (
            <Empty icon="✅" title="No violations found" sub="Your trades are clean. Keep following your rules." />
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Total Violations',  value: violations.summary.total_violations,     color: 'text-red-500' },
                  { label: 'Cost of Bad Habits', value: `Rs.${fmt(violations.summary.total_cost)}`, color: 'text-red-500' },
                  { label: 'Trades Affected',   value: violations.summary.trades_with_violations, color: 'text-orange-500' },
                  { label: 'Top Violation',      value: violations.summary.most_common[0]?.label || '—', color: 'text-gray-700 dark:text-gray-200', small: true },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className={`font-bold ${s.small ? 'text-[11px]' : 'text-[16px]'} ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Frequency bars */}
              {violations.summary.most_common.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Violation Frequency</p>
                  <div className="space-y-2">
                    {violations.summary.most_common.map(v => {
                      const c   = VIOLATION_COLORS[v.code] || VIOLATION_COLORS.NO_SL
                      const pct = Math.round((v.count / violations.violations.length) * 100)
                      return (
                        <div key={v.code} className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                          <span className="text-[11px] text-gray-700 dark:text-gray-200 flex-1 truncate">{v.label}</span>
                          <span className="text-[10px] text-gray-400 font-mono w-6 text-right">{v.count}×</span>
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${c.dot}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Per-trade rows */}
              <div className="space-y-2">
                {violations.violations.map(item => (
                  <ViolationRow key={item.trade_id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
