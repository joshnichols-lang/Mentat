import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lock, KeyRound, AlertCircle, RefreshCcw, Clock, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;


export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showResyncModal, setShowResyncModal] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");

  // Query for Hyperliquid API wallet expiration status
  const { data: expirationStatus } = useQuery<{
    success: boolean;
    hasApiWallet: boolean;
    expirationDate: string | null;
    daysRemaining: number | null;
    hoursRemaining: number | null;
    isExpiring: boolean;
    isExpired: boolean;
  }>({
    queryKey: ['/api/wallets/hyperliquid-expiration'],
    refetchInterval: 60000, // Check every minute
  });

  const passwordForm = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest("PATCH", "/api/user/password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
      passwordForm.reset();
      setIsChangingPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please check your current password.",
        variant: "destructive",
      });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: async (data: { hyperliquidPrivateKey: string }) => {
      const response = await apiRequest("POST", "/api/wallet/resync-hyperliquid-credentials", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Credentials Re-synced",
        description: "Your Hyperliquid trading credentials have been successfully restored.",
      });
      setSeedPhrase("");
      setShowResyncModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/embedded'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/hyperliquid-expiration'] });
    },
    onError: (error: any) => {
      toast({
        title: "Re-sync Failed",
        description: error.message || "Failed to re-sync credentials. Please verify your seed phrase is correct.",
        variant: "destructive",
      });
    },
  });


  const onSubmitPassword = (data: PasswordChangeForm) => {
    passwordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const handleResyncSubmit = async () => {
    const trimmedPhrase = seedPhrase.trim();
    
    if (!trimmedPhrase) {
      toast({
        title: "Seed Phrase Required",
        description: "Please enter your 12-word seed phrase.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate it's a 12-word phrase
    const words = trimmedPhrase.split(/\s+/);
    if (words.length !== 12) {
      toast({
        title: "Invalid Seed Phrase",
        description: "Seed phrase must be exactly 12 words.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Derive Hyperliquid wallet from seed phrase client-side using browser-compatible libraries
      const { mnemonicToSeedSync } = await import('@scure/bip39');
      const { HDKey } = await import('@scure/bip32');
      
      const seed = mnemonicToSeedSync(trimmedPhrase);
      const hdNode = HDKey.fromMasterSeed(seed);
      const hyperliquidWallet = hdNode.derive("m/44'/60'/0'/0/2");
      
      if (!hyperliquidWallet.privateKey) {
        throw new Error("Failed to derive private key from seed phrase");
      }
      
      // Convert Uint8Array private key to hex string with 0x prefix
      const privateKeyHex = '0x' + Array.from(hyperliquidWallet.privateKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Submit to backend (only private key, not seed phrase)
      await resyncMutation.mutateAsync({
        hyperliquidPrivateKey: privateKeyHex,
      });
    } catch (error: any) {
      toast({
        title: "Re-sync Failed",
        description: error.message || "Failed to derive wallet from seed phrase. Please check your input.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-auto">
        <div className="container max-w-4xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <KeyRound className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your account settings and API credentials</p>
            </div>
          </div>

          {/* Re-sync Hyperliquid Credentials - Always visible */}
          <Card data-testid="card-resync-credentials">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCcw className="w-5 h-5" />
                  <CardTitle>Re-sync Hyperliquid Credentials</CardTitle>
                </div>
                <CardDescription>
                  Restore your Hyperliquid trading credentials using your embedded wallet's seed phrase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>When to use this:</strong> If you created your account before automatic credential setup was added, and you're seeing "No Hyperliquid credentials found" errors.
                    <br /><br />
                    <strong>What you need:</strong> The 12-word seed phrase that was shown when you first created your embedded wallet.
                    <br /><br />
                    <strong>Note:</strong> If you just created your account, your credentials are already set up automatically. You don't need this.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => setShowResyncModal(true)}
                  variant="outline"
                  data-testid="button-resync-credentials"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Re-sync Credentials
                </Button>
              </CardContent>
          </Card>

          {/* Hyperliquid API Wallet Status */}
          {expirationStatus?.hasApiWallet && expirationStatus.expirationDate && (
            <Card data-testid="card-api-wallet-status">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <CardTitle>Hyperliquid API Wallet Status</CardTitle>
                </div>
                <CardDescription>
                  Your API wallet authorization is automatically renewed every 180 days. No action required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-chart-2 bg-chart-2/10">
                  <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  <AlertDescription>
                    <span className="font-medium">
                      Active: {expirationStatus.daysRemaining}d {expirationStatus.hoursRemaining}h remaining
                    </span>
                    <br />
                    <span className="text-sm opacity-90">
                      Expires: {new Date(expirationStatus.expirationDate).toLocaleDateString()} at {new Date(expirationStatus.expirationDate).toLocaleTimeString()}
                    </span>
                    <br />
                    <span className="text-sm opacity-70 mt-2 block">
                      Auto-renews 24 hours before expiration
                    </span>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Password Settings */}
          <Card data-testid="card-password-settings">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                <CardTitle>Change Password</CardTitle>
              </div>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <Button
                  onClick={() => setIsChangingPassword(true)}
                  variant="outline"
                  data-testid="button-change-password"
                >
                  Change Password
                </Button>
              ) : (
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter current password"
                              autoComplete="current-password"
                              data-testid="input-current-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter new password"
                              autoComplete="new-password"
                              data-testid="input-new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirm new password"
                              autoComplete="new-password"
                              data-testid="input-confirm-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={passwordMutation.isPending}
                        data-testid="button-submit-password"
                      >
                        {passwordMutation.isPending ? "Updating..." : "Update Password"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsChangingPassword(false);
                          passwordForm.reset();
                        }}
                        data-testid="button-cancel-password"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Re-sync Credentials Dialog */}
      <Dialog open={showResyncModal} onOpenChange={setShowResyncModal}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-resync">
          <DialogHeader>
            <DialogTitle>Re-sync Hyperliquid Credentials</DialogTitle>
            <DialogDescription>
              Enter the 12-word seed phrase from your embedded wallet to restore your trading credentials
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your seed phrase will be used to derive your Hyperliquid private key, which will be encrypted and stored securely. Never share your seed phrase with anyone.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label htmlFor="seed-phrase" className="text-sm font-medium">
                Seed Phrase (12 words)
              </label>
              <Textarea
                id="seed-phrase"
                placeholder="word1 word2 word3 ..."
                value={seedPhrase}
                onChange={(e) => setSeedPhrase(e.target.value)}
                className="min-h-[100px] font-mono text-sm"
                data-testid="input-seed-phrase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResyncModal(false);
                setSeedPhrase("");
              }}
              data-testid="button-cancel-resync"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResyncSubmit}
              disabled={resyncMutation.isPending}
              data-testid="button-submit-resync"
            >
              {resyncMutation.isPending ? "Re-syncing..." : "Re-sync Credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
