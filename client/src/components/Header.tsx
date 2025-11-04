import { LogOut, UserCheck, Settings, Users, ChevronDown, MessageSquare, History, BookOpen, Target, Home, BarChart3, LineChart, ArrowDownToLine, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "./ThemeToggle";
import ThemeSelector from "./ThemeSelector";
import AgentModeToggle from "./AgentModeToggle";
import ChainSwitcher from "./ChainSwitcher";
import { ContactAdmin } from "./ContactAdmin";
import { DepositModal } from "./DepositModal";
import { MyWalletsModal } from "./MyWalletsModal";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState } from "react";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";

export default function Header() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [walletsModalOpen, setWalletsModalOpen] = useState(false);

  return (
    <header className="glass-header px-6 py-3 sticky top-0 z-50">
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
            onClick={() => window.open("https://dex.orderly.network/1fox-4617/perp/PERP_ETH_USDC", "_blank")}
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
          <ThemeSelector />
          <ThemeToggle />
        </div>
      </div>
      <ContactAdmin open={contactDialogOpen} onOpenChange={setContactDialogOpen} />
      <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
      <MyWalletsModal open={walletsModalOpen} onOpenChange={setWalletsModalOpen} />
    </header>
  );
}
