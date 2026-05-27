// === NotFoundPage.jsx ===
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 gap-4">
      <h1 className="text-8xl font-bold text-gray-200 dark:text-gray-800 animate-fade-up select-none">
        404
      </h1>
      <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Page not found</p>
        <p className="text-sm text-gray-400 mt-1">This page doesn't exist or was moved.</p>
      </div>
      <Link
        to="/"
        className="animate-fade-up mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all duration-150"
        style={{ animationDelay: '160ms' }}
      >
        Back to Home
      </Link>
    </div>
  )
}

export default NotFoundPage
