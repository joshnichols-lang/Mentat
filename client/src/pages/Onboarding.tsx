import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const credentialSchema = z.object({
  privateKey: z.string().min(1, "Private key is required"),
});

type CredentialFormData = z.infer<typeof credentialSchema>;

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CredentialFormData>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      privateKey: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CredentialFormData) => {
      const response = await apiRequest("POST", "/api/credentials", {
        privateKey: data.privateKey,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/status"] });
      setLocation("/");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to save credentials. Please try again.");
    },
  });

  const onSubmit = (data: CredentialFormData) => {
    setError(null);
    mutation.mutate(data);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Connect Your Hyperliquid Account</CardTitle>
          <CardDescription>
            Add your Hyperliquid API credentials to start trading with 1fox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">How to get your Hyperliquid Private Key:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Log in to your Hyperliquid account</li>
                <li>Go to Settings → API Keys</li>
                <li>Create a new API key or copy your existing private key</li>
                <li>Paste it below (starts with "0x")</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="privateKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hyperliquid Private Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="0x..."
                        disabled={mutation.isPending}
                        data-testid="input-private-key"
                      />
                    </FormControl>
                    <FormDescription>
                      Your private key will be encrypted and stored securely
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 justify-end">
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-save-credentials"
                >
                  {mutation.isPending ? "Saving..." : "Save and Continue"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
