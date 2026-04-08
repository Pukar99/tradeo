import { useState } from 'react'

function StockCard({ name, symbol, price, change, volume, sector }) {
  const [watching, setWatching] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 w-52 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-gray-500">Symbol: {symbol}</p>
      <p className="text-sm text-gray-500">Sector: {sector}</p>
      <p className="text-xl font-bold text-gray-900 mt-2">Rs. {price}</p>
      <p className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {change >= 0 ? '▲' : '▼'} {change}%
      </p>
      <p className="text-sm text-gray-500">Vol: {volume}</p>
      <button
        onClick={() => setWatching(!watching)}
        className={`mt-3 w-full py-1 rounded-lg text-sm font-medium border transition-colors
          ${watching
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-blue-600 border-blue-600'
          }`}
      >
        {watching ? 'Watching' : 'Watch'}
      </button>
    </div>
  )
}

export default StockCard