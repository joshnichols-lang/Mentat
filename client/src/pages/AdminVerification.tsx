import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface PendingUser {
  id: string;
  username: string;
  email: string | null;
  walletAddress: string | null;
  verificationStatus: string;
  createdAt: string;
}

export default function AdminVerification() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: pendingUsers, isLoading, error } = useQuery<PendingUser[]>({
    queryKey: ["/api/admin/pending-users"],
    enabled: user?.role === "admin",
  });

  const verifyUserMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "approved" | "rejected" }) => {
      const response = await apiRequest("POST", `/api/admin/verify-user/${userId}`, { status });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      toast({
        title: variables.status === "approved" ? "User Approved" : "User Rejected",
        description: `User has been ${variables.status}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user verification status",
        variant: "destructive",
      });
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen">
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

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="mx-auto max-w-7xl p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-mono font-bold" data-testid="text-page-title">
            User Verification
          </h1>
          <p className="text-muted-foreground mt-2">
            Review and approve/reject users pending wallet verification
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading pending users...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load pending users. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && pendingUsers && pendingUsers.length === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              No users pending verification. All caught up!
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && pendingUsers && pendingUsers.length > 0 && (
          <div className="space-y-4">
            {pendingUsers.map((pendingUser) => (
              <Card key={pendingUser.id} data-testid={`card-user-${pendingUser.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="font-mono" data-testid="text-username">
                        {pendingUser.username}
                      </CardTitle>
                      <CardDescription>
                        {pendingUser.email || "No email provided"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Wallet Address:</p>
                    <p className="text-sm font-mono bg-muted p-3 rounded-md break-all" data-testid="text-wallet-address">
                      {pendingUser.walletAddress || "No wallet address provided"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Registered:</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(pendingUser.createdAt).toLocaleDateString()} at {new Date(pendingUser.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => verifyUserMutation.mutate({ userId: pendingUser.id, status: "approved" })}
                      disabled={verifyUserMutation.isPending}
                      data-testid="button-approve"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => verifyUserMutation.mutate({ userId: pendingUser.id, status: "rejected" })}
                      disabled={verifyUserMutation.isPending}
                      data-testid="button-reject"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
