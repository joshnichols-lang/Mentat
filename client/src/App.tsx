import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WalletInitializer } from "@/components/WalletInitializer";
import { HyperliquidAutoRenew } from "@/components/HyperliquidAutoRenew";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import LandingPage from "@/pages/LandingPage";
import UnifiedTerminal from "@/pages/UnifiedTerminal";
import NumoraDashboard from "@/pages/NumoraDashboard";
import MentatTerminal from "@/pages/MentatTerminal";
import AuthPage from "@/pages/AuthPage";
import PendingApproval from "@/pages/PendingApproval";
import AdminVerification from "@/pages/AdminVerification";
import AdminUsers from "@/pages/AdminUsers";
import AdminMessages from "@/pages/AdminMessages";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import Wallet from "@/pages/Wallet";
import TradeHistory from "@/pages/TradeHistory";
import TradeJournal from "@/pages/TradeJournal";
import TradingModes from "@/pages/TradingModes";
import UIPreview from "@/pages/UIPreview";
import EnhancedUIPreview from "@/pages/EnhancedUIPreview";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/numora" component={NumoraDashboard} />
      <Route path="/ui-preview" component={UIPreview} />
      <Route path="/ui-enhanced" component={EnhancedUIPreview} />
      <ProtectedRoute path="/mentat" component={MentatTerminal} />
      <ProtectedRoute path="/terminal" component={UnifiedTerminal} />
      <ProtectedRoute path="/trade" component={UnifiedTerminal} />
      <ProtectedRoute path="/pending-approval" component={PendingApproval} />
      <ProtectedRoute path="/admin/verification" component={AdminVerification} />
      <ProtectedRoute path="/admin/users" component={AdminUsers} />
      <ProtectedRoute path="/admin/messages" component={AdminMessages} />
      <ProtectedRoute path="/admin" component={Admin} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/wallet" component={Wallet} />
      <ProtectedRoute path="/trade-history" component={TradeHistory} />
      <ProtectedRoute path="/trade-journal" component={TradeJournal} />
      <ProtectedRoute path="/trading-modes" component={TradingModes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: '#B06000',
              accentColorForeground: 'white',
              borderRadius: 'medium',
            })}
          >
            <ThemeProvider>
              <TooltipProvider>
                <AuthProvider>
                  <WalletInitializer />
                  <HyperliquidAutoRenew />
                  <Router />
                  <Toaster />
                </AuthProvider>
              </TooltipProvider>
            </ThemeProvider>
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
