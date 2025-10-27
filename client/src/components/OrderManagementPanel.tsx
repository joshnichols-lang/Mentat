import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  X,
  Edit2,
  GripVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface Order {
  oid: number;
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  reduceOnly: boolean;
  orderType?: string;
  triggerPx?: string;
  tpsl?: string;
}

interface DragState {
  orderId: number;
  initialY: number;
  initialPrice: number;
  currentPrice: number;
}

export default function OrderManagementPanel() {
  const { toast } = useToast();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editSize, setEditSize] = useState("");

  // Fetch open orders
  const { data: ordersData, isLoading } = useQuery<{ orders: Order[] }>({
    queryKey: ["/api/hyperliquid/open-orders"],
    refetchInterval: 10000,
  });

  const orders = ordersData?.orders || [];

  // Separate orders by type
  const entryOrders = orders.filter(o => !o.reduceOnly);
  const stopLosses = orders.filter(o => o.reduceOnly && o.tpsl === "sl");
  const takeProfits = orders.filter(o => o.reduceOnly && o.tpsl === "tp");

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ coin, oid }: { coin: string; oid: number }) => {
      const response = await apiRequest("POST", "/api/hyperliquid/cancel-order", { coin, oid });
      return response.json();
    },
    onSuccess: (_, { coin }) => {
      toast({
        title: "Order Cancelled",
        description: `Successfully cancelled order for ${coin.replace("-PERP", "")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/open-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/positions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Failed to cancel order",
        variant: "destructive",
      });
    },
  });

  // Modify order mutation (cancel + replace)
  const modifyMutation = useMutation({
    mutationFn: async ({ 
      order, 
      newPrice, 
      newSize 
    }: { 
      order: Order; 
      newPrice?: string; 
      newSize?: string; 
    }) => {
      const response = await apiRequest("POST", "/api/hyperliquid/modify-order", {
        coin: order.coin,
        oid: order.oid,
        newLimitPx: newPrice,
        newSz: newSize,
        side: order.side,
        reduceOnly: order.reduceOnly,
        orderType: order.orderType,
        triggerPx: order.triggerPx,
        tpsl: order.tpsl,
      });
      return response.json();
    },
    onSuccess: (_, { order }) => {
      toast({
        title: "Order Modified",
        description: `Successfully updated order for ${order.coin.replace("-PERP", "")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/open-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/positions"] });
      setEditingOrder(null);
      setDragState(null);
    },
    onError: (error: any) => {
      toast({
        title: "Modify Failed",
        description: error.message || "Failed to modify order",
        variant: "destructive",
      });
    },
  });

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, order: Order) => {
    const price = parseFloat(order.triggerPx || order.limitPx);
    setDragState({
      orderId: order.oid,
      initialY: e.clientY,
      initialPrice: price,
      currentPrice: price,
    });
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!dragState) return;
    
    // Calculate price change based on vertical movement
    // Moving up = higher price, moving down = lower price
    const deltaY = dragState.initialY - e.clientY;
    const pricePerPixel = dragState.initialPrice * 0.001; // 0.1% per pixel
    const newPrice = Math.max(0.01, dragState.initialPrice + (deltaY * pricePerPixel));
    
    setDragState({
      ...dragState,
      currentPrice: newPrice,
    });
  };

  const handleDragEnd = () => {
    if (!dragState) return;
    
    const order = orders.find(o => o.oid === dragState.orderId);
    if (!order) {
      setDragState(null);
      return;
    }

    const currentPrice = parseFloat(order.triggerPx || order.limitPx);
    const priceChanged = Math.abs(dragState.currentPrice - currentPrice) > 0.01;

    if (priceChanged) {
      modifyMutation.mutate({
        order,
        newPrice: dragState.currentPrice.toFixed(2),
      });
    } else {
      setDragState(null);
    }
  };

  // Set up drag event listeners
  useState(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();

    if (dragState) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  });

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setEditPrice(order.triggerPx || order.limitPx);
    setEditSize(order.sz);
  };

  const handleSaveEdit = () => {
    if (!editingOrder) return;
    
    modifyMutation.mutate({
      order: editingOrder,
      newPrice: editPrice !== (editingOrder.triggerPx || editingOrder.limitPx) ? editPrice : undefined,
      newSize: editSize !== editingOrder.sz ? editSize : undefined,
    });
  };

  const getOrderTypeLabel = (order: Order) => {
    if (order.tpsl === "tp") return "Take Profit";
    if (order.tpsl === "sl") return "Stop Loss";
    if (order.orderType?.includes("trigger")) return "Stop Order";
    return order.limitPx ? "Limit" : "Market";
  };

  const OrderRow = ({ order, isDragging }: { order: Order; isDragging: boolean }) => {
    const isBuy = order.side.toLowerCase() === "buy";
    const price = dragState?.orderId === order.oid 
      ? dragState.currentPrice 
      : parseFloat(order.triggerPx || order.limitPx);
    const size = parseFloat(order.sz);

    return (
      <div
        className={`
          flex items-center gap-3 p-3 rounded-lg border border-border/40
          hover:border-primary/30 transition-all duration-200
          ${isDragging ? 'bg-primary/5 border-primary/50 shadow-md' : 'bg-background/50'}
        `}
        data-testid={`order-row-${order.oid}`}
      >
        {/* Drag handle */}
        <div
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors"
          onMouseDown={(e) => handleDragStart(e, order)}
          data-testid={`drag-handle-${order.oid}`}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Symbol & Side */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" data-testid={`order-symbol-${order.oid}`}>
              {order.coin.replace("-PERP", "")}
            </span>
            <Badge 
              variant={isBuy ? "default" : "destructive"} 
              className="text-xs"
              data-testid={`order-side-${order.oid}`}
            >
              {isBuy ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {isBuy ? "LONG" : "SHORT"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1" data-testid={`order-type-${order.oid}`}>
            {getOrderTypeLabel(order)}
          </p>
        </div>

        {/* Price */}
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span className={`text-sm font-mono ${isDragging ? 'text-primary font-semibold' : 'text-foreground'}`} data-testid={`order-price-${order.oid}`}>
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {isDragging && <AlertCircle className="w-3 h-3 text-primary animate-pulse" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {size.toFixed(4)} {order.coin.split("-")[0]}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => handleEdit(order)}
            data-testid={`button-edit-${order.oid}`}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => cancelMutation.mutate({ coin: order.coin, oid: order.oid })}
            disabled={cancelMutation.isPending}
            data-testid={`button-cancel-${order.oid}`}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Order Management</CardTitle>
            <Badge variant="outline" className="text-xs" data-testid="total-orders-badge">
              {orders.length} Order{orders.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="entry" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="entry" className="text-xs" data-testid="tab-entry-orders">
                Entry ({entryOrders.length})
              </TabsTrigger>
              <TabsTrigger value="stops" className="text-xs" data-testid="tab-stop-losses">
                Stops ({stopLosses.length})
              </TabsTrigger>
              <TabsTrigger value="targets" className="text-xs" data-testid="tab-take-profits">
                Targets ({takeProfits.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entry" className="space-y-2 mt-0">
              {entryOrders.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground" data-testid="empty-entry-orders">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No entry orders
                </div>
              ) : (
                entryOrders.map(order => (
                  <OrderRow 
                    key={order.oid} 
                    order={order} 
                    isDragging={dragState?.orderId === order.oid} 
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="stops" className="space-y-2 mt-0">
              {stopLosses.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground" data-testid="empty-stop-losses">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No stop losses
                </div>
              ) : (
                stopLosses.map(order => (
                  <OrderRow 
                    key={order.oid} 
                    order={order} 
                    isDragging={dragState?.orderId === order.oid} 
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="targets" className="space-y-2 mt-0">
              {takeProfits.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground" data-testid="empty-take-profits">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No take profits
                </div>
              ) : (
                takeProfits.map(order => (
                  <OrderRow 
                    key={order.oid} 
                    order={order} 
                    isDragging={dragState?.orderId === order.oid} 
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent data-testid="dialog-edit-order">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>
              Modify the price and size of your order for {editingOrder?.coin.replace("-PERP", "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price ($)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                data-testid="input-edit-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-size">Size</Label>
              <Input
                id="edit-size"
                type="number"
                step="0.0001"
                value={editSize}
                onChange={(e) => setEditSize(e.target.value)}
                data-testid="input-edit-size"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditingOrder(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={modifyMutation.isPending}
              data-testid="button-save-edit"
            >
              {modifyMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
