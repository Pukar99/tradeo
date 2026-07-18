// === icons.jsx — shared stroke-style SVG icons (t30 HOME-15) ===
// One home for the small UI icons that used to be emoji (⚠ 🔴 🟢 🔔 📅 ⚡ ✏️ 🗑️).
// All inherit currentColor so the parent's text color styles them.

const base = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 2,
}
const line = { strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconPencil = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path
      {...line}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
)

export const IconTrash = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path
      {...line}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
)

export const IconWarning = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path
      {...line}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
)

export const IconAlertCircle = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path {...line} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export const IconCheckCircle = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path {...line} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export const IconBell = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path
      {...line}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
)

export const IconCalendar = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path
      {...line}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
)

export const IconBolt = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} {...base}>
    <path {...line} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
