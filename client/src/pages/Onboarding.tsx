import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Brain, TrendingUp, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import logoUrl from "@assets/generated-image-removebg-preview_1760665535887.png";

type OnboardingStep = "ai_provider" | "exchange" | "complete";

const aiProviderSchema = z.object({
  provider: z.enum(["perplexity", "openai", "xai"]),
  apiKey: z.string().min(1, "API key is required"),
  label: z.string().min(1, "Label is required").max(50),
});

const exchangeSchema = z.object({
  provider: z.enum(["hyperliquid"]),
  walletAddress: z.string()
    .min(1, "Wallet address is required")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address (must start with 0x and be 42 characters)"),
  apiKey: z.string().min(1, "Private key is required"),
  label: z.string().min(1, "Label is required").max(50),
  confirmedReferral: z.boolean().refine((val) => val === true, {
    message: "You must confirm that you created your account using our referral link",
  }),
});

type AIProviderFormData = z.infer<typeof aiProviderSchema>;
type ExchangeFormData = z.infer<typeof exchangeSchema>;

const AI_PROVIDERS = [
  { value: "perplexity", label: "Perplexity AI", description: "Sonar models with web search" },
  { value: "openai", label: "OpenAI (ChatGPT)", description: "GPT-4 and GPT-3.5 models" },
  { value: "xai", label: "xAI (Grok)", description: "Grok models" },
];

const HYPERLIQUID_REFERRAL_URL = "https://app.hyperliquid.xyz/join/1FOX";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("ai_provider");
  const [error, setError] = useState<string | null>(null);

  const aiForm = useForm<AIProviderFormData>({
    resolver: zodResolver(aiProviderSchema),
    defaultValues: {
      provider: "perplexity",
      apiKey: "",
      label: "Main AI",
    },
  });

  const exchangeForm = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeSchema),
    defaultValues: {
      provider: "hyperliquid",
      walletAddress: "",
      apiKey: "",
      label: "Main Account",
      confirmedReferral: false,
    },
  });

  const selectedAIProvider = aiForm.watch("provider");

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
      setCurrentStep("exchange");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to save AI provider. Please try again.");
    },
  });

  const exchangeMutation = useMutation({
    mutationFn: async (data: ExchangeFormData) => {
      // First save the exchange credentials
      const response = await apiRequest("POST", "/api/api-keys", {
        providerType: "exchange",
        providerName: data.provider,
        label: data.label,
        apiKey: data.apiKey,
      });
      
      // Then update the user's wallet address
      await apiRequest("POST", "/api/user/wallet-address", {
        walletAddress: data.walletAddress,
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/status"] });
      setCurrentStep("complete");
      setTimeout(() => setLocation("/"), 2000);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to save exchange credentials. Please try again.");
    },
  });

  const onSubmitAI = (data: AIProviderFormData) => {
    setError(null);
    aiProviderMutation.mutate(data);
  };

  const onSubmitExchange = (data: ExchangeFormData) => {
    setError(null);
    exchangeMutation.mutate(data);
  };

  if (currentStep === "complete") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4" data-testid="div-onboarding-complete">
              <img src={logoUrl} alt="1fox logo" className="h-20 w-20 mx-auto mb-2" />
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" data-testid="icon-success" />
              <h2 className="text-2xl font-mono" data-testid="text-setup-complete">Setup Complete!</h2>
              <p className="text-muted-foreground" data-testid="text-redirecting">
                Redirecting to your trading terminal...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="1fox logo" className="h-8 w-8" />
              <div className="text-sm font-mono text-muted-foreground" data-testid="text-step-indicator">
                Step {currentStep === "ai_provider" ? "1" : "2"} of 2
              </div>
            </div>
            {currentStep === "ai_provider" ? (
              <Brain className="h-5 w-5 text-primary" data-testid="icon-brain" />
            ) : (
              <TrendingUp className="h-5 w-5 text-primary" data-testid="icon-trending" />
            )}
          </div>
          <CardTitle className="text-2xl font-mono" data-testid="text-step-title">
            {currentStep === "ai_provider" ? "Connect AI Provider" : "Connect Trading Exchange"}
          </CardTitle>
          <CardDescription data-testid="text-step-description">
            {currentStep === "ai_provider"
              ? "Choose an AI provider to power Mr. Fox's trading intelligence"
              : "Connect your exchange account to enable automated trading"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" data-testid="alert-error">
              <AlertCircle className="h-4 w-4" data-testid="icon-error" />
              <AlertDescription data-testid="text-error">{error}</AlertDescription>
            </Alert>
          )}

          {currentStep === "ai_provider" ? (
            <Form {...aiForm}>
              <form onSubmit={aiForm.handleSubmit(onSubmitAI)} className="space-y-4">
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
                      <FormLabel>Account Label</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Main AI, Backup Provider"
                          disabled={aiProviderMutation.isPending}
                          data-testid="input-ai-label"
                        />
                      </FormControl>
                      <FormDescription>
                        A friendly name to identify this AI provider
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
                          {...field}
                          type="password"
                          placeholder={
                            selectedAIProvider === "perplexity"
                              ? "pplx-..."
                              : selectedAIProvider === "openai"
                              ? "sk-..."
                              : "xai-..."
                          }
                          disabled={aiProviderMutation.isPending}
                          autoComplete="off"
                          data-testid="input-ai-key"
                        />
                      </FormControl>
                      <FormDescription>
                        Your API key will be encrypted and stored securely
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">How to get your API key:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {selectedAIProvider === "perplexity" && (
                        <>
                          <li>Visit perplexity.ai/settings/api</li>
                          <li>Create a new API key</li>
                          <li>Copy the key (starts with "pplx-")</li>
                        </>
                      )}
                      {selectedAIProvider === "openai" && (
                        <>
                          <li>Visit platform.openai.com/api-keys</li>
                          <li>Create a new secret key</li>
                          <li>Copy the key (starts with "sk-")</li>
                        </>
                      )}
                      {selectedAIProvider === "xai" && (
                        <>
                          <li>Visit x.ai/api</li>
                          <li>Create a new API key</li>
                          <li>Copy your key</li>
                        </>
                      )}
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="submit"
                    disabled={aiProviderMutation.isPending}
                    data-testid="button-save-ai-provider"
                  >
                    {aiProviderMutation.isPending ? "Saving..." : "Continue to Exchange"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...exchangeForm}>
              <form onSubmit={exchangeForm.handleSubmit(onSubmitExchange)} className="space-y-4">
                <Alert className="border-primary/50 bg-primary/5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <p className="font-semibold text-primary mb-2">⚠️ Required: Create Account via Referral Link</p>
                    <p className="text-sm mb-3">
                      To use 1fox, you must create your Hyperliquid account through our referral link below. 
                      Accounts not created through this link will be removed.
                    </p>
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={() => window.open(HYPERLIQUID_REFERRAL_URL, '_blank')}
                      data-testid="button-create-hyperliquid-account"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Create Hyperliquid Account (Required)
                    </Button>
                  </AlertDescription>
                </Alert>

                <FormField
                  control={exchangeForm.control}
                  name="walletAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="0x..."
                          data-testid="input-wallet-address"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter your Hyperliquid wallet address (starts with 0x). We'll verify this matches the account created through our referral link.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={exchangeForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Label</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Main Account, High Risk"
                          disabled={exchangeMutation.isPending}
                          data-testid="input-exchange-label"
                        />
                      </FormControl>
                      <FormDescription>
                        A friendly name to identify this trading account
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={exchangeForm.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Private Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="0x..."
                          disabled={exchangeMutation.isPending}
                          autoComplete="off"
                          data-testid="input-exchange-key"
                        />
                      </FormControl>
                      <FormDescription>
                        Your wallet private key (starts with 0x)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={exchangeForm.control}
                  name="confirmedReferral"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-confirm-referral"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-medium">
                          I confirm that I created my Hyperliquid account using the referral link above
                        </FormLabel>
                        <FormDescription>
                          This is required to use 1fox. Accounts not created through our referral will be removed.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">How to get your private key:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Export your wallet's private key (MetaMask, Ledger, etc.)</li>
                      <li>Make sure it has trading permissions</li>
                      <li>Paste it below (starts with "0x")</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2 justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep("ai_provider")}
                    disabled={exchangeMutation.isPending}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={exchangeMutation.isPending}
                    data-testid="button-complete-onboarding"
                  >
                    {exchangeMutation.isPending ? "Saving..." : "Complete Setup"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
