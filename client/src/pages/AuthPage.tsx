import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logoUrl from "@assets/generated-image-removebg-preview_1760665535887.png";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (loginUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (loginPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    try {
      await loginMutation.mutateAsync({
        username: loginUsername,
        password: loginPassword,
      });
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (registerUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(registerPassword)) {
      setError("Password must be 8+ chars with uppercase, lowercase, number, and special character");
      return;
    }
    
    try {
      await registerMutation.mutateAsync({
        username: registerUsername,
        password: registerPassword,
      });
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
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
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="login-username" className="text-sm font-mono">
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="flex h-9 w-full rounded-none border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                    data-testid="input-login-username"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-sm font-mono">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="flex h-9 w-full rounded-none border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                    data-testid="input-login-password"
                  />
                </div>
                {error && <p className="text-sm text-destructive font-mono">{error}</p>}
                <Button
                  type="submit"
                  className="w-full font-mono"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="register-username" className="text-sm font-mono">
                    Username
                  </label>
                  <input
                    id="register-username"
                    type="text"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="flex h-9 w-full rounded-none border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                    data-testid="input-register-username"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-password" className="text-sm font-mono">
                    Password
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Create a password"
                    className="flex h-9 w-full rounded-none border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                    data-testid="input-register-password"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground font-mono">
                    Must be 8+ characters with uppercase, lowercase, number, and special character
                  </p>
                </div>
                {error && <p className="text-sm text-destructive font-mono">{error}</p>}
                <Button
                  type="submit"
                  className="w-full font-mono"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setLoginUsername("");
                  setLoginPassword("");
                  setRegisterUsername("");
                  setRegisterPassword("");
                }}
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
              <span>Autonomous trading with custom strategies</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Real-time market analysis and execution</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Advanced risk management and position tracking</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
