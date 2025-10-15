import { Activity, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "./ThemeToggle";
import { useQuery } from "@tanstack/react-query";

export default function Header() {
  const { data: userState } = useQuery<any>({
    queryKey: ['/api/hyperliquid/user-state'],
    refetchInterval: 5000,
  });

  const accountValue = (userState?.userState?.marginSummary?.accountValue as number) || 0;

  return (
    <header className="border-b px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">AI Terminal</h1>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs" data-testid="status-connection">
            <div className="h-1.5 w-1.5 rounded-full bg-chart-2 animate-pulse" />
            Connected
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="font-mono text-sm font-semibold" data-testid="text-balance">
              ${accountValue.toFixed(2)}
            </div>
          </div>
          <Button variant="ghost" size="icon" data-testid="button-wallet">
            <Wallet className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
