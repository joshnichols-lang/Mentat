import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, CheckCircle2, XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import logoUrl from "@assets/1fox-removebg-preview(1)_1761259210534.png";

export default function PendingApproval() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect approved users to dashboard
  useEffect(() => {
    if (user?.verificationStatus === "approved") {
      const timer = setTimeout(() => setLocation("/"), 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.verificationStatus, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getStatusIcon = () => {
    switch (user?.verificationStatus) {
      case "approved":
        return <CheckCircle2 className="h-16 w-16 text-green-600" />;
      case "rejected":
        return <XCircle className="h-16 w-16 text-red-600" />;
      default:
        return <Clock className="h-16 w-16 text-yellow-600" />;
    }
  };

  const getStatusMessage = () => {
    switch (user?.verificationStatus) {
      case "approved":
        return {
          title: "Account Approved!",
          description: "Your account has been verified. Redirecting to the platform...",
          alertType: "success" as const,
        };
      case "rejected":
        return {
          title: "Account Verification Failed",
          description: "Your wallet address could not be verified. Please ensure you created your Hyperliquid account using our referral link. Contact support if you believe this is an error.",
          alertType: "error" as const,
        };
      default:
        return {
          title: "Account Pending Verification",
          description: "Your account is awaiting admin verification. We need to confirm that your Hyperliquid wallet was created using our referral link. This usually takes 24-48 hours.",
          alertType: "info" as const,
        };
    }
  };

  const status = getStatusMessage();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <img src={logoUrl} alt="1fox logo" className="h-12 w-12" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
          <CardTitle className="text-2xl font-mono text-center" data-testid="text-status-title">
            {status.title}
          </CardTitle>
          <CardDescription className="text-center" data-testid="text-status-description">
            Account Status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center" data-testid="icon-status">
            {getStatusIcon()}
          </div>

          <Alert className={
            user?.verificationStatus === "approved" ? "border-green-500/50 bg-green-500/10" :
            user?.verificationStatus === "rejected" ? "border-red-500/50 bg-red-500/10" :
            "border-yellow-500/50 bg-yellow-500/10"
          }>
            <AlertDescription className="text-center" data-testid="text-status-message">
              {status.description}
            </AlertDescription>
          </Alert>

          {user?.walletAddress && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Submitted Wallet Address:</p>
              <p className="text-sm font-mono bg-muted p-3 rounded-md break-all" data-testid="text-wallet-address">
                {user.walletAddress}
              </p>
            </div>
          )}

          {user?.verificationStatus === "rejected" && (
            <div className="pt-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Need help? Contact our support team.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
