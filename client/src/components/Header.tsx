import { LogOut, UserCheck, Settings, Users, ChevronDown, MessageSquare, History, BookOpen, Target, Home, BarChart3, LineChart, ArrowDownToLine, Wallet, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ThemeToggle from "./ThemeToggle";
import ThemeSelector from "./ThemeSelector";
import AgentModeToggle from "./AgentModeToggle";
import ChainSwitcher from "./ChainSwitcher";
import { DepositModal } from "./DepositModal";
import { MyWalletsModal } from "./MyWalletsModal";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { useDisconnect } from "wagmi";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";
import { HyperliquidExpirationWarning } from "./HyperliquidExpirationWarning";

export default function Header() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [walletsModalOpen, setWalletsModalOpen] = useState(false);
  const { disconnect } = useDisconnect();

  const handleLogout = async () => {
    try {
      console.log('[Logout] Starting logout process...');
      
      // 1. Disconnect RainbowKit wallet
      disconnect();
      console.log('[Logout] Wallet disconnected');
      
      // 2. Clear RainbowKit localStorage cache
      const rainbowKitKeys = [
        'wagmi.store',
        'wagmi.cache',
        'wagmi.wallet',
        'wagmi.connected',
        'wagmi.recentConnectorId',
        'rainbowkit.recentWallet',
        'walletconnect'
      ];
      
      rainbowKitKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error(`[Logout] Error removing ${key}:`, e);
        }
      });
      
      // Clear all localStorage keys that start with wagmi or rainbowkit
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('wagmi.') || key.startsWith('rainbowkit.') || key.includes('walletconnect')) {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.error(`[Logout] Error removing ${key}:`, e);
          }
        }
      });
      
      console.log('[Logout] Cleared wallet cache from localStorage');
      
      // 3. Call backend logout endpoint (which destroys session and clears cookies)
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      console.log('[Logout] Backend session destroyed');
      
      // 4. Redirect to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('[Logout] Error during logout:', error);
      // Still redirect even if there's an error
      window.location.href = '/auth';
    }
  };

  return (
    <>
      <HyperliquidExpirationWarning />
      <header className="bg-background border-b border-border/50 px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-2 cursor-pointer hover-elevate active-elevate-2 px-2 py-1 rounded-md -ml-2" 
            onClick={() => setLocation("/")}
            data-testid="link-logo-home"
          >
            <img src={logoUrl} alt="1fox logo" className="h-6 w-6" />
            <h1 className="text-lg font-bold">1fox</h1>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs" data-testid="status-connection">
            <div className="h-1.5 w-1.5 rounded-full bg-chart-2 animate-pulse" />
            Connected
          </Badge>
        </div>
        
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/")}
              data-testid="button-dashboard"
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <AgentModeToggle />
            {user?.role === "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid="button-admin-menu"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Admin
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setLocation("/admin")}
                    data-testid="menu-item-admin-dashboard"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation("/admin/verification")}
                    data-testid="menu-item-verification"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Verify Users
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation("/admin/users")}
                    data-testid="menu-item-users"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation("/admin/messages")}
                    data-testid="menu-item-messages"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Messages
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ChainSwitcher />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDepositModalOpen(true)}
              data-testid="button-deposit"
            >
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Deposit
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/wallet")}
              data-testid="button-wallet"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Wallet
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => window.open("https://dex.orderly.network/1fox-4617/perp/PERP_ETH_USDC", "_blank")}
                  data-testid="button-dex-trading"
                >
                  <LineChart className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Orderly DEX Trading</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation("/trade-history")}
                  data-testid="button-trade-history"
                >
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Trade History</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation("/trade-journal")}
                  data-testid="button-trade-journal"
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Trade Journal</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation("/trading-modes")}
                  data-testid="button-trading-modes"
                >
                  <Target className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Trading Modes</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation("/strategies")}
                  data-testid="button-strategies"
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Strategies</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation("/settings")}
                  data-testid="button-settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  data-testid="button-logout"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Logout</p>
              </TooltipContent>
            </Tooltip>
            <ThemeSelector />
            <ThemeToggle />
          </div>
        </TooltipProvider>
      </div>
        <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
        <MyWalletsModal open={walletsModalOpen} onOpenChange={setWalletsModalOpen} />
      </header>
    </>
  );
}
