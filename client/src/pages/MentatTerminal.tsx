import { useState, useEffect, useRef } from "react";
import { TuiPanel } from "@/components/tui/TuiPanel";
import { SidebarTree, type TreeNode } from "@/components/tui/SidebarTree";
import { OrderBook, type OrderBookRow } from "@/components/tui/OrderBook";
import TradingChart from "@/components/TradingChart";
import { ChevronDown, Search } from "lucide-react";

// Mock order book data
const mockBids: OrderBookRow[] = Array.from({ length: 20 }, (_, i) => ({
  price: 98445 - i * 5,
  size: Math.random() * 2,
  total: (98445 - i * 5) * Math.random() * 2,
  side: "buy" as const,
}));

const mockAsks: OrderBookRow[] = Array.from({ length: 20 }, (_, i) => ({
  price: 98450 + i * 5,
  size: Math.random() * 2,
  total: (98450 + i * 5) * Math.random() * 2,
  side: "sell" as const,
}));

// Navigation tree for EXPLORER
const explorerTree: TreeNode[] = [
  {
    label: "MARKETS",
    children: [
      { label: "BTC-USD", path: "/market/btc" },
      { label: "ETH-USD", path: "/market/eth" },
      { label: "SOL-USD", path: "/market/sol" },
      { label: "XRP-USD", path: "/market/xrp" },
    ],
  },
  {
    label: "WALLET",
    children: [
      { label: "Overview", path: "/wallet" },
      { label: "Deposits", path: "/wallet/deposits" },
      { label: "Withdrawals", path: "/wallet/withdrawals" },
    ],
  },
  {
    label: "POSITIONS",
    children: [
      { label: "Active", path: "/positions/active" },
      { label: "Closed", path: "/positions/closed" },
    ],
  },
];

// Terminal typing effect component
function TerminalTyping({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");
    
    const timer = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(prev => prev + text[indexRef.current]);
        indexRef.current++;
      } else {
        clearInterval(timer);
        onComplete?.();
      }
    }, 30);

    return () => clearInterval(timer);
  }, [text, onComplete]);

  return <span className="text-success">{displayed}<span className="animate-pulse">_</span></span>;
}

export default function MentatTerminal() {
  const [terminalLines, setTerminalLines] = useState<Array<{ text: string; typing: boolean }>>([
    { text: "Mentat v2.0.3 connected to mainnet...", typing: true },
    { text: "System check: OK", typing: false },
    { text: "Loading modules: [Mainnet, Wallet, AI]... DONE", typing: false },
  ]);
  const [commandInput, setCommandInput] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState("98,445.00");
  const [size, setSize] = useState("0.5");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && commandInput.trim()) {
      setTerminalLines(prev => [
        ...prev,
        { text: `$ ${commandInput}`, typing: false },
        { text: `Processing: ${commandInput}...`, typing: true },
      ]);
      setCommandInput("");
    }
  };

  return (
    <div className="mentat-terminal dark h-screen w-screen overflow-hidden bg-background flex flex-col font-mono text-xs">
      {/* Top navigation bar */}
      <div className="border-b border-primary px-3 py-1.5 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <button className="text-primary hover-elevate px-2 py-0.5" data-testid="button-nav-mentat">
            MENTAT_TERM
          </button>
          <button className="text-foreground/70 hover:text-foreground hover-elevate px-2 py-0.5" data-testid="button-nav-system">
            SYSTEM
          </button>
          <button className="text-foreground/70 hover:text-foreground hover-elevate px-2 py-0.5" data-testid="button-nav-view">
            VIEW
          </button>
          <button className="text-foreground/70 hover:text-foreground hover-elevate px-2 py-0.5" data-testid="button-nav-trade">
            TRADE
          </button>
          <button className="text-foreground/70 hover:text-foreground hover-elevate px-2 py-0.5" data-testid="button-nav-wallets">
            WALLETS
          </button>
          <button className="text-foreground/70 hover:text-foreground hover-elevate px-2 py-0.5" data-testid="button-nav-help">
            HELP
          </button>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            ONLINE
          </span>
          <span>NET: MAIN</span>
          <button className="text-foreground/70 hover:text-foreground" data-testid="button-theme-toggle">LIGHT</button>
        </div>
      </div>

      {/* Main grid - 3 columns, 2 rows */}
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] grid-rows-[1fr_240px] overflow-hidden">
        {/* LEFT COLUMN - EXPLORER (spans 2 rows) */}
        <div className="border-r border-primary row-span-2 flex flex-col overflow-hidden">
          <TuiPanel title="▸ EXPLORER" className="flex-1 border-0 flex flex-col overflow-hidden" noPadding>
            {/* Search box */}
            <div className="p-2 border-b border-primary/30">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground/50" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full bg-background border border-primary/50 px-6 py-1 text-[10px] text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary"
                  data-testid="input-explorer-search"
                />
              </div>
            </div>

            {/* Markets tree */}
            <div className="flex-1 overflow-y-auto p-2">
              <SidebarTree nodes={explorerTree} />
            </div>
          </TuiPanel>
        </div>

        {/* CENTER TOP - CHART */}
        <div className="border-r border-primary border-b border-primary flex flex-col overflow-hidden">
          {/* Chart header */}
          <div className="border-b border-primary px-3 py-1.5 flex items-baseline gap-3">
            <div className="flex items-center gap-1">
              <span className="text-primary font-bold">▸ BTC/USD 4H</span>
              <ChevronDown className="w-3 h-3 text-primary" />
            </div>
            <div className="flex gap-4 text-[10px]">
              <span className="text-foreground/70">VOL: <span className="text-foreground">24,592 BTC</span></span>
              <span className="text-foreground/70">HIGH: <span className="text-success">99,200.00</span></span>
              <span className="text-foreground/70">LOW: <span className="text-destructive">97,000.00</span></span>
            </div>
          </div>

          {/* Price display */}
          <div className="px-3 py-2 border-b border-primary/30 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">98,445.00</span>
            <span className="text-sm text-foreground/70">USD</span>
          </div>

          {/* Chart area */}
          <div className="flex-1 overflow-hidden p-2">
            <TradingChart symbol="BTC" />
          </div>
        </div>

        {/* RIGHT TOP - DEPTH (Order Book) */}
        <div className="border-b border-primary overflow-hidden">
          <TuiPanel title="▸ DEPTH" className="h-full border-0 flex flex-col" noPadding>
            <div className="flex-1 overflow-y-auto p-2">
              <OrderBook bids={mockBids} asks={mockAsks} maxRows={20} />
            </div>
          </TuiPanel>
        </div>

        {/* CENTER BOTTOM - SYSTEM_LOG */}
        <div className="border-r border-primary overflow-hidden">
          <TuiPanel title="▸ SYSTEM_LOG" className="h-full border-0 flex flex-col" noPadding>
            {/* Terminal output */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-[10px] leading-relaxed">
              {terminalLines.map((line, idx) => (
                <div key={idx} className="text-foreground">
                  {line.typing && idx === terminalLines.length - 1 ? (
                    <TerminalTyping text={line.text} />
                  ) : (
                    <span className={line.text.startsWith('$') ? 'text-primary' : 'text-success'}>
                      {line.text}
                    </span>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Command input */}
            <div className="border-t border-primary p-2">
              <div className="flex items-center gap-2">
                <span className="text-primary">$</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={handleCommand}
                  placeholder="Enter system command..."
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-foreground/30 text-[10px]"
                  data-testid="input-system-command"
                  autoFocus
                />
              </div>
            </div>
          </TuiPanel>
        </div>

        {/* RIGHT BOTTOM - EXECUTION */}
        <div className="overflow-hidden">
          <TuiPanel title="▸ EXECUTION" className="h-full border-0 flex flex-col" noPadding>
            {/* Order type tabs */}
            <div className="flex border-b border-primary">
              <button
                onClick={() => setOrderType("LIMIT")}
                className={`flex-1 py-1.5 text-center text-[10px] border-r border-primary ${
                  orderType === "LIMIT" ? "bg-primary/10 text-primary" : "text-foreground/70 hover:text-foreground"
                }`}
                data-testid="button-order-type-limit"
              >
                LIMIT
              </button>
              <button
                onClick={() => setOrderType("MARKET")}
                className={`flex-1 py-1.5 text-center text-[10px] ${
                  orderType === "MARKET" ? "bg-primary/10 text-primary" : "text-foreground/70 hover:text-foreground"
                }`}
                data-testid="button-order-type-market"
              >
                MARKET
              </button>
            </div>

            {/* Order form */}
            <div className="flex-1 p-3 space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] text-foreground/70 uppercase">PRICE</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground/50">$</span>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-background border border-primary/50 pl-6 pr-2 py-1.5 text-foreground font-mono text-sm focus:outline-none focus:border-primary"
                    disabled={orderType === "MARKET"}
                    data-testid="input-order-price"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-foreground/70 uppercase">SIZE</label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full bg-background border border-primary/50 px-2 py-1.5 text-foreground font-mono text-sm focus:outline-none focus:border-primary"
                  data-testid="input-order-size"
                />
              </div>

              {/* Buy/Sell buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  className="bg-success/20 border border-success text-success py-2 hover:bg-success/30 active-press"
                  data-testid="button-order-buy"
                >
                  BUY
                </button>
                <button
                  className="bg-destructive/20 border border-destructive text-destructive py-2 hover:bg-destructive/30 active-press"
                  data-testid="button-order-sell"
                >
                  SELL
                </button>
              </div>
            </div>
          </TuiPanel>
        </div>
      </div>
    </div>
  );
}
