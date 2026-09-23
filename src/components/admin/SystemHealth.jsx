// === SystemHealth.jsx — the System tab's status band ===
//
// Visual pass 2026-08-08. These checks previously rendered as one line of
// 11px text squeezed under five large stat tiles — the only signals on the
// tab that can tell you something is broken were the smallest thing on it.
// They now lead the tab as three real status tiles.
//
// Presentational only: every value is passed in, nothing is fetched here.

const TONE = {
  ok: {
    edge: 'bg-emerald-500',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    state: 'text-emerald-600 dark:text-emerald-400',
  },
  warn: {
    edge: 'bg-amber-500',
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    state: 'text-amber-700 dark:text-amber-400',
  },
  error: {
    edge: 'bg-red-500',
    icon: 'bg-red-500/10 text-red-600 dark:text-red-400',
    state: 'text-red-600 dark:text-red-400',
  },
  busy: {
    edge: 'bg-blue-500',
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    state: 'text-blue-600 dark:text-blue-400',
  },
}

const ICON = {
  ok: <path d="M20 6 9 17l-5-5" />,
  warn: (
    <>
      <path d="M12 9v4m0 4h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6m0-6 6 6" />
    </>
  ),
  busy: (
    <>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
      <path d="M21 3v6h-6" />
    </>
  ),
}

function HealthTile({ tone = 'ok', name, state, detail, chips }) {
  const t = TONE[tone] || TONE.ok
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-3">
      <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-[3px] ${t.edge}`} />
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center ${t.icon}`}
        >
          <svg
            className={`w-3 h-3 ${tone === 'busy' ? 'animate-spin motion-reduce:animate-none' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICON[tone] || ICON.ok}
          </svg>
        </span>
        <span className="text-[11px] font-bold tracking-[-0.005em] text-gray-900 dark:text-white">
          {name}
        </span>
        <span
          className={`ml-auto text-[9px] font-bold uppercase tracking-widest ${t.state}`}
        >
          {state}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{detail}</p>
      {chips?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold leading-none bg-amber-500/10 text-amber-700 dark:text-amber-400"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SkeletonTile() {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="h-2.5 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
    </div>
  )
}

function formatLastRun(iso) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SystemHealth({ scraper, scraperLoading, health }) {
  // Scraper: an error outranks the run state — a finished-but-failed run is
  // the thing worth surfacing, not "idle".
  let scraperTone = 'ok'
  let scraperState = 'Idle'
  let scraperDetail = `Last run ${formatLastRun(scraper?.lastRun)} · ${(scraper?.rowsInserted ?? 0).toLocaleString()} rows saved`
  if (scraper?.lastError) {
    scraperTone = 'error'
    scraperState = 'Failed'
    scraperDetail = scraper.lastError
  } else if (scraper?.running) {
    scraperTone = 'busy'
    scraperState = 'Running'
    scraperDetail = 'Fetching the latest NEPSE data…'
  }

  const danglingCount = health?.danglingCount ?? 0
  const nullClose = health?.nullClose ?? 0

  return (
    <div className="px-4 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
        System health
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scraperLoading ? (
          <SkeletonTile />
        ) : (
          <HealthTile
            tone={scraperTone}
            name="Scraper"
            state={scraperState}
            detail={scraperDetail}
          />
        )}

        {!health ? (
          <>
            <SkeletonTile />
            <SkeletonTile />
          </>
        ) : (
          <>
            <HealthTile
              tone={danglingCount > 0 ? 'warn' : 'ok'}
              name="Watchlist symbols"
              state={danglingCount > 0 ? `${danglingCount} missing` : 'All found'}
              detail={
                danglingCount > 0
                  ? 'Not found in company_master'
                  : 'Every watchlist symbol exists in company_master'
              }
              // The endpoint already returns the ticker list alongside the
              // count; it used to be fetched and discarded, so the tab could
              // say "3 missing" without ever saying which three.
              chips={health.danglingList}
            />
            <HealthTile
              tone={nullClose > 0 ? 'warn' : 'ok'}
              name="Market journal"
              state={nullClose > 0 ? `${nullClose} incomplete` : 'Complete'}
              detail={
                nullClose > 0
                  ? 'Rows missing a NEPSE close (last 30 days)'
                  : 'All rows have a NEPSE close (last 30 days)'
              }
            />
          </>
        )}
      </div>
    </div>
  )
}
