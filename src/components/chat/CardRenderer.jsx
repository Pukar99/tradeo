import ChartCard from './ChartCard'
import { cardRenderMode, cardFallbackText } from './cardKind'

// Renders a structured chat card by kind. Unknown/missing kind → graceful text fallback
// (the card's reply string), so the chat never crashes on a card it doesn't understand.
export default function CardRenderer({ card }) {
  if (!card) return null
  const mode = cardRenderMode(card)
  if (mode === 'candlestick') return <ChartCard card={card} />
  return <div className="text-sm text-gray-700 dark:text-gray-200">{cardFallbackText(card)}</div>
}
