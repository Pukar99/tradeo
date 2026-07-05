// === authForm.js — shared non-JSX helpers for LoginPage/SignupPage (extracted verbatim, P1.3) ===

// Common email-domain typo suggester. Advisory only — never auto-rewrites the
// field; user taps to accept. Returns a corrected email string or null.
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']
export function suggestEmail(value) {
  const at = value.lastIndexOf('@')
  if (at < 1) return null
  const domain = value.slice(at + 1).toLowerCase()
  if (!domain || domain.length < 3 || EMAIL_DOMAINS.includes(domain)) return null
  for (const good of EMAIL_DOMAINS) {
    // one-edit (insert/delete/substitute) distance from a known domain.
    // NOTE: a transposition ("gmial") is distance 2 and is deliberately NOT
    // caught — the original inline comment claimed "transpose" but the code
    // never did; behavior locked as-is in tests/unit/auth-form.test.js.
    if (domain !== good && levenshtein1(domain, good)) {
      return value.slice(0, at + 1) + good
    }
  }
  return null
}
// True if a→b is within Levenshtein distance 1 (cheap, no full matrix).
function levenshtein1(a, b) {
  if (a === b) return true
  const la = a.length,
    lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0,
    j = 0,
    edits = 0
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (la > lb) i++
    else if (lb > la) j++
    else {
      i++
      j++
    }
  }
  return edits + (la - i) + (lb - j) <= 1
}

// The exact input className both auth pages used inline — error state flips the border.
export const authFieldClass = (hasError) =>
  `auth-input w-full border dark:bg-gray-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
    hasError
      ? 'border-red-400 dark:border-red-500'
      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
  }`
