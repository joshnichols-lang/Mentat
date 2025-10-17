import { Wallet, LogOut, UserCheck, Settings, Users, ChevronDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "./ThemeToggle";
import AgentModeToggle from "./AgentModeToggle";
import { ContactAdmin } from "./ContactAdmin";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState } from "react";
import logoUrl from "@assets/generated-image-removebg-preview_1760665535887.png";

export default function Header() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  
  const { data: userState } = useQuery<any>({
    queryKey: ['/api/hyperliquid/user-state'],
    refetchInterval: 30000,
  });

  const accountValue = (userState?.userState?.marginSummary?.accountValue as number) || 0;

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
          <div className="text-right border-l pl-3">
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="font-mono text-sm font-semibold" data-testid="text-balance">
              ${accountValue.toFixed(2)}
            </div>
          </div>
          <Button variant="ghost" size="icon" data-testid="button-wallet">
            <Wallet className="h-4 w-4" />
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
