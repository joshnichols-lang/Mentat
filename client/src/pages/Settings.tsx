import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lock, KeyRound, Brain, Trash2, Plus, AlertCircle, RefreshCcw, Clock, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Badge } from "@/components/ui/badge";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const aiProviderSchema = z.object({
  provider: z.enum(["perplexity", "openai", "xai"]),
  apiKey: z.string().min(1, "API key is required"),
  label: z.string().min(1, "Label is required").max(50),
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;
type AIProviderFormData = z.infer<typeof aiProviderSchema>;

interface ApiKey {
  id: string;
  providerType: "ai" | "exchange";
  providerName: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

const AI_PROVIDERS = [
  { value: "perplexity", label: "Perplexity AI", description: "Sonar models with web search" },
  { value: "openai", label: "OpenAI (ChatGPT)", description: "GPT-4 and GPT-3.5 models" },
  { value: "xai", label: "xAI (Grok)", description: "Grok models" },
];


export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [showResyncModal, setShowResyncModal] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");

  const { data: apiKeysData } = useQuery<{ success: boolean; apiKeys: ApiKey[] }>({
    queryKey: ['/api/api-keys'],
    refetchInterval: 5000,
  });

  const apiKeys = apiKeysData?.apiKeys || [];
  const aiKeys = apiKeys.filter(k => k.providerType === "ai");

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

  const aiForm = useForm<AIProviderFormData>({
    resolver: zodResolver(aiProviderSchema),
    defaultValues: {
      provider: "perplexity",
      apiKey: "",
      label: "",
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

  const aiProviderMutation = useMutation({
    mutationFn: async (data: AIProviderFormData) => {
      const response = await apiRequest("POST", "/api/api-keys", {
        providerType: "ai",
        providerName: data.provider,
        label: data.label,
        apiKey: data.apiKey,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AI Provider Added",
        description: "Your AI provider has been added successfully.",
      });
      aiForm.reset();
      setIsAddingAI(false);
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add AI provider.",
        variant: "destructive",
      });
    },
  });


  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest("DELETE", `/api/api-keys/${keyId}`);
    },
    onSuccess: () => {
      toast({
        title: "API Key Deleted",
        description: "The API key has been removed successfully.",
      });
      setDeleteKeyId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key.",
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

  const renewalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/wallets/renew-hyperliquid", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "API Wallet Renewed",
        description: `Your Hyperliquid API wallet has been renewed for 180 days. Expires ${new Date(data.expirationDate).toLocaleDateString()}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/hyperliquid-expiration'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Renewal Failed",
        description: error.message || "Failed to renew API wallet",
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

  const onSubmitAI = (data: AIProviderFormData) => {
    aiProviderMutation.mutate(data);
  };

  const getProviderLabel = (providerName: string) => {
    const provider = AI_PROVIDERS.find(p => p.value === providerName);
    return provider?.label || providerName;
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

          {/* AI Provider API Keys */}
          <Card data-testid="card-ai-keys">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  <CardTitle>AI Provider API Keys</CardTitle>
                </div>
                {aiKeys.length > 0 && (
                  <Button
                    onClick={() => setIsAddingAI(true)}
                    variant="outline"
                    size="sm"
                    data-testid="button-add-ai-key"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add AI Provider
                  </Button>
                )}
              </div>
              <CardDescription>
                Choose between Platform AI (shared xAI Grok) or your own API keys from Perplexity, OpenAI, or xAI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiKeys.length === 0 && !isAddingAI && (
                <div className="space-y-4">
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">🦊 Using Platform AI</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              You're using our shared xAI Grok infrastructure. Usage costs are covered by the platform.
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-2">Active</Badge>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setIsAddingAI(true)}
                      variant="outline"
                      size="sm"
                      data-testid="button-switch-to-personal"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Switch to Personal AI Key
                    </Button>
                  </div>
                </div>
              )}

              {aiKeys.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Using Personal AI Key</strong> - You're using your own API credentials. 
                    Delete all personal keys below to switch back to Platform AI (shared infrastructure).
                  </AlertDescription>
                </Alert>
              )}

              {aiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-md"
                  data-testid={`ai-key-${key.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{getProviderLabel(key.providerName)}</p>
                      {key.isActive && <Badge variant="outline">Active</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{key.label}</p>
                    {key.lastUsed && (
                      <p className="text-xs text-muted-foreground">
                        Last used: {new Date(key.lastUsed).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteKeyId(key.id)}
                    data-testid={`button-delete-ai-${key.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {isAddingAI && (
                <Form {...aiForm}>
                  <form onSubmit={aiForm.handleSubmit(onSubmitAI)} className="space-y-4 p-4 border rounded-md">
                    <FormField
                      control={aiForm.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AI Provider</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-ai-provider">
                                <SelectValue placeholder="Select AI provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {AI_PROVIDERS.map((provider) => (
                                <SelectItem key={provider.value} value={provider.value}>
                                  <div className="flex flex-col">
                                    <span>{provider.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {provider.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={aiForm.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Main AI, Backup Provider"
                              data-testid="input-ai-label"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A friendly name to identify this API key
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={aiForm.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your API key"
                              autoComplete="off"
                              data-testid="input-ai-api-key"
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
                        disabled={aiProviderMutation.isPending}
                        data-testid="button-submit-ai"
                      >
                        {aiProviderMutation.isPending ? "Adding..." : "Add Provider"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddingAI(false);
                          aiForm.reset();
                        }}
                        data-testid="button-cancel-ai"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          {/* Re-sync Hyperliquid Credentials */}
          <Card data-testid="card-resync-credentials">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCcw className="w-5 h-5" />
                <CardTitle>Re-sync Hyperliquid Credentials</CardTitle>
              </div>
              <CardDescription>
                If you're seeing "No Hyperliquid credentials found" errors, use this tool to restore your trading credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This feature is for users who created their account before the automatic credential setup was implemented.
                  You'll need the 12-word seed phrase that was shown when you created your embedded wallet.
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

          {/* Renew Hyperliquid API Wallet */}
          {expirationStatus?.hasApiWallet && (
            <Card data-testid="card-renew-api-wallet">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <CardTitle>Hyperliquid API Wallet</CardTitle>
                </div>
                <CardDescription>
                  Your API wallet authorization expires every 180 days for security. Renew it before expiration to avoid trading disruptions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {expirationStatus.expirationDate && (
                  <Alert className={
                    expirationStatus.isExpired
                      ? "border-destructive bg-destructive/10"
                      : expirationStatus.isExpiring && (expirationStatus.daysRemaining || 0) < 7
                      ? "border-destructive bg-destructive/10"
                      : expirationStatus.isExpiring
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-chart-2 bg-chart-2/10"
                  }>
                    {expirationStatus.isExpired ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : expirationStatus.isExpiring ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-chart-2" />
                    )}
                    <AlertDescription>
                      {expirationStatus.isExpired ? (
                        <span className="font-medium text-destructive">
                          Your API wallet has expired. Renew it now to continue trading.
                        </span>
                      ) : (
                        <>
                          <span className="font-medium">
                            {expirationStatus.isExpiring ? 'Expiring Soon:' : 'Active:'} {expirationStatus.daysRemaining}d {expirationStatus.hoursRemaining}h remaining
                          </span>
                          <br />
                          <span className="text-sm opacity-90">
                            Expires: {new Date(expirationStatus.expirationDate).toLocaleDateString()} at {new Date(expirationStatus.expirationDate).toLocaleTimeString()}
                          </span>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  onClick={() => renewalMutation.mutate()}
                  disabled={renewalMutation.isPending}
                  variant={expirationStatus.isExpired || expirationStatus.isExpiring ? "default" : "outline"}
                  data-testid="button-renew-api-wallet-settings"
                >
                  {renewalMutation.isPending ? (
                    <>
                      <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                      Renewing...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Renew for 180 Days
                    </>
                  )}
                </Button>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the API key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && deleteKeyMutation.mutate(deleteKeyId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
