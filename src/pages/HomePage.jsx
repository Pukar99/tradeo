import MarketSummary from '../components/MarketSummary'
import StockCard from '../components/StockCard'
import NEPSEIndex from '../components/NEPSEIndex'

function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Welcome to Tradeo
      </h1>
      <NEPSEIndex />
      <div className="mt-6">
        <MarketSummary />
      </div>
      <div className="flex justify-between items-center mb-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-900">Top Stocks Today</h2>
        <span className="text-sm text-blue-600">View All →</span>
      </div>
      <div className="flex gap-4">
        <StockCard name="NABIL Bank"    symbol="NABIL" price="1,200" change={2.5}  volume="12,500" sector="Banking" />
        <StockCard name="NIC ASIA Bank" symbol="NICA"  price="890"   change={-1.2} volume="8,200"  sector="Banking" />
        <StockCard name="HDFC Bank"     symbol="HDFCB" price="2,100" change={0.8}  volume="15,800" sector="Banking" />
      </div>
      <p className="text-sm text-gray-500">Built by Pukar Sharma</p>
    </div>
  )
}

export default HomePage