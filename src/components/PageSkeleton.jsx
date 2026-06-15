// =============================================================================
// PageSkeleton.jsx — Generic full-page loading skeleton for the auth-resolve window
// =============================================================================
// Shown while AuthContext resolves GET /api/auth/me on reload, so public routes
// don't flash the logged-OUT view before `user` hydrates. Replaces the centered
// spinners that previously filled that gap (design.md §3: skeletons for in-page
// loading; spinners reserved for Suspense/lazy + in-button busy states).
//
// PURE BLOCKS — no text/labels ever render here. Pages must gate the WHOLE shell
// (toolbar included) on this, not just the content body, so real tab labels never
// sit above the skeleton.
//
// Tokens match the established inline skeletons: bg-gray-100 dark:bg-gray-800 +
// animate-pulse, rounded bars. Sized to reserve plausible layout so the swap to
// real content doesn't jump.
//
// Props:
//   variant  — "page" (default) full content skeleton, "navbar" (avatar circle),
//              or "tab" — a content-shaped skeleton for tab-switch / lazy-tab
//              fallbacks (Explore, DataLab). NO toolbar strip: the parent already
//              renders the real tab bar above the swap slot, so the tab skeleton
//              only fills the content body. Replaces the old centered spinners
//              (TabSpinner/TabLoader) which floated and didn't match content size.
//   toolbar  — when true (page variant), render a top toolbar-strip placeholder so
//              the page's real toolbar (tabs/badges) is replaced, not overlaid.
// =============================================================================

const block = 'bg-gray-100 dark:bg-gray-800 rounded'

export default function PageSkeleton({ variant = 'page', toolbar = false }) {
  if (variant === 'navbar') {
    return (
      <div
        className="hidden lg:block w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse"
        aria-hidden="true"
      />
    )
  }

  // Tab content skeleton — fills its (often absolute inset-0) container and mirrors
  // the common tab layout: a stat-card row over a primary chart/list panel. Sized
  // to reserve plausible space so the swap to real content doesn't jump.
  if (variant === 'tab') {
    return (
      <div
        className="h-full w-full overflow-hidden px-4 sm:px-6 py-5 animate-pulse"
        aria-hidden="true"
        role="presentation"
      >
        {/* Stat-card row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
        {/* Primary panel */}
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4" />
        {/* List rows */}
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 min-h-0 w-full flex flex-col animate-pulse"
      aria-hidden="true"
      role="presentation"
    >
      {/* Toolbar strip placeholder — mirrors the real tab/toolbar row so it isn't
          replaced by visible text labels during the auth-resolve window. */}
      {toolbar && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800/80">
          <div className={`h-6 w-28 ${block}`} />
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <div className={`h-6 w-40 ${block}`} />
          <div className={`ml-auto h-6 w-20 ${block}`} />
        </div>
      )}

      {/* Content body */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 sm:px-6 py-6">
        {/* Heading */}
        <div className={`h-7 w-44 ${block} mb-2.5`} />
        <div className={`h-3.5 w-64 max-w-full ${block} mb-7`} />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>

        {/* Primary content + side column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
