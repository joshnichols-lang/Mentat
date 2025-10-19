import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logoUrl from "@assets/generated-image-removebg-preview_1760665535887.png";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must be less than 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: passwordSchema,
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onLogin = async (data: LoginFormData) => {
    await loginMutation.mutateAsync(data);
  };

  const onRegister = async (data: RegisterFormData) => {
    await registerMutation.mutateAsync(data);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <img src={logoUrl} alt="1fox logo" className="h-10 w-10" />
              <CardTitle className="text-2xl font-mono">
                {isLogin ? "Welcome Back to 1fox" : "Join 1fox"}
              </CardTitle>
            </div>
            <CardDescription className="font-mono">
              {isLogin
                ? "Sign in to access your AI trading terminal"
                : "Create an account to start AI-powered trading"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLogin ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono">Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your username"
                            className="font-mono"
                            autoComplete="username"
                            data-testid="input-login-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono">Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your password"
                            className="font-mono"
                            autoComplete="current-password"
                            data-testid="input-login-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full font-mono"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono">Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Choose a username"
                            className="font-mono"
                            autoComplete="off"
                            disabled={false}
                            readOnly={false}
                            data-testid="input-register-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono">Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Create a password"
                            className="font-mono"
                            autoComplete="new-password"
                            data-testid="input-register-password"
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          Must be 8+ characters with uppercase, lowercase, number, and special character
                        </p>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full font-mono"
                    disabled={registerMutation.isPending}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setIsLogin(!isLogin)}
                className="font-mono"
                data-testid="button-toggle-auth"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-muted items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold font-mono">1fox</h1>
          <p className="text-xl text-muted-foreground font-mono">
            AI-Powered Cryptocurrency Trading Terminal
          </p>
          <ul className="space-y-3 text-muted-foreground font-mono">
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Multi-provider AI support (Perplexity, ChatGPT, Grok)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Multi-exchange trading (Hyperliquid, Binance, Bybit)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Passive learning mode to teach your AI agent</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Active autonomous trading when you're ready</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
