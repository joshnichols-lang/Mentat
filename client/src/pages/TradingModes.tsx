import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import Header from "@/components/Header";

type TradingMode = {
  id: string;
  userId: string;
  name: string;
  type: string;
  description: string | null;
  parameters: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModeFormData = {
  name: string;
  type: string;
  description: string;
  timeframe: string;
  riskPercentage: string;
  maxPositions: string;
  preferredLeverage: string;
  preferredAssets: string;
  customRules: string;
};

export default function TradingModes() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<TradingMode | null>(null);
  const [formData, setFormData] = useState<ModeFormData>({
    name: "",
    type: "scalp",
    description: "",
    timeframe: "5m",
    riskPercentage: "2",
    maxPositions: "3",
    preferredLeverage: "10",
    preferredAssets: "",
    customRules: "",
  });

  const { data: modesData, isLoading } = useQuery<{ modes: TradingMode[] }>({
    queryKey: ["/api/trading-modes"],
  });

  const createModeMutation = useMutation({
    mutationFn: async (data: Partial<TradingMode>) => {
      return apiRequest("POST", "/api/trading-modes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes/active"] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Trading mode created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create trading mode",
      });
    },
  });

  const updateModeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TradingMode> }) => {
      return apiRequest("PUT", `/api/trading-modes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes/active"] });
      setEditingMode(null);
      resetForm();
      toast({
        title: "Success",
        description: "Trading mode updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update trading mode",
      });
    },
  });

  const activateModeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/trading-modes/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes/active"] });
      toast({
        title: "Success",
        description: "Trading mode activated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to activate trading mode",
      });
    },
  });

  const deleteModeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/trading-modes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes/active"] });
      toast({
        title: "Success",
        description: "Trading mode deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete trading mode",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "scalp",
      description: "",
      timeframe: "5m",
      riskPercentage: "2",
      maxPositions: "3",
      preferredLeverage: "10",
      preferredAssets: "",
      customRules: "",
    });
  };

  const loadModeToForm = (mode: TradingMode) => {
    setFormData({
      name: mode.name,
      type: mode.type,
      description: mode.description || "",
      timeframe: mode.parameters?.timeframe || "5m",
      riskPercentage: mode.parameters?.riskPercentage?.toString() || "2",
      maxPositions: mode.parameters?.maxPositions?.toString() || "3",
      preferredLeverage: mode.parameters?.preferredLeverage?.toString() || "10",
      preferredAssets: mode.parameters?.preferredAssets || "",
      customRules: mode.parameters?.customRules || "",
    });
    setEditingMode(mode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parameters = {
      timeframe: formData.timeframe,
      riskPercentage: parseFloat(formData.riskPercentage),
      maxPositions: parseInt(formData.maxPositions),
      preferredLeverage: parseFloat(formData.preferredLeverage),
      preferredAssets: formData.preferredAssets,
      customRules: formData.customRules,
    };

    const modeData = {
      name: formData.name,
      type: formData.type,
      description: formData.description || null,
      parameters,
    };

    if (editingMode) {
      updateModeMutation.mutate({ id: editingMode.id, data: modeData });
    } else {
      createModeMutation.mutate(modeData);
    }
  };

  const modes = modesData?.modes || [];
  const activeMode = modes.find((m) => m.isActive);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Trading Strategies</h1>
            <p className="text-muted-foreground" data-testid="text-subtitle">
              Define and manage your trading strategies with custom parameters
            </p>
          </div>
          <Dialog open={isCreateOpen || !!editingMode} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingMode(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-mode">
                <Plus className="w-4 h-4 mr-2" />
                New Strategy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-dialog-title">
                  {editingMode ? "Edit Trading Strategy" : "Create Trading Strategy"}
                </DialogTitle>
                <DialogDescription>
                  Configure your trading strategy parameters and risk management settings
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Strategy Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Scalp BTC 5m"
                      required
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Strategy Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger id="type" data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scalp">Scalp Trading</SelectItem>
                        <SelectItem value="swing">Swing Trading</SelectItem>
                        <SelectItem value="discretionary">Discretionary</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your trading strategy..."
                    rows={2}
                    data-testid="input-description"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Strategy Parameters</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timeframe">Timeframe</Label>
                      <Select value={formData.timeframe} onValueChange={(value) => setFormData({ ...formData, timeframe: value })}>
                        <SelectTrigger id="timeframe" data-testid="select-timeframe">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1m">1 Minute</SelectItem>
                          <SelectItem value="5m">5 Minutes</SelectItem>
                          <SelectItem value="15m">15 Minutes</SelectItem>
                          <SelectItem value="1h">1 Hour</SelectItem>
                          <SelectItem value="4h">4 Hours</SelectItem>
                          <SelectItem value="1d">1 Day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="riskPercentage">Risk Per Trade (%)</Label>
                      <Input
                        id="riskPercentage"
                        type="number"
                        step="0.1"
                        value={formData.riskPercentage}
                        onChange={(e) => setFormData({ ...formData, riskPercentage: e.target.value })}
                        placeholder="2.0"
                        data-testid="input-risk"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPositions">Max Concurrent Positions</Label>
                      <Input
                        id="maxPositions"
                        type="number"
                        value={formData.maxPositions}
                        onChange={(e) => setFormData({ ...formData, maxPositions: e.target.value })}
                        placeholder="3"
                        data-testid="input-max-positions"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredLeverage">Preferred Leverage</Label>
                      <Input
                        id="preferredLeverage"
                        type="number"
                        value={formData.preferredLeverage}
                        onChange={(e) => setFormData({ ...formData, preferredLeverage: e.target.value })}
                        placeholder="10"
                        data-testid="input-leverage"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Additional Settings</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="preferredAssets">Preferred Assets (comma-separated)</Label>
                      <Input
                        id="preferredAssets"
                        value={formData.preferredAssets}
                        onChange={(e) => setFormData({ ...formData, preferredAssets: e.target.value })}
                        placeholder="BTC, ETH, SOL"
                        data-testid="input-assets"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customRules">Custom Rules (Optional)</Label>
                      <Textarea
                        id="customRules"
                        value={formData.customRules}
                        onChange={(e) => setFormData({ ...formData, customRules: e.target.value })}
                        placeholder="Enter any specific rules or conditions..."
                        rows={3}
                        data-testid="input-custom-rules"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingMode(null);
                      resetForm();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createModeMutation.isPending || updateModeMutation.isPending}
                    data-testid="button-save"
                  >
                    {editingMode ? "Update Strategy" : "Create Strategy"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {activeMode && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <CardTitle data-testid="text-active-title">Active Strategy</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg" data-testid="text-active-name">{activeMode.name}</h3>
                <p className="text-sm text-muted-foreground capitalize" data-testid="text-active-type">
                  {activeMode.type} Trading
                </p>
                {activeMode.description && (
                  <p className="text-sm" data-testid="text-active-description">{activeMode.description}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Timeframe</p>
                    <p className="font-semibold" data-testid="text-active-timeframe">{activeMode.parameters.timeframe}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Risk Per Trade</p>
                    <p className="font-semibold" data-testid="text-active-risk">{activeMode.parameters.riskPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Positions</p>
                    <p className="font-semibold" data-testid="text-active-positions">{activeMode.parameters.maxPositions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Leverage</p>
                    <p className="font-semibold" data-testid="text-active-leverage">{activeMode.parameters.preferredLeverage}x</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading trading strategies...</p>
          </div>
        ) : modes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No trading strategies defined yet</p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Strategy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {modes.map((mode) => (
              <Card key={mode.id} className={mode.isActive ? "border-primary" : ""} data-testid={`card-mode-${mode.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {mode.isActive ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" data-testid={`icon-active-${mode.id}`} />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" data-testid={`icon-inactive-${mode.id}`} />
                      )}
                      <CardTitle data-testid={`text-name-${mode.id}`}>{mode.name}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      {!mode.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => activateModeMutation.mutate(mode.id)}
                          disabled={activateModeMutation.isPending}
                          data-testid={`button-activate-${mode.id}`}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => loadModeToForm(mode)}
                        data-testid={`button-edit-${mode.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete "${mode.name}"?`)) {
                            deleteModeMutation.mutate(mode.id);
                          }
                        }}
                        disabled={deleteModeMutation.isPending}
                        data-testid={`button-delete-${mode.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="capitalize" data-testid={`text-type-${mode.id}`}>
                    {mode.type} Trading
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mode.description && (
                    <p className="text-sm mb-4" data-testid={`text-description-${mode.id}`}>{mode.description}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Timeframe</p>
                      <p className="font-semibold" data-testid={`text-timeframe-${mode.id}`}>{mode.parameters.timeframe}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Risk Per Trade</p>
                      <p className="font-semibold" data-testid={`text-risk-${mode.id}`}>{mode.parameters.riskPercentage}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Positions</p>
                      <p className="font-semibold" data-testid={`text-positions-${mode.id}`}>{mode.parameters.maxPositions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Leverage</p>
                      <p className="font-semibold" data-testid={`text-leverage-${mode.id}`}>{mode.parameters.preferredLeverage}x</p>
                    </div>
                  </div>
                  {mode.parameters.preferredAssets && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Preferred Assets</p>
                      <p className="text-sm" data-testid={`text-assets-${mode.id}`}>{mode.parameters.preferredAssets}</p>
                    </div>
                  )}
                  {mode.parameters.customRules && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Custom Rules</p>
                      <p className="text-sm" data-testid={`text-rules-${mode.id}`}>{mode.parameters.customRules}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
