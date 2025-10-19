import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Activity, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Shield,
  BarChart3,
  Clock
} from "lucide-react";
import Header from "@/components/Header";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalTrades: number;
  totalAiRequests: number;
  totalMonitoringRuns: number;
  aiUsageByProvider: Array<{
    provider: string;
    count: number;
    totalTokens: number;
  }>;
}

interface BudgetAlert {
  id: string;
  userId: string;
  monthlyBudget: string;
  currentSpend: string;
  alertThreshold: string;
  lastNotifiedAt: Date | null;
}

interface User {
  id: string;
  username: string;
  role: "user" | "admin";
  agentMode: "passive" | "active";
  verificationStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/usage-stats"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: budget } = useQuery<BudgetAlert>({
    queryKey: ["/api/admin/budget"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "user" | "admin" }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveBudgetMutation = useMutation({
    mutationFn: async (data: { monthlyBudget: string; alertThreshold: string }) => {
      return await apiRequest("POST", "/api/admin/budget", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/budget"] });
      toast({
        title: "Success",
        description: "Budget settings saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  const handleSaveBudget = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    saveBudgetMutation.mutate({
      monthlyBudget: formData.get("monthlyBudget") as string,
      alertThreshold: formData.get("alertThreshold") as string,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-[1920px] p-4">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
              <p className="text-muted-foreground">Platform usage and budget management</p>
            </div>
          </div>

          <Separator />

          {/* Usage Statistics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card data-testid="card-total-users">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-users">
                  {statsLoading ? "..." : stats?.totalUsers || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-users">
                  {statsLoading ? "..." : stats?.activeUsers || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-total-trades">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-trades">
                  {statsLoading ? "..." : stats?.totalTrades || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-ai-requests">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">AI Requests</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-ai-requests">
                  {statsLoading ? "..." : stats?.totalAiRequests || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-monitoring-runs">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Monitoring Runs</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-monitoring-runs">
                  {statsLoading ? "..." : stats?.totalMonitoringRuns || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Usage by Provider */}
          <Card data-testid="card-ai-usage-provider">
            <CardHeader>
              <CardTitle>AI Usage by Provider (Last 30 Days)</CardTitle>
              <CardDescription>Token consumption and request counts by AI provider</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : stats?.aiUsageByProvider && stats.aiUsageByProvider.length > 0 ? (
                <div className="space-y-3">
                  {stats.aiUsageByProvider.map((provider) => (
                    <div 
                      key={provider.provider} 
                      className="flex items-center justify-between gap-4 rounded-md border p-3"
                      data-testid={`provider-${provider.provider.toLowerCase()}`}
                    >
                      <div>
                        <p className="font-medium">{provider.provider}</p>
                        <p className="text-sm text-muted-foreground">{provider.count} requests</p>
                      </div>
                      <Badge variant="secondary" data-testid={`tokens-${provider.provider.toLowerCase()}`}>
                        {provider.totalTokens?.toLocaleString() || 0} tokens
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No AI usage data available</p>
              )}
            </CardContent>
          </Card>

          {/* Budget Management */}
          <Card data-testid="card-budget-management">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget Management
              </CardTitle>
              <CardDescription>Set monthly budget limits and alert thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveBudget} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyBudget">Monthly Budget ($)</Label>
                    <Input
                      id="monthlyBudget"
                      name="monthlyBudget"
                      type="number"
                      step="0.01"
                      defaultValue={budget?.monthlyBudget || ""}
                      placeholder="100.00"
                      data-testid="input-monthly-budget"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alertThreshold">Alert Threshold (%)</Label>
                    <Input
                      id="alertThreshold"
                      name="alertThreshold"
                      type="number"
                      step="1"
                      defaultValue={budget?.alertThreshold || "80"}
                      placeholder="80"
                      data-testid="input-alert-threshold"
                    />
                  </div>
                </div>

                {budget && (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Spend</span>
                      <span className="font-medium" data-testid="text-current-spend">
                        ${parseFloat(budget.currentSpend || "0").toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Budget</span>
                      <span className="font-medium" data-testid="text-budget-limit">
                        ${parseFloat(budget.monthlyBudget || "0").toFixed(2)}
                      </span>
                    </div>
                    {budget.lastNotifiedAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        Last alert: {new Date(budget.lastNotifiedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" disabled={saveBudgetMutation.isPending} data-testid="button-save-budget">
                  {saveBudgetMutation.isPending ? "Saving..." : "Save Budget Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card data-testid="card-user-management">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <p className="text-muted-foreground">Loading users...</p>
              ) : users && users.length > 0 ? (
                <div className="space-y-3">
                  {users.map((u) => (
                    <div 
                      key={u.id} 
                      className="flex items-center justify-between gap-4 rounded-md border p-3"
                      data-testid={`user-${u.username}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{u.username}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant={u.verificationStatus === "approved" ? "default" : "secondary"}>
                            {u.verificationStatus}
                          </Badge>
                          <Badge variant={u.agentMode === "active" ? "default" : "secondary"}>
                            {u.agentMode}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.role === "admin" ? (
                          <Badge variant="default" data-testid={`role-badge-${u.username}`}>Admin</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateRoleMutation.mutate({ userId: u.id, role: "admin" })}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-make-admin-${u.username}`}
                          >
                            Make Admin
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No users found</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
