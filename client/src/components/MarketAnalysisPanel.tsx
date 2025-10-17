import { useState } from "react";
import { TradingPairSelector } from "./TradingPairSelector";
import { PriceVolumeChart } from "./PriceVolumeChart";
import { CvdSubchart } from "./CvdSubchart";
import { OrderBook } from "./OrderBook";

export function MarketAnalysisPanel() {
  const [selectedPair, setSelectedPair] = useState("BTC");

  return (
    <div className="space-y-4">
      {/* Trading Pair Selector */}
      <div className="flex items-center gap-4">
        <TradingPairSelector 
          value={selectedPair} 
          onChange={setSelectedPair} 
        />
      </div>

      {/* Main Chart Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Price & Volume Profile Chart */}
          <PriceVolumeChart coin={selectedPair} />
          
          {/* CVD Subchart */}
          <CvdSubchart coin={selectedPair} />
        </div>

        {/* Right Column: Order Book */}
        <div className="lg:col-span-1">
          <OrderBook coin={selectedPair} />
        </div>
      </div>
    </div>
  );
}
