// === Avatar.jsx — research author avatar + shared post-date formatter ===
// Moved verbatim from the identical copies in ResearchPage/ResearchViewPage.
// Default size is the ResearchPage default; ResearchViewPage always passes size explicitly.

import { useState } from 'react'

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Avatar({ person, size = 'w-7 h-7' }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0 overflow-hidden`}
    >
      {person?.avatar_url && !imgError ? (
        <img
          src={person.avatar_url}
          alt={person.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-white text-[10px] font-bold">
          {person?.name?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
  )
}
