import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

// Schema for edit order form
const editOrderSchema = z.object({
  price: z.string()
    .min(1, "Price is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Price must be a positive number",
    }),
  size: z.string()
    .min(1, "Size is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Size must be a positive number",
    }),
});

type EditOrderForm = z.infer<typeof editOrderSchema>;

export default function OrderManagementPanel() {
  const { toast } = useToast();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Form for editing orders with validation
  const editForm = useForm<EditOrderForm>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      price: "",
      size: "",
    },
  });

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
    onMutate: () => {
      // Clear drag state when starting mutation to prevent UI from getting stuck
      setDragState(null);
    },
    onSuccess: (_, { order }) => {
      toast({
        title: "Order Modified",
        description: `Successfully updated order for ${order.coin.replace("-PERP", "")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/open-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hyperliquid/positions"] });
      setEditingOrder(null);
    },
    onError: (error: any) => {
      // Clear drag state on error to prevent UI from getting stuck
      setDragState(null);
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

  // Set up drag event listeners
  useEffect(() => {
    if (!dragState) return;

    const handleDragMove = (e: MouseEvent) => {
      // Calculate price change based on vertical movement
      // Moving up = higher price, moving down = lower price
      const deltaY = dragState.initialY - e.clientY;
      const pricePerPixel = dragState.initialPrice * 0.001; // 0.1% per pixel
      const newPrice = Math.max(0.01, dragState.initialPrice + (deltaY * pricePerPixel));
      
      setDragState(prev => prev ? {
        ...prev,
        currentPrice: newPrice,
      } : null);
    };

    const handleDragEnd = () => {
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

    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    
    return () => {
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
    };
  }, [dragState, orders, modifyMutation]);

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    // Reset form with order's current values
    editForm.reset({
      price: order.triggerPx || order.limitPx,
      size: order.sz,
    });
  };

  const handleSaveEdit = (data: EditOrderForm) => {
    if (!editingOrder) return;
    
    const originalPrice = editingOrder.triggerPx || editingOrder.limitPx;
    const originalSize = editingOrder.sz;
    
    modifyMutation.mutate({
      order: editingOrder,
      newPrice: data.price !== originalPrice ? data.price : undefined,
      newSize: data.size !== originalSize ? data.size : undefined,
    });
  };

  const handleCloseEditDialog = () => {
    setEditingOrder(null);
    editForm.reset();
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
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent data-testid="dialog-edit-order">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>
              Modify the price and size of your order for {editingOrder?.coin.replace("-PERP", "")}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter price"
                        data-testid="input-edit-price"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="Enter size"
                        data-testid="input-edit-size"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handleCloseEditDialog}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={modifyMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {modifyMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
