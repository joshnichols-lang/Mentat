import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AssetSelectorProps {
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
  className?: string;
}

const AVAILABLE_ASSETS = [
  { value: "ETH", label: "Ethereum", symbol: "ETH" },
  { value: "BTC", label: "Bitcoin", symbol: "BTC" },
  { value: "SOL", label: "Solana", symbol: "SOL" },
  { value: "ARB", label: "Arbitrum", symbol: "ARB" },
];

export default function AssetSelector({ selectedAsset, onAssetChange, className }: AssetSelectorProps) {
  const currentAsset = AVAILABLE_ASSETS.find(a => a.value === selectedAsset) || AVAILABLE_ASSETS[0];

  return (
    <Select value={selectedAsset} onValueChange={onAssetChange}>
      <SelectTrigger 
        data-testid="select-asset" 
        className={`w-[200px] bg-background border border-border/50 hover-elevate ${className || ''}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Asset:</span>
          <SelectValue>
            <span className="font-medium">{currentAsset.label}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border border-border/50">
        {AVAILABLE_ASSETS.map((asset) => (
          <SelectItem 
            key={asset.value} 
            value={asset.value}
            data-testid={`asset-option-${asset.value}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{asset.label}</span>
              <span className="text-xs text-muted-foreground">({asset.symbol})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
