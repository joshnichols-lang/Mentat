import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { Bot, BotOff } from "lucide-react";

export default function AgentModeToggle() {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Get current user data including agent mode
  const { data: user } = useQuery<any>({
    queryKey: ['/api/user'],
  });

  const agentMode = user?.agentMode || "passive";
  const isActive = agentMode === "active";

  // Mutation to update agent mode
  const updateModeMutation = useMutation({
    mutationFn: async (mode: "passive" | "active") => {
      const response = await apiRequest("PATCH", "/api/user/agent-mode", { mode });
      return await response.json() as { success: boolean; agentMode: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: data.agentMode === "active" ? "Active Mode Enabled" : "Passive Mode Enabled",
        description: data.agentMode === "active" 
          ? "m.teg will now autonomously trade based on market conditions."
          : "m.teg will now learn from your prompts without executing trades.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update mode",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    const newMode = checked ? "active" : "passive";
    
    if (newMode === "active") {
      // Show confirmation dialog when switching to active mode
      setShowConfirmDialog(true);
    } else {
      // Switch to passive mode immediately (no confirmation needed)
      updateModeMutation.mutate(newMode);
    }
  };

  const confirmActiveMode = () => {
    updateModeMutation.mutate("active");
    setShowConfirmDialog(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 border-l pl-3">
        <Label htmlFor="agent-mode" className="flex items-center gap-1.5 text-xs cursor-pointer">
          {isActive ? (
            <>
              <Bot className="h-3.5 w-3.5 text-chart-2" />
              <span className="text-chart-2 font-semibold">Active</span>
            </>
          ) : (
            <>
              <BotOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Passive</span>
            </>
          )}
        </Label>
        <Switch
          id="agent-mode"
          checked={isActive}
          onCheckedChange={handleToggle}
          disabled={updateModeMutation.isPending}
          data-testid="switch-agent-mode"
        />
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent data-testid="dialog-confirm-active-mode">
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Active Trading Mode?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                In Active Mode, m.teg will autonomously analyze markets and execute trades
                based on its analysis without requiring your approval for each trade.
              </p>
              <p className="font-semibold">
                This means real money will be used to place trades automatically.
              </p>
              <p>
                You can switch back to Passive Mode at any time to disable autonomous trading.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-active-mode">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmActiveMode}
              data-testid="button-confirm-active-mode"
            >
              Enable Active Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
