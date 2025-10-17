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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lock, KeyRound, Brain, TrendingUp, Trash2, Plus, AlertCircle } from "lucide-react";
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

const hyperliquidSchema = z.object({
  apiKey: z.string().min(1, "Private key is required"),
  label: z.string().min(1, "Label is required").max(50),
});

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;
type AIProviderFormData = z.infer<typeof aiProviderSchema>;
type HyperliquidFormData = z.infer<typeof hyperliquidSchema>;

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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [isAddingHyperliquid, setIsAddingHyperliquid] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  const { data: apiKeysData } = useQuery<{ success: boolean; apiKeys: ApiKey[] }>({
    queryKey: ['/api/api-keys'],
    refetchInterval: 5000,
  });

  const apiKeys = apiKeysData?.apiKeys || [];
  const aiKeys = apiKeys.filter(k => k.providerType === "ai");
  const hyperliquidKeys = apiKeys.filter(k => k.providerType === "exchange" && k.providerName === "hyperliquid");

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

  const hyperliquidForm = useForm<HyperliquidFormData>({
    resolver: zodResolver(hyperliquidSchema),
    defaultValues: {
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

  const hyperliquidMutation = useMutation({
    mutationFn: async (data: HyperliquidFormData) => {
      const response = await apiRequest("POST", "/api/api-keys", {
        providerType: "exchange",
        providerName: "hyperliquid",
        label: data.label,
        apiKey: data.apiKey,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hyperliquid Credentials Added",
        description: "Your Hyperliquid credentials have been added successfully.",
      });
      hyperliquidForm.reset();
      setIsAddingHyperliquid(false);
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add Hyperliquid credentials.",
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

  const onSubmitPassword = (data: PasswordChangeForm) => {
    passwordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const onSubmitAI = (data: AIProviderFormData) => {
    aiProviderMutation.mutate(data);
  };

  const onSubmitHyperliquid = (data: HyperliquidFormData) => {
    hyperliquidMutation.mutate(data);
  };

  const getProviderLabel = (providerName: string) => {
    const provider = AI_PROVIDERS.find(p => p.value === providerName);
    return provider?.label || providerName;
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
                <Button
                  onClick={() => setIsAddingAI(true)}
                  variant="outline"
                  size="sm"
                  data-testid="button-add-ai-key"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add AI Provider
                </Button>
              </div>
              <CardDescription>
                Manage your AI provider API keys for Mr. Fox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiKeys.length === 0 && !isAddingAI && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No AI providers configured. Add one to enable Mr. Fox's trading intelligence.
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

          {/* Hyperliquid Credentials */}
          <Card data-testid="card-hyperliquid-keys">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <CardTitle>Hyperliquid Exchange Credentials</CardTitle>
                </div>
                <Button
                  onClick={() => setIsAddingHyperliquid(true)}
                  variant="outline"
                  size="sm"
                  data-testid="button-add-hyperliquid-key"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Credentials
                </Button>
              </div>
              <CardDescription>
                Manage your Hyperliquid private keys for automated trading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hyperliquidKeys.length === 0 && !isAddingHyperliquid && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No Hyperliquid credentials configured. Add one to enable trading.
                  </AlertDescription>
                </Alert>
              )}

              {hyperliquidKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-md"
                  data-testid={`hyperliquid-key-${key.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Hyperliquid</p>
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
                    data-testid={`button-delete-hyperliquid-${key.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {isAddingHyperliquid && (
                <Form {...hyperliquidForm}>
                  <form onSubmit={hyperliquidForm.handleSubmit(onSubmitHyperliquid)} className="space-y-4 p-4 border rounded-md">
                    <FormField
                      control={hyperliquidForm.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Main Account, Trading Bot"
                              data-testid="input-hyperliquid-label"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A friendly name to identify this account
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={hyperliquidForm.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Private Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your Hyperliquid private key"
                              autoComplete="off"
                              data-testid="input-hyperliquid-private-key"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your Hyperliquid private key for trading operations
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={hyperliquidMutation.isPending}
                        data-testid="button-submit-hyperliquid"
                      >
                        {hyperliquidMutation.isPending ? "Adding..." : "Add Credentials"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddingHyperliquid(false);
                          hyperliquidForm.reset();
                        }}
                        data-testid="button-cancel-hyperliquid"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

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
    </div>
  );
}
