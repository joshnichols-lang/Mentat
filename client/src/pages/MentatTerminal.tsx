import { useState } from "react";
import { TuiPanel } from "@/components/tui/TuiPanel";
import { SidebarTree, type TreeNode } from "@/components/tui/SidebarTree";
import { TerminalInput } from "@/components/tui/TerminalInput";
import { OrderBook, type OrderBookRow } from "@/components/tui/OrderBook";
import { SplineChart, type DataPoint } from "@/components/tui/SplineChart";
import { Activity, TrendingUp, Zap, Database, Settings } from "lucide-react";

// Mock data for demonstration
const mockChartData: DataPoint[] = Array.from({ length: 50 }, (_, i) => ({
  x: i,
  y: 50000 + Math.sin(i / 5) * 2000 + Math.random() * 1000,
}));

const mockBids: OrderBookRow[] = Array.from({ length: 15 }, (_, i) => ({
  price: 50000 - i * 10,
  size: Math.random() * 2,
  total: (50000 - i * 10) * Math.random() * 2,
  side: "buy" as const,
}));

const mockAsks: OrderBookRow[] = Array.from({ length: 15 }, (_, i) => ({
  price: 50010 + i * 10,
  size: Math.random() * 2,
  total: (50010 + i * 10) * Math.random() * 2,
  side: "sell" as const,
}));

const navigationTree: TreeNode[] = [
  {
    label: "MARKETS",
    icon: "📊",
    children: [
      { label: "BTC/USD", path: "/market/btc" },
      { label: "ETH/USD", path: "/market/eth" },
      { label: "SOL/USD", path: "/market/sol" },
    ],
  },
  {
    label: "TRADING",
    icon: "⚡",
    children: [
      { label: "Perpetuals", path: "/perpetuals" },
      { label: "Prediction", path: "/prediction" },
      { label: "Options", path: "/options" },
    ],
  },
  {
    label: "PORTFOLIO",
    icon: "💼",
    children: [
      { label: "Positions", path: "/positions" },
      { label: "Analytics", path: "/analytics" },
      { label: "History", path: "/history" },
    ],
  },
  {
    label: "SYSTEM",
    icon: "⚙️",
    children: [
      { label: "Settings", path: "/settings" },
      { label: "API Keys", path: "/api-keys" },
      { label: "Logs", path: "/logs" },
    ],
  },
];

export default function MentatTerminal() {
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  
  const handleCommand = (command: string) => {
    console.log("[MENTAT]", command);
    setTerminalHistory(prev => [...prev, `> ${command}`, `Executing: ${command}...`]);
  };
  
  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex flex-col">
      {/* Top status bar */}
      <div className="border-b border-primary px-4 py-1 flex items-center justify-between bg-background/95">
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="text-primary font-bold tracking-widest">MENTAT v1.0.0</span>
          <span className="text-primary/50">│</span>
          <span className="text-foreground">SESSION: <span className="text-secondary">ACTIVE</span></span>
          <span className="text-primary/50">│</span>
          <span className="text-foreground">LATENCY: <span className="text-success">12ms</span></span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <Activity size={12} className="text-success animate-pulse" />
          <span className="text-foreground">LIVE</span>
        </div>
      </div>
      
      {/* Main grid layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - navigation */}
        <div className="w-64 border-r border-primary flex flex-col">
          <TuiPanel title="NAVIGATION" className="flex-1 border-0 border-b">
            <SidebarTree nodes={navigationTree} />
          </TuiPanel>
          
          <TuiPanel title="SYSTEM STATUS" className="border-0">
            <div className="space-y-1 text-[10px] font-mono">
              <div className="flex justify-between">
                <span className="text-foreground/70">CPU:</span>
                <span className="text-success">24%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">MEM:</span>
                <span className="text-success">1.2GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">NET:</span>
                <span className="text-success">45KB/s</span>
              </div>
            </div>
          </TuiPanel>
        </div>
        
        {/* Center - main chart area */}
        <div className="flex-1 flex flex-col">
          <TuiPanel title="BTC/USD - PERPETUAL" className="flex-1 border-0 border-b">
            <div className="h-full flex flex-col">
              {/* Price ticker */}
              <div className="flex items-baseline gap-4 mb-4 pb-2 border-b border-primary/30">
                <div className="text-2xl font-mono text-success">
                  $50,234.50
                </div>
                <div className="text-sm text-success">
                  +2.34%
                </div>
                <div className="text-[10px] text-foreground/50 ml-auto">
                  24H VOL: $1.2B
                </div>
              </div>
              
              {/* Chart */}
              <div className="flex-1 flex items-center justify-center">
                <SplineChart 
                  data={mockChartData} 
                  width={800} 
                  height={400} 
                  color="#00ffff"
                />
              </div>
            </div>
          </TuiPanel>
          
          {/* Bottom stats bar */}
          <div className="grid grid-cols-4 gap-2 p-2 border-t border-primary bg-background/50">
            {[
              { label: "OPEN", value: "$49,823", icon: <TrendingUp size={12} /> },
              { label: "HIGH", value: "$50,445", icon: <Zap size={12} /> },
              { label: "LOW", value: "$49,102", icon: <Database size={12} /> },
              { label: "FUNDING", value: "0.0083%", icon: <Settings size={12} /> },
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-primary">{stat.icon}</span>
                <div>
                  <div className="text-foreground/50">{stat.label}</div>
                  <div className="text-foreground font-bold">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Right sidebar - order book */}
        <div className="w-80 border-l border-primary">
          <TuiPanel title="ORDER BOOK" className="h-full border-0" noPadding>
            <div className="p-2 h-full overflow-y-auto">
              <OrderBook bids={mockBids} asks={mockAsks} maxRows={15} />
            </div>
          </TuiPanel>
        </div>
      </div>
      
      {/* Bottom terminal */}
      <div className="h-40 border-t border-primary flex flex-col">
        <TuiPanel title="AI TERMINAL" className="flex-1 border-0 flex flex-col" noPadding>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1">
            {terminalHistory.map((line, idx) => (
              <div key={idx} className="text-primary">
                {line}
              </div>
            ))}
            {terminalHistory.length === 0 && (
              <div className="text-primary/30">
                [ MENTAT AI READY ] Type commands or queries...
              </div>
            )}
          </div>
          <TerminalInput 
            onSubmit={handleCommand} 
            placeholder="ENTER COMMAND OR QUERY..."
          />
        </TuiPanel>
      </div>
    </div>
  );
}
