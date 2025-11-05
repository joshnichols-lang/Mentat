import OrderEntryPanel from "@/components/OrderEntryPanel";

interface TradingActionsPanelProps {
  symbol: string;
  lastPrice?: number;
}

export default function TradingActionsPanel({ symbol, lastPrice }: TradingActionsPanelProps) {
  return (
    <div className="flex h-full min-h-0">
      <OrderEntryPanel symbol={symbol} lastPrice={lastPrice} />
    </div>
  );
}
