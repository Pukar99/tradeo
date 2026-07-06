// === markdown.jsx — chat markdown primitives (TradeoLogo, MarkdownLite) ===
// Moved verbatim from AIChat.jsx (P2.1 split). renderInline is module-private.

// ── Tradeo logo SVG (reused everywhere in chat) ──────────────────────────────
export const TradeoLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="8" className="tradeo-logo-bg" strokeWidth="1" />
    <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e" />
    <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5" />
    <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5" />
    <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444" />
    <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5" />
    <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5" />
    <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e" />
    <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5" />
    <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5" />
  </svg>
)

// ── Lightweight markdown for assistant replies ───────────────────────────────
// Groq replies use **bold**, `code`, bullets and numbered lists. Rendered as
// React elements (never innerHTML) so model output can't inject markup.
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      )
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code key={i} className="px-1 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">
          {p.slice(1, -1)}
        </code>
      )
    return p
  })
}

export function MarkdownLite({ text }) {
  if (!text) return null
  const blocks = []
  let list = null // { ordered, items }
  const flush = () => {
    if (list) {
      blocks.push(list)
      list = null
    }
  }
  text.split('\n').forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)/)
    const heading = line.match(/^#{1,4}\s+(.*)/)
    if (bullet) {
      if (!list || list.ordered) {
        flush()
        list = { ordered: false, items: [] }
      }
      list.items.push(bullet[1])
    } else if (ordered) {
      if (!list || !list.ordered) {
        flush()
        list = { ordered: true, items: [] }
      }
      list.items.push(ordered[1])
    } else {
      flush()
      if (heading) blocks.push({ heading: heading[1] })
      else if (line.trim() !== '') blocks.push(line)
    }
  })
  flush()
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (typeof b === 'string')
          return (
            <p key={i} className="whitespace-pre-wrap">
              {renderInline(b)}
            </p>
          )
        if (b.heading)
          return (
            <p key={i} className="font-semibold">
              {renderInline(b.heading)}
            </p>
          )
        const Tag = b.ordered ? 'ol' : 'ul'
        return (
          <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} pl-4 space-y-0.5`}>
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it)}</li>
            ))}
          </Tag>
        )
      })}
    </div>
  )
}
