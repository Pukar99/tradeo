import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-xl font-bold text-blue-400">Tradeo</Link>
      <ul className="flex gap-6 list-none items-center">
        <li>
          <Link to="/" className="text-gray-300 hover:text-white hover:underline text-sm">
            Home
          </Link>
        </li>
        <li>
          <Link to="/analysis" className="text-gray-300 hover:text-white hover:underline text-sm">
            Analysis
          </Link>
        </li>
        <li>
          <Link to="/trader" className="text-gray-300 hover:text-white hover:underline text-sm">
            Trader
          </Link>
        </li>
        <li>
          <Link to="/portfolio" className="text-gray-300 hover:text-white hover:underline text-sm">
            Portfolio
          </Link>
        </li>
        {user ? (
          <>
            <li className="text-gray-300 text-sm">
              Hi, {user.name}
            </li>
            <li>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700"
              >
                Logout
              </button>
            </li>
          </>
        ) : (
          <li>
            <Link
              to="/login"
              className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700"
            >
              Login
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

export default Navbar