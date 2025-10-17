import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ContactMessage {
  id: string;
  userId: string;
  message: string;
  screenshotUrl: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export default function AdminMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ success: boolean; messages: ContactMessage[] }>({
    queryKey: ["/api/contact"],
  });

  const resolveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest(`/api/contact/${messageId}/resolve`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
      toast({
        title: "Message resolved",
        description: "The message has been marked as resolved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve message",
        variant: "destructive",
      });
    },
  });

  const messages = data?.messages || [];
  const pendingMessages = messages.filter(m => m.status === "pending");
  const resolvedMessages = messages.filter(m => m.status === "resolved");

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contact Messages</h1>
        <p className="text-muted-foreground">View and manage user support requests</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Messages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Messages</h2>
            <Badge variant="default" data-testid="badge-pending-count">
              {pendingMessages.length}
            </Badge>
          </div>
          {pendingMessages.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">No pending messages</p>
              </CardContent>
            </Card>
          ) : (
            pendingMessages.map((msg) => (
              <Card key={msg.id} data-testid={`message-${msg.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">User ID: {msg.userId.substring(0, 8)}...</CardTitle>
                      <CardDescription data-testid={`message-date-${msg.id}`}>
                        {format(new Date(msg.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" data-testid={`status-${msg.id}`}>
                      {msg.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap" data-testid={`message-text-${msg.id}`}>
                    {msg.message}
                  </p>
                  {msg.screenshotUrl && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Screenshot:</p>
                      <div className="relative border rounded-md overflow-hidden">
                        <img
                          src={msg.screenshotUrl}
                          alt="Screenshot"
                          className="w-full max-h-[200px] object-contain"
                          data-testid={`screenshot-${msg.id}`}
                        />
                        <a
                          href={msg.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2"
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            data-testid={`button-view-screenshot-${msg.id}`}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Full
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => resolveMutation.mutate(msg.id)}
                    disabled={resolveMutation.isPending}
                    size="sm"
                    className="w-full"
                    data-testid={`button-resolve-${msg.id}`}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Resolved Messages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Resolved Messages</h2>
            <Badge variant="outline" data-testid="badge-resolved-count">
              {resolvedMessages.length}
            </Badge>
          </div>
          {resolvedMessages.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">No resolved messages</p>
              </CardContent>
            </Card>
          ) : (
            resolvedMessages.map((msg) => (
              <Card key={msg.id} className="opacity-60" data-testid={`message-${msg.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">User ID: {msg.userId.substring(0, 8)}...</CardTitle>
                      <CardDescription data-testid={`message-date-${msg.id}`}>
                        {format(new Date(msg.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" data-testid={`status-${msg.id}`}>
                      {msg.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap" data-testid={`message-text-${msg.id}`}>
                    {msg.message}
                  </p>
                  {msg.screenshotUrl && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Screenshot:</p>
                      <div className="relative border rounded-md overflow-hidden">
                        <img
                          src={msg.screenshotUrl}
                          alt="Screenshot"
                          className="w-full max-h-[200px] object-contain"
                          data-testid={`screenshot-${msg.id}`}
                        />
                      </div>
                    </div>
                  )}
                  {msg.resolvedAt && (
                    <p className="text-xs text-muted-foreground" data-testid={`resolved-date-${msg.id}`}>
                      Resolved on {format(new Date(msg.resolvedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
