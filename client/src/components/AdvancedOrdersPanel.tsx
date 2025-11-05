import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, X, TrendingUp, Target, Layers, IceCream, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistance } from "date-fns";

interface AdvancedOrder {
  id: string;
  orderType: string;
  symbol: string;
  side: string;
  totalSize: string;
  executedSize: string;
  status: string;
  progress: string;
  parameters: any;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  averageExecutionPrice: string | null;
  errorCount: number;
  lastError: string | null;
}

export function AdvancedOrdersPanel() {
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<AdvancedOrder[]>({
    queryKey: ["/api/advanced-orders"],
  });

  const handleExecute = async (orderId: string) => {
    try {
      await apiRequest(`/api/advanced-orders/${orderId}/execute`, {
        method: "POST",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-orders"] });
      
      toast({
        title: "Order Started",
        description: "Advanced order execution has begun",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start order",
        variant: "destructive",
      });
    }
  };

  const handlePause = async (orderId: string) => {
    try {
      await apiRequest(`/api/advanced-orders/${orderId}/pause`, {
        method: "POST",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-orders"] });
      
      toast({
        title: "Order Paused",
        description: "Order execution paused successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to pause order",
        variant: "destructive",
      });
    }
  };

  const handleResume = async (orderId: string) => {
    try {
      await apiRequest(`/api/advanced-orders/${orderId}/resume`, {
        method: "POST",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-orders"] });
      
      toast({
        title: "Order Resumed",
        description: "Order execution resumed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resume order",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await apiRequest(`/api/advanced-orders/${orderId}/cancel`, {
        method: "POST",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-orders"] });
      
      toast({
        title: "Order Cancelled",
        description: "Order cancelled successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel order",
        variant: "destructive",
      });
    }
  };

  const getOrderIcon = (type: string) => {
    switch (type) {
      case "twap":
        return <TrendingUp className="w-4 h-4" />;
      case "limit_chase":
        return <Target className="w-4 h-4" />;
      case "scaled":
        return <Layers className="w-4 h-4" />;
      case "iceberg":
        return <IceCream className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "paused":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "completed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelled":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Advanced Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading orders...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Advanced Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mb-3 opacity-30" />
            <p>No advanced orders yet</p>
            <p className="text-sm">Create a TWAP, Limit Chase, or Scaled order to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Advanced Orders ({orders.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-background rounded-lg p-4 space-y-3 border border-border/30"
            data-testid={`advanced-order-${order.id}`}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {getOrderIcon(order.orderType)}
                  <span className="font-semibold text-sm uppercase">{order.orderType}</span>
                </div>
                <Badge className={getStatusColor(order.status)} data-testid={`status-${order.id}`}>
                  {order.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {order.symbol}
                </span>
                <Badge variant={order.side === "buy" ? "default" : "destructive"}>
                  {order.side.toUpperCase()}
                </Badge>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {order.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExecute(order.id)}
                    data-testid={`button-execute-${order.id}`}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Start
                  </Button>
                )}
                
                {order.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePause(order.id)}
                    data-testid={`button-pause-${order.id}`}
                  >
                    <Pause className="w-3 h-3 mr-1" />
                    Pause
                  </Button>
                )}
                
                {order.status === "paused" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResume(order.id)}
                    data-testid={`button-resume-${order.id}`}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Resume
                  </Button>
                )}
                
                {(order.status === "pending" || order.status === "active" || order.status === "paused") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancel(order.id)}
                    data-testid={`button-cancel-${order.id}`}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                )}
                
                {order.status === "completed" && (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {(order.status === "active" || order.status === "paused" || order.status === "completed") && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{parseFloat(order.progress).toFixed(1)}%</span>
                </div>
                <Progress value={parseFloat(order.progress)} className="h-1.5" />
              </div>
            )}

            {/* Details Row */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Size:</span>
                <span className="ml-2 font-medium">
                  {parseFloat(order.executedSize).toFixed(4)} / {parseFloat(order.totalSize).toFixed(4)}
                </span>
              </div>
              
              {order.averageExecutionPrice && (
                <div>
                  <span className="text-muted-foreground">Avg Price:</span>
                  <span className="ml-2 font-medium">${parseFloat(order.averageExecutionPrice).toFixed(2)}</span>
                </div>
              )}
              
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2 font-medium">
                  {formatDistance(new Date(order.createdAt), new Date(), { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Parameters Summary */}
            <div className="text-xs text-muted-foreground">
              {order.orderType === "twap" && order.parameters && (
                <span>
                  {order.parameters.slices} slices over {order.parameters.durationMinutes} minutes
                  {order.parameters.randomizeIntervals && " (randomized)"}
                </span>
              )}
              {order.orderType === "limit_chase" && order.parameters && (
                <span>
                  Offset: {order.parameters.offset} ticks, Max chases: {order.parameters.maxChases}
                </span>
              )}
              {order.orderType === "scaled" && order.parameters && (
                <span>
                  {order.parameters.levels} levels from ${parseFloat(order.parameters.priceStart).toFixed(2)} 
                  {" "}to ${parseFloat(order.parameters.priceEnd).toFixed(2)}
                </span>
              )}
              {order.orderType === "iceberg" && order.parameters && (
                <span>
                  Display: {order.parameters.displaySize}, Refresh: {order.parameters.refreshBehavior}
                </span>
              )}
            </div>

            {/* Error Display */}
            {order.lastError && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded p-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{order.lastError}</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
