// === WatchAlertForm.jsx — THE watchlist alert-fields form (t30 HOME-10) ===
// One component for BOTH the inline add flow and the edit modal — the previously
// duplicated price-% chips, date chips and inputs live only here now.
// Chrome (modal header / symbol strip) stays with the caller; this is the fields.

const INPUT_CLS =
  'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none transition-all'

const NOTE_TAGS = ['Breakout', 'Dip buy', 'Earnings', 'Long term', 'Sector play']

// Local-midnight "today" — computed per render (cheap; avoids a frozen date)
function todayMidnight() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dateOffset(days) {
  const d = todayMidnight()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function nextWeekday(day) {
  // 1=Mon … 5=Fri
  const d = todayMidnight()
  const curr = d.getDay() // 0=Sun
  let diff = day - curr
  if (diff <= 0) diff += 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default function WatchAlertForm({
  variant, // 'add' | 'edit'
  ltp, // reference price (number|null)
  form,
  setForm,
  onSubmit,
  onCancel, // edit only (add has its own strip-level close)
  busy,
  error,
}) {
  const pctChips = ltp
    ? [
        { label: '−10%', val: (ltp * 0.9).toFixed(2) },
        { label: '−5%', val: (ltp * 0.95).toFixed(2) },
        { label: 'LTP', val: ltp.toFixed(2) },
        { label: '+5%', val: (ltp * 1.05).toFixed(2) },
        { label: '+10%', val: (ltp * 1.1).toFixed(2) },
      ]
    : null
  const dateChips = [
    { label: 'Mon', val: nextWeekday(1) },
    { label: '+1w', val: dateOffset(7) },
    { label: '+2w', val: dateOffset(14) },
    { label: '+1m', val: dateOffset(30) },
  ]
  const watchToday = todayMidnight()
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  return (
    <form onSubmit={onSubmit} className={variant === 'edit' ? 'px-4 py-3 space-y-2.5' : 'px-3 py-2.5 space-y-2.5'}>
      {/* ── Price Alert ── */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Price Alert
        </p>
        {pctChips && (
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {pctChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => set({ price_alert: c.val })}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                  form.price_alert === c.val
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : c.label.startsWith('−')
                      ? 'border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                      : c.label.startsWith('+')
                        ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.price_alert}
          autoComplete="off"
          onChange={(e) => set({ price_alert: e.target.value })}
          placeholder="0.00"
          className={`${INPUT_CLS} focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40`}
        />
        {form.price_alert &&
          ltp != null &&
          (() => {
            const pct = ((parseFloat(form.price_alert) - ltp) / ltp) * 100
            return (
              <p
                className={`text-[9px] mt-0.5 tabular-nums ${pct >= 0 ? 'text-green-500' : 'text-red-400'}`}
              >
                {pct >= 0 ? '+' : ''}
                {pct.toFixed(1)}% from LTP
              </p>
            )
          })()}
      </div>

      {/* ── Target Date ── */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Target Date
        </p>
        <div className="flex gap-1 mb-1.5">
          {dateChips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => set({ alert_date: c.val })}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                form.alert_date === c.val
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={form.alert_date}
          onChange={(e) => set({ alert_date: e.target.value })}
          className={`${INPUT_CLS} focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40`}
        />
        {form.alert_date && (
          <p className="text-[9px] mt-0.5 text-blue-500">
            {Math.ceil((new Date(form.alert_date + 'T00:00:00') - watchToday) / 86400000)}d from
            today
          </p>
        )}
      </div>

      {/* ── Watch Range ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Watch Low
          </p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.watch_low}
            autoComplete="off"
            onChange={(e) => set({ watch_low: e.target.value })}
            placeholder="0.00"
            className={`${INPUT_CLS} focus:border-red-300 dark:focus:border-red-500/50 focus:ring-1 focus:ring-red-200/50`}
          />
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Watch High
          </p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.watch_high}
            autoComplete="off"
            onChange={(e) => set({ watch_high: e.target.value })}
            placeholder="0.00"
            className={`${INPUT_CLS} focus:border-green-300 dark:focus:border-green-500/50 focus:ring-1 focus:ring-green-200/50`}
          />
        </div>
      </div>

      {/* ── Notes (+ quick tags on add) ── */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Notes
        </p>
        {variant === 'add' && (
          <div className="flex gap-1 flex-wrap mb-1.5">
            {NOTE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setForm((f) => {
                    // Append the tag (comma-separated); skip if already present.
                    const cur = f.notes.trim()
                    if (cur.split(/,\s*/).includes(tag)) return f
                    return { ...f, notes: cur ? `${cur}, ${tag}` : tag }
                  })
                }
                className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={form.notes}
          maxLength={300}
          autoComplete="off"
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Setup reason, catalyst…"
          className={`${INPUT_CLS} focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300/40`}
        />
      </div>

      {error && (
        <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/50 px-2.5 py-1.5 rounded-lg">
          {error}
        </p>
      )}

      {variant === 'edit' ? (
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-[11px] font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-[11px] font-bold transition-colors"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-[11px] font-bold transition-colors"
        >
          {busy ? 'Adding…' : 'Add to Watchlist'}
        </button>
      )}
    </form>
  )
}
