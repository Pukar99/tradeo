import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 text-center">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <p className="text-xl text-gray-500 mb-6">Page not found</p>
      <Link to="/" className="text-blue-600 hover:underline">
        Go back to Home
      </Link>
    </div>
  )
}

export default NotFoundPage