import { Activity, Wallet, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Header() {
  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">AI Terminal</h1>
          </div>
          <Badge variant="outline" className="gap-1.5" data-testid="status-connection">
            <div className="h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
            Connected to Lighter.xyz
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Account Balance</div>
            <div className="text-lg font-mono font-semibold" data-testid="text-balance">
              $12,450.00
            </div>
          </div>
          <Button variant="outline" size="icon" data-testid="button-wallet">
            <Wallet className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
