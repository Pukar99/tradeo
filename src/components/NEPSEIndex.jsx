import { useState } from 'react'

const STARTING_INDEX = 2100

function NEPSEIndex() {
  const [index, setIndex] = useState(STARTING_INDEX)
  const [count, setCount] = useState(0)

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm w-52">
      <h3 className="text-lg font-semibold text-gray-900">NEPSE Index</h3>
      <h1 className={`text-4xl font-bold mt-1 ${index >= STARTING_INDEX ? 'text-green-500' : 'text-red-500'}`}>
        {index}
      </h1>
      <p className="text-sm text-gray-500 mt-1">Moves: {count}</p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => { setIndex(index + 10); setCount(count + 1) }}
          className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-medium"
        >
          UP
        </button>
        <button
          onClick={() => { setIndex(index - 10); setCount(count + 1) }}
          className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-medium"
        >
          DOWN
        </button>
        <button
          onClick={() => { setIndex(STARTING_INDEX); setCount(0) }}
          className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium"
        >
          RESET
        </button>
      </div>
    </div>
  )
}

export default NEPSEIndex