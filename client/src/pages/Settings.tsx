import { useState, useEffect } from "react";
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
import { Lock, KeyRound, Brain, Trash2, Plus, AlertCircle, Clock, DollarSign } from "lucide-react";
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

const MONITORING_FREQUENCIES = [
  { 
    value: "0", 
    label: "Disabled", 
    monthlyCost: 0,
    description: "Manual prompts only (~$0.01-0.05/month)"
  },
  { 
    value: "60", 
    label: "1 hour", 
    monthlyCost: 0.86,
    description: "~720 cycles/month, ultra-low cost"
  },
  { 
    value: "30", 
    label: "30 minutes", 
    monthlyCost: 1.73,
    description: "~1,440 cycles/month, very affordable"
  },
  { 
    value: "5", 
    label: "5 minutes", 
    monthlyCost: 10.37,
    description: "~8,640 cycles/month, cost-effective"
  },
  { 
    value: "1", 
    label: "1 minute", 
    monthlyCost: 51.84,
    description: "~43,200 cycles/month, most responsive"
  },
];

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [pendingFrequency, setPendingFrequency] = useState<string | null>(null);
  const [monitoringFrequency, setMonitoringFrequency] = useState<string>(() => {
    return localStorage.getItem("monitoringFrequency") || "5";
  });

  // Sync monitoring frequency from backend (fixes admin panel changes not showing)
  useEffect(() => {
    if (user?.monitoringFrequencyMinutes !== undefined) {
      const backendFrequency = String(user.monitoringFrequencyMinutes);
      // Only update if different from current state
      if (backendFrequency !== monitoringFrequency) {
        console.log(`[Monitoring] Synced frequency to ${backendFrequency} minutes`);
        setMonitoringFrequency(backendFrequency);
        localStorage.setItem("monitoringFrequency", backendFrequency);
      }
    }
  }, [user?.monitoringFrequencyMinutes]);

  const { data: apiKeysData } = useQuery<{ success: boolean; apiKeys: ApiKey[] }>({
    queryKey: ['/api/api-keys'],
    refetchInterval: 5000,
  });

  const apiKeys = apiKeysData?.apiKeys || [];
  const aiKeys = apiKeys.filter(k => k.providerType === "ai");

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

  const updateFrequencyMutation = useMutation({
    mutationFn: async (frequency: string) => {
      const res = await apiRequest('POST', '/api/monitoring/frequency', { 
        minutes: parseInt(frequency) 
      });
      
      if (!res.ok) {
        throw new Error(`Failed to update frequency: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: (data, frequency) => {
      const freqConfig = MONITORING_FREQUENCIES.find(f => f.value === frequency);
      toast({
        title: "Monitoring Updated",
        description: frequency === "0" 
          ? "Automated monitoring disabled" 
          : `Monitoring every ${freqConfig?.label} (~$${freqConfig?.monthlyCost}/month)`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update monitoring frequency",
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

  const handleFrequencyChange = (value: string) => {
    // Show confirmation dialog before changing
    setPendingFrequency(value);
  };

  const confirmFrequencyChange = () => {
    if (!pendingFrequency) return;
    
    const previousValue = monitoringFrequency;
    const newValue = pendingFrequency;
    
    setMonitoringFrequency(newValue);
    localStorage.setItem("monitoringFrequency", newValue);
    setPendingFrequency(null);
    
    updateFrequencyMutation.mutate(newValue, {
      onError: () => {
        // Rollback if mutation fails
        setMonitoringFrequency(previousValue);
        localStorage.setItem("monitoringFrequency", previousValue);
      }
    });
  };

  const selectedFreqConfig = MONITORING_FREQUENCIES.find(f => f.value === monitoringFrequency);

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

          {/* Automated Monitoring Frequency */}
          <Card data-testid="card-monitoring-frequency">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <CardTitle>Automated Monitoring Frequency</CardTitle>
              </div>
              <CardDescription>
                Control how often the AI agent checks the market and executes trades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monitoring Interval</label>
                <Select value={monitoringFrequency} onValueChange={handleFrequencyChange}>
                  <SelectTrigger data-testid="select-monitoring-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONITORING_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{freq.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {freq.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFreqConfig && selectedFreqConfig.value !== "0" && (
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <strong>Estimated Monthly Cost:</strong> ~${selectedFreqConfig.monthlyCost}/month per user
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>💡 <strong>Business Planning Tips (Grok 4 Fast - 96% cheaper):</strong></p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><strong>Starter</strong>: Charge $10-20/month (1-hour, ~$0.86 cost = 91-95% margin)</li>
                          <li><strong>Standard</strong>: Charge $40-60/month (5-min, ~$10.37 cost = 74-83% margin)</li>
                          <li><strong>Premium</strong>: Charge $100-150/month (1-min, ~$51.84 cost = 48-65% margin)</li>
                          <li><strong>Scale Economics</strong>: 1,000 Standard users = $10,370 cost, $40k-60k revenue</li>
                          <li><strong>Profit Strategy</strong>: Push 1-hour/30-min for max margins, upsell to 5-min</li>
                        </ul>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {selectedFreqConfig && selectedFreqConfig.value === "0" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Monitoring Disabled</strong> - The AI agent will only respond to manual prompts. 
                    This uses minimal AI resources (~$0.01-0.05/month with Grok).
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

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

      {/* Frequency Change Confirmation Dialog */}
      <AlertDialog open={!!pendingFrequency} onOpenChange={() => setPendingFrequency(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Monitoring Frequency?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFrequency && (() => {
                const newConfig = MONITORING_FREQUENCIES.find(f => f.value === pendingFrequency);
                const currentConfig = MONITORING_FREQUENCIES.find(f => f.value === monitoringFrequency);
                
                return (
                  <div className="space-y-2">
                    <p>
                      You're about to change the automated monitoring frequency from{" "}
                      <strong>{currentConfig?.label}</strong> to <strong>{newConfig?.label}</strong>.
                    </p>
                    {newConfig && newConfig.value !== "0" && (
                      <p className="text-sm">
                        Estimated cost: <strong>~${newConfig.monthlyCost}/month</strong>
                      </p>
                    )}
                    {newConfig && newConfig.value === "0" && (
                      <p className="text-sm text-muted-foreground">
                        The AI agent will only respond to manual prompts when disabled.
                      </p>
                    )}
                  </div>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-frequency">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFrequencyChange}
              data-testid="button-confirm-frequency"
            >
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
