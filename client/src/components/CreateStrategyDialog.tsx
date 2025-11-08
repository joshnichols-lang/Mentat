import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ModeFormData = {
  name: string;
  description: string;
  timeframe: string;
  riskPercentage: string;
  maxPositions: string;
  preferredLeverage: string;
  maxEntryOrdersPerSymbol: string;
  preferredAssets: string;
  restrictedAssets: string;
  customRules: string;
};

interface CreateStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStrategyDialog({ open, onOpenChange }: CreateStrategyDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ModeFormData>({
    name: "",
    description: "",
    timeframe: "5m",
    riskPercentage: "2",
    maxPositions: "3",
    preferredLeverage: "10",
    maxEntryOrdersPerSymbol: "3",
    preferredAssets: "",
    restrictedAssets: "",
    customRules: "",
  });

  const createModeMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/trading-modes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading-modes/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio-manager/status"] });
      onOpenChange(false);
      resetForm();
      toast({
        title: "Success",
        description: "Strategy created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create strategy",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      timeframe: "5m",
      riskPercentage: "2",
      maxPositions: "3",
      preferredLeverage: "10",
      maxEntryOrdersPerSymbol: "3",
      preferredAssets: "",
      restrictedAssets: "",
      customRules: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parameters = {
      timeframe: formData.timeframe,
      riskPercentage: parseFloat(formData.riskPercentage),
      maxPositions: parseInt(formData.maxPositions),
      preferredLeverage: parseFloat(formData.preferredLeverage),
      maxEntryOrdersPerSymbol: parseInt(formData.maxEntryOrdersPerSymbol),
      preferredAssets: formData.preferredAssets,
      restrictedAssets: formData.restrictedAssets,
      customRules: formData.customRules,
    };

    const modeData = {
      name: formData.name,
      description: formData.description || null,
      parameters,
    };

    createModeMutation.mutate(modeData);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Create Trading Strategy</DialogTitle>
          <DialogDescription>
            Configure your trading strategy parameters and risk management settings
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="maxEntryOrdersPerSymbol">Max Entry Orders Per Symbol</Label>
                <Input
                  id="maxEntryOrdersPerSymbol"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.maxEntryOrdersPerSymbol}
                  onChange={(e) => setFormData({ ...formData, maxEntryOrdersPerSymbol: e.target.value })}
                  placeholder="3"
                  data-testid="input-max-entry-orders"
                />
                <p className="text-xs text-muted-foreground">Limits scaled entry orders per symbol (e.g., 3 allows scaling into positions with up to 3 orders)</p>
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
                <p className="text-xs text-muted-foreground">Suggestion for AI - not a hard restriction</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="restrictedAssets">Restrict Trading To (comma-separated)</Label>
                <Input
                  id="restrictedAssets"
                  value={formData.restrictedAssets}
                  onChange={(e) => setFormData({ ...formData, restrictedAssets: e.target.value })}
                  placeholder="BTC (leave empty for no restriction)"
                  data-testid="input-restricted-assets"
                />
                <p className="text-xs text-muted-foreground">HARD limit - AI can ONLY trade these assets if set</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customRules">Custom Rules (Optional)</Label>
                <Textarea
                  id="customRules"
                  value={formData.customRules}
                  onChange={(e) => setFormData({ ...formData, customRules: e.target.value })}
                  placeholder="e.g., Buy when RSI drops below 30. Exit when RSI exceeds 70."
                  rows={4}
                  data-testid="input-custom-rules"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Tip: The AI will analyze your rules and auto-configure monitoring!</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer hover:text-foreground">Show Examples</summary>
                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-primary/20">
                      <div>
                        <p className="font-medium">Indicator Strategy:</p>
                        <p className="italic">"Scalp reversals when RSI &lt; 30 on 5m chart. Take profit when RSI &gt; 70."</p>
                      </div>
                      <div>
                        <p className="font-medium">Order Flow Strategy:</p>
                        <p className="italic">"Enter when bid/ask imbalance exceeds 70% for 3+ consecutive snapshots. Monitor orderbook depth."</p>
                      </div>
                      <div>
                        <p className="font-medium">Market Profile Strategy:</p>
                        <p className="italic">"Buy breakouts above Value Area High. Exit below Point of Control."</p>
                      </div>
                      <div>
                        <p className="font-medium">Hybrid Strategy:</p>
                        <p className="italic">"Enter when RSI &lt; 30 AND strong bid pressure (&gt;65% imbalance). Combine MACD crossover with TPO levels."</p>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createModeMutation.isPending}
              data-testid="button-save"
            >
              Create Strategy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
