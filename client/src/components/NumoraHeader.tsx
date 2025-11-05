import { Search, Bell, ChevronDown, Settings, LogOut, Wallet, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { useDisconnect } from "wagmi";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";
import { DepositModal } from "./DepositModal";
import { MyWalletsModal } from "./MyWalletsModal";

/**
 * NumoraHeader - Clean header matching Numora design reference
 * Features: Search bar, navigation tabs, profile section
 */
export default function NumoraHeader() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [walletsModalOpen, setWalletsModalOpen] = useState(false);
  const { disconnect } = useDisconnect();

  const handleLogout = async () => {
    try {
      disconnect();
      localStorage.clear();
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/auth';
    } catch (error) {
      console.error('[Logout] Error:', error);
      window.location.href = '/auth';
    }
  };

  const tabs = [
    { name: "AI Signals", path: "/" },
    { name: "Stake", path: "/stake" },
    { name: "Portfolio", path: "/portfolio" },
    { name: "Smart Alerts", path: "/alerts" }
  ];

  return (
    <>
      <header className="bg-background border-b border-border/50 px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer hover-elevate active-elevate-2 px-2 py-1 rounded-md -ml-2" 
            onClick={() => setLocation("/")}
            data-testid="link-logo-home"
          >
            <img src={logoUrl} alt="1fox logo" className="h-6 w-6" />
            <h1 className="text-lg font-bold">1fox</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              type="text"
              placeholder="Search any token"
              className="w-full bg-secondary border border-border/50 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
              data-testid="input-search-token"
            />
            <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-foreground/40 px-1.5 py-0.5 bg-foreground/5 rounded border border-border/30">/</kbd>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.path}
                onClick={() => setLocation(tab.path)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  location === tab.path 
                    ? 'text-foreground bg-foreground/10' 
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                }`}
                data-testid={`button-tab-${tab.name.toLowerCase().replace(' ', '-')}`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Notification Bell */}
            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2" data-testid="button-profile-menu">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {user?.walletAddress?.[0]?.toUpperCase() || 'W'}
                  </div>
                  <span className="text-sm font-medium">
                    {user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'Wallet'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-foreground/60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setDepositModalOpen(true)} data-testid="menu-item-deposit">
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Deposit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWalletsModalOpen(true)} data-testid="menu-item-wallets">
                  <Wallet className="h-4 w-4 mr-2" />
                  My Wallets
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="menu-item-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Modals */}
      <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
      <MyWalletsModal open={walletsModalOpen} onOpenChange={setWalletsModalOpen} />
    </>
  );
}
