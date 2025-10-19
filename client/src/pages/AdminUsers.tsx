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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle2, XCircle, Clock, AlertCircle, Trash2, Shield, User, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must be less than 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: passwordSchema,
  email: z.string().email("Invalid email address").or(z.literal("")),
  autoApprove: z.boolean(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const createUserForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      autoApprove: true,
    },
  });

  const { data: allUsers, isLoading, error } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "admin",
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const response = await apiRequest("POST", "/api/admin/users/create", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateDialogOpen(false);
      createUserForm.reset();
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

  const onCreateUser = async (data: CreateUserFormData) => {
    await createUserMutation.mutateAsync(data);
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
              <Form {...createUserForm}>
                <form onSubmit={createUserForm.handleSubmit(onCreateUser)} className="space-y-4">
                  <FormField
                    control={createUserForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="betauser1"
                            data-testid="input-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Create a strong password"
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Must be 8+ characters with uppercase, lowercase, number, and special character. Provide this password to the user securely.
                        </p>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="user@example.com"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="autoApprove"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-auto-approve"
                          />
                        </FormControl>
                        <FormLabel className="text-sm cursor-pointer !mt-0">
                          Auto-approve user (skip verification)
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(false);
                        createUserForm.reset();
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
              </Form>
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
