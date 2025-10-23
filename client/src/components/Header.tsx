import { LogOut, UserCheck, Settings, Users, ChevronDown, MessageSquare, History, BookOpen, Target, Home, BarChart3, AlertTriangle, LineChart } from "lucide-react";
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
import AgentModeToggle from "./AgentModeToggle";
import { ContactAdmin } from "./ContactAdmin";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import logoUrl from "@assets/generated-image-removebg-preview_1760665535887.png";

export default function Header() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  
  const { data: userState, error: userStateError, isLoading: userStateLoading } = useQuery<any>({
    queryKey: ['/api/hyperliquid/user-state'],
    refetchInterval: 30000,
    retry: 1, // Only retry once
  });

  const accountValue = (userState?.userState?.marginSummary?.accountValue as number) || 0;
  const withdrawable = (userState?.userState?.withdrawable as number) || 0;
  const hasError = userStateError || (userState && !userState.success);
  
  // Calculate if free margin is critically low
  const freeMarginThreshold = Math.max(5, accountValue * 0.01); // $5 or 1% of portfolio
  const isLowFreeMargin = withdrawable < freeMarginThreshold && accountValue > 0;
  
  // Log balance info for debugging
  useEffect(() => {
    if (userStateError) {
      console.error('[Balance] Failed to fetch user state:', userStateError);
    } else if (userState) {
      console.log('[Balance] User state response:', userState);
      if (!userState.success) {
        console.error('[Balance] API returned error:', userState.error);
      }
      console.log('[Balance] Portfolio:', accountValue, 'Free Margin:', withdrawable, 'Has error:', hasError);
    }
  }, [userState, userStateError, accountValue, withdrawable, hasError]);

  return (
    <header className="border-b px-6 py-3">
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-right border-l pl-3">
                  {userStateLoading ? (
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  ) : hasError ? (
                    <div className="text-xs text-destructive">Error</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs text-muted-foreground">Portfolio</div>
                        {isLowFreeMargin && (
                          <Badge 
                            variant="outline" 
                            className="h-4 px-1 text-[10px] border-destructive text-destructive"
                            data-testid="badge-free-margin-warning"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-sm font-semibold" data-testid="text-portfolio">
                        ${accountValue.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Free Margin</div>
                      <div 
                        className={`font-mono text-xs font-semibold ${isLowFreeMargin ? 'text-destructive' : ''}`}
                        data-testid="text-free-margin"
                      >
                        ${withdrawable.toFixed(2)}
                      </div>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">Understanding Your Balance</p>
                  <p className="text-xs">
                    <span className="font-semibold">Portfolio:</span> Total account equity including open positions and unrealized P&L.
                  </p>
                  <p className="text-xs">
                    <span className="font-semibold">Free Margin:</span> Available capital for opening new positions. This is your withdrawable balance minus margin used by existing positions.
                  </p>
                  {isLowFreeMargin && (
                    <p className="text-xs text-destructive font-semibold mt-2">
                      Low free margin! Close positions or cancel orders to free up capital.
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setContactDialogOpen(true)}
            data-testid="button-contact-admin"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/dex")}
            data-testid="button-dex-trading"
          >
            <LineChart className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/trade-history")}
            data-testid="button-trade-history"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/trade-journal")}
            data-testid="button-trade-journal"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/trading-modes")}
            data-testid="button-trading-modes"
          >
            <Target className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/settings")}
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            data-testid="button-logout"
            onClick={() => window.location.href = '/api/logout'}
          >
            <LogOut className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <ContactAdmin open={contactDialogOpen} onOpenChange={setContactDialogOpen} />
    </header>
  );
}
