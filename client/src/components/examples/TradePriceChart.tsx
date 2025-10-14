import TradePriceChart from '../TradePriceChart'

export default function TradePriceChartExample() {
  return (
    <TradePriceChart 
      symbol="BTC"
      entryPrice={42100}
      entryTime="2025-01-14 14:32"
      side="long"
    />
  )
}
