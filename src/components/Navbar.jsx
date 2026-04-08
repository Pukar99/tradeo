import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-xl font-bold text-blue-400">Tradeo</Link>
      <ul className="flex gap-6 list-none">
        <li><Link to="/" className="text-gray-300 hover:text-white hover:underline text-sm">Home</Link></li>
        <li><Link to="/analysis" className="text-gray-300 hover:text-white hover:underline text-sm">Analysis</Link></li>
        <li><Link to="/portfolio" className="text-gray-300 hover:text-white hover:underline text-sm">Portfolio</Link></li>
      </ul>
    </nav>
  )
}

export default Navbar