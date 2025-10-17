import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Market {
  symbol: string;
  displayName: string;
  type: 'perp' | 'spot';
  szDecimals?: number;
  maxLeverage?: number;
  index: number;
  tokens?: number[];
}

interface TradingPairSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TradingPairSelector({ value, onChange }: TradingPairSelectorProps) {
  const [open, setOpen] = useState(false);

  // Fetch all available markets
  const { data: marketsData, isLoading } = useQuery<{ success: boolean; markets: Market[] }>({
    queryKey: ["/api/hyperliquid/markets"],
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  const markets = marketsData?.markets || [];
  
  // Find the selected market
  const selectedMarket = markets.find(m => m.symbol === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between font-mono"
          data-testid="button-trading-pair-selector"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {selectedMarket ? (
              <span>{selectedMarket.displayName}</span>
            ) : (
              <span className="text-muted-foreground">Select pair...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search trading pairs..." 
            data-testid="input-search-pairs"
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading markets..." : "No trading pair found."}
            </CommandEmpty>
            
            {/* Perpetuals Group */}
            <CommandGroup heading="Perpetuals" className="font-mono">
              {markets
                .filter(m => m.type === 'perp')
                .map((market) => (
                  <CommandItem
                    key={market.symbol}
                    value={market.symbol}
                    onSelect={(currentValue) => {
                      onChange(currentValue.toUpperCase());
                      setOpen(false);
                    }}
                    data-testid={`option-${market.symbol.toLowerCase()}`}
                    className="font-mono"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === market.symbol ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <span>{market.displayName}</span>
                      {market.maxLeverage && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {market.maxLeverage}x
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>

            {/* Spot Group */}
            <CommandGroup heading="Spot" className="font-mono">
              {markets
                .filter(m => m.type === 'spot')
                .map((market) => (
                  <CommandItem
                    key={market.symbol}
                    value={market.symbol}
                    onSelect={(currentValue) => {
                      onChange(currentValue.toUpperCase());
                      setOpen(false);
                    }}
                    data-testid={`option-${market.symbol.toLowerCase()}`}
                    className="font-mono"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === market.symbol ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{market.displayName}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
