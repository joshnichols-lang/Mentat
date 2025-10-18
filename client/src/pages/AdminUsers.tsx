import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, Clock, AlertCircle, Trash2, Shield, User, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { useState } from "react";

interface UserData {
  id: string;
  username: string;
  email: string | null;
  walletAddress: string | null;
  verificationStatus: "pending" | "approved" | "rejected";
  role: string;
  agentMode: "passive" | "active";
  createdAt: string;
  aiUsage?: {
    totalRequests: number;
    totalCost: string;
    totalTokens: number;
  };
}

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    email: "",
    autoApprove: true,
  });

  const { data: allUsers, isLoading, error } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "admin",
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      const response = await apiRequest("POST", "/api/admin/users/create", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateDialogOpen(false);
      setNewUserData({ username: "", password: "", email: "", autoApprove: true });
      toast({
        title: "User Created",
        description: data.message || "New user created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Deleted",
        description: "User has been permanently removed from the system.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(newUserData);
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center p-8">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to access this page. Admin access required.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="gap-1 border-green-600 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="gap-1 border-red-600 text-red-600">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-7xl p-4">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold" data-testid="text-page-title">
              User Management
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage all users on the platform
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-user">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account manually. Perfect for beta testers or pre-approved users.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                    placeholder="betauser1"
                    required
                    minLength={3}
                    maxLength={50}
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    maxLength={100}
                    data-testid="input-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide this password to the user securely
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    placeholder="user@example.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoApprove"
                    checked={newUserData.autoApprove}
                    onCheckedChange={(checked) => 
                      setNewUserData({ ...newUserData, autoApprove: checked as boolean })
                    }
                    data-testid="checkbox-auto-approve"
                  />
                  <Label htmlFor="autoApprove" className="text-sm cursor-pointer">
                    Auto-approve user (skip verification)
                  </Label>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      setNewUserData({ username: "", password: "", email: "", autoApprove: true });
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load users. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && allUsers && allUsers.length === 0 && (
          <Alert>
            <AlertDescription>
              No users found in the system.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && allUsers && allUsers.length > 0 && (
          <div className="space-y-4">
            {allUsers.map((userData) => (
              <Card key={userData.id} data-testid={`card-user-${userData.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-mono" data-testid="text-username">
                          {userData.username}
                        </CardTitle>
                        {userData.role === "admin" && (
                          <Badge variant="default" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Admin
                          </Badge>
                        )}
                        {userData.role === "user" && (
                          <Badge variant="outline" className="gap-1">
                            <User className="h-3 w-3" />
                            User
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {userData.email || "No email provided"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {getVerificationBadge(userData.verificationStatus)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Wallet Address:</p>
                      <p className="text-sm font-mono bg-muted p-3 rounded-md break-all" data-testid="text-wallet-address">
                        {userData.walletAddress || "Not provided"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Agent Mode:</p>
                      <p className="text-sm bg-muted p-3 rounded-md">
                        {userData.agentMode === "active" ? "Active (Trading)" : "Passive (Learning)"}
                      </p>
                    </div>
                  </div>

                  {userData.aiUsage && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">AI Requests:</p>
                        <p className="text-sm bg-muted p-3 rounded-md font-mono" data-testid="text-ai-requests">
                          {userData.aiUsage.totalRequests.toLocaleString()}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Total Tokens:</p>
                        <p className="text-sm bg-muted p-3 rounded-md font-mono" data-testid="text-ai-tokens">
                          {userData.aiUsage.totalTokens.toLocaleString()}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Total AI Cost:</p>
                        <p className="text-sm bg-muted p-3 rounded-md font-mono" data-testid="text-ai-cost">
                          ${parseFloat(userData.aiUsage.totalCost).toFixed(4)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">User ID:</p>
                    <p className="text-sm font-mono text-muted-foreground" data-testid="text-user-id">
                      {userData.id}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Registered:</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(userData.createdAt).toLocaleDateString()} at {new Date(userData.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  {userData.id !== user?.id && (
                    <div className="pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="w-full"
                            disabled={deleteUserMutation.isPending}
                            data-testid={`button-delete-${userData.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete <strong>{userData.username}</strong>? 
                              This action cannot be undone. All user data, trades, and history will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(userData.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-delete"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                  {userData.id === user?.id && (
                    <div className="pt-4">
                      <Alert>
                        <AlertDescription>
                          You cannot delete your own account while logged in.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
