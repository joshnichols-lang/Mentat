import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "./ThemeToggle";
import AgentModeToggle from "./AgentModeToggle";
import { useQuery } from "@tanstack/react-query";
import logoUrl from "@assets/generated-image_1760664087548.png";

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
            <img src={logoUrl} alt="1fox logo" className="h-6 w-6" />
            <h1 className="text-lg font-bold">1fox</h1>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs" data-testid="status-connection">
            <div className="h-1.5 w-1.5 rounded-full bg-chart-2 animate-pulse" />
            Connected
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <AgentModeToggle />
          <div className="text-right border-l pl-3">
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
