import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrderEntryPanel from "@/components/OrderEntryPanel";
import PositionsGrid from "@/components/PositionsGrid";
import RecentTrades from "@/components/RecentTrades";
import { TrendingUp, Layers, Clock } from "lucide-react";

interface TradingActionsPanelProps {
  symbol: string;
  lastPrice?: number;
}

export default function TradingActionsPanel({ symbol, lastPrice }: TradingActionsPanelProps) {
  const [activeTab, setActiveTab] = useState("entry");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <TabsList className="grid grid-cols-3 w-full shrink-0">
        <TabsTrigger value="entry" className="text-xs" data-testid="tab-order-entry">
          <TrendingUp className="h-3 w-3 mr-1" />
          Order
        </TabsTrigger>
        <TabsTrigger value="positions" className="text-xs" data-testid="tab-positions">
          <Layers className="h-3 w-3 mr-1" />
          Positions
        </TabsTrigger>
        <TabsTrigger value="trades" className="text-xs" data-testid="tab-recent-trades">
          <Clock className="h-3 w-3 mr-1" />
          Trades
        </TabsTrigger>
      </TabsList>

      <TabsContent value="entry" className="flex-1 overflow-auto mt-0">
        <OrderEntryPanel symbol={symbol} lastPrice={lastPrice} />
      </TabsContent>

      <TabsContent value="positions" className="flex-1 overflow-auto mt-0">
        <PositionsGrid />
      </TabsContent>

      <TabsContent value="trades" className="flex-1 overflow-auto mt-0">
        <RecentTrades symbol={symbol} />
      </TabsContent>
    </Tabs>
  );
}
