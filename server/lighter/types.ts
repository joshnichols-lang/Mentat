export interface LighterConfig {
  baseUrl: string;
  apiKeyPrivateKey: string;
  accountIndex: number;
  apiKeyIndex: number;
}

export interface Market {
  marketIndex: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface Order {
  orderId: string;
  marketIndex: number;
  clientOrderIndex: number;
  side: "buy" | "sell";
  orderType: string;
  price: string;
  amount: string;
  filledAmount: string;
  status: string;
}

export interface Position {
  marketIndex: number;
  symbol: string;
  side: "long" | "short";
  size: string;
  entryPrice: string;
  liquidationPrice: string;
  unrealizedPnl: string;
  leverage: number;
}

export interface AccountInfo {
  accountIndex: number;
  l1Address: string;
  positions: Position[];
  orders: Order[];
  equity: string;
  availableBalance: string;
}

export interface CreateOrderParams {
  marketIndex: number;
  side: "buy" | "sell";
  orderType: "limit" | "market";
  amount: string;
  price?: string;
  leverage?: number;
  clientOrderIndex?: number;
}

export interface MarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
  high24h?: string;
  low24h?: string;
}
