import { TrendingUp, TrendingDown, Plus, X, GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import MiniPriceChart from "@/components/MiniPriceChart";

interface HyperliquidMarketData {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

type SortColumn = "price" | "change24h" | "volume24h" | null;
type SortDirection = "asc" | "desc";

const DEFAULT_WATCHLIST = ["BTC-PERP", "ETH-PERP", "SOL-PERP", "ARB-PERP"];
const MAX_WATCHLIST_SIZE = 10;

function SortableWatchlistRow({ 
  market, 
  onRemove,
  sortColumn
}: { 
  market: HyperliquidMarketData;
  onRemove: (symbol: string) => void;
  sortColumn: SortColumn;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: market.symbol });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const price = parseFloat(market.price);
  const change24h = parseFloat(market.change24h);
  const volume24h = parseFloat(market.volume24h);
  const displaySymbol = market.symbol.replace("-PERP", "");

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b last:border-0 hover-elevate"
      data-testid={`row-watchlist-${displaySymbol}`}
    >
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={sortColumn ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing touch-none"}
            title={sortColumn ? "Clear sort to enable drag" : "Drag to reorder"}
            disabled={!!sortColumn}
            {...(!sortColumn ? attributes : {})}
            {...(!sortColumn ? listeners : {})}
            data-testid={`drag-handle-${displaySymbol}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="font-semibold cursor-default">{displaySymbol}/USD</div>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-auto p-3">
              <MiniPriceChart
                symbol={displaySymbol}
                currentPrice={price}
                change24h={change24h}
              />
            </HoverCardContent>
          </HoverCard>
        </div>
      </td>
      <td className="py-2.5 text-right">
        <div className="font-mono font-semibold" data-testid={`text-price-${displaySymbol}`}>
          ${price.toLocaleString()}
        </div>
      </td>
      <td className="py-2.5 text-right">
        <div className={`flex items-center justify-end gap-1 font-mono text-sm font-medium ${
          change24h >= 0 ? "text-long" : "text-short"
        }`}>
          {change24h >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
        </div>
      </td>
      <td className="py-2.5 text-right">
        <div className="font-mono text-sm text-muted-foreground">
          ${volume24h >= 1000000 
            ? `${(volume24h / 1000000).toFixed(1)}M` 
            : volume24h >= 1000
            ? `${(volume24h / 1000).toFixed(1)}K`
            : volume24h.toFixed(0)}
        </div>
      </td>
      <td className="py-2.5 text-right">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onRemove(market.symbol)}
          data-testid={`button-remove-${displaySymbol}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

export default function MarketOverview() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("watchlist");
    return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    const saved = localStorage.getItem("watchlist-sort-column");
    return (saved as SortColumn) || null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem("watchlist-sort-direction");
    return (saved as SortDirection) || "desc";
  });

  const { data, isLoading, error, refetch } = useQuery<{ marketData: HyperliquidMarketData[] }>({
    queryKey: ["/api/hyperliquid/market-data"],
    refetchInterval: 30000,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (sortColumn) {
      localStorage.setItem("watchlist-sort-column", sortColumn);
    } else {
      localStorage.removeItem("watchlist-sort-column");
    }
  }, [sortColumn]);

  useEffect(() => {
    localStorage.setItem("watchlist-sort-direction", sortDirection);
  }, [sortDirection]);

  const allMarkets = data?.marketData || [];
  let watchlistMarkets = allMarkets.filter(m => watchlist.includes(m.symbol));

  // Apply sorting if enabled
  if (sortColumn) {
    watchlistMarkets = [...watchlistMarkets].sort((a, b) => {
      let aVal = 0, bVal = 0;
      
      switch (sortColumn) {
        case "price":
          aVal = parseFloat(a.price);
          bVal = parseFloat(b.price);
          break;
        case "change24h":
          aVal = parseFloat(a.change24h);
          bVal = parseFloat(b.change24h);
          break;
        case "volume24h":
          aVal = parseFloat(a.volume24h);
          bVal = parseFloat(b.volume24h);
          break;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  } else {
    // Maintain custom order from watchlist array
    watchlistMarkets = watchlist
      .map(symbol => allMarkets.find(m => m.symbol === symbol))
      .filter((m): m is HyperliquidMarketData => m !== undefined);
  }
  
  const availableMarkets = allMarkets
    .filter(m => 
      !watchlist.includes(m.symbol) && 
      m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h));

  const addToWatchlist = (symbol: string) => {
    if (watchlist.length < MAX_WATCHLIST_SIZE && !watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol]);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = watchlist.indexOf(active.id as string);
      const newIndex = watchlist.indexOf(over.id as string);
      
      const newWatchlist = arrayMove(watchlist, oldIndex, newIndex);
      setWatchlist(newWatchlist);
      
      // Clear sorting when manually reordering
      setSortColumn(null);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      // Cycle through: desc -> asc -> no sort
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        // Clear sorting to allow manual reordering
        setSortColumn(null);
        setSortDirection("desc");
      }
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <Badge variant="destructive" className="text-xs">Error</Badge>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Failed to load market data
          </p>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => refetch()}
            data-testid="button-retry-market-data"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Watchlist</h2>
          <Badge variant="outline" className="text-xs">
            {watchlist.length}/{MAX_WATCHLIST_SIZE}
          </Badge>
          {sortColumn && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                Sorted by {sortColumn}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSortColumn(null);
                  setSortDirection("desc");
                }}
                className="h-5 px-1.5 text-xs"
                data-testid="button-clear-sort"
              >
                Clear
              </Button>
            </div>
          )}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 gap-1 text-xs"
              disabled={watchlist.length >= MAX_WATCHLIST_SIZE}
              data-testid="button-add-to-watchlist"
            >
              <Plus className="h-3 w-3" />
              Add Pair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Trading Pair</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Search pairs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-pairs"
              />
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {availableMarkets.map((market) => {
                    const price = parseFloat(market.price);
                    const change24h = parseFloat(market.change24h);
                    const displaySymbol = market.symbol.replace("-PERP", "");
                    
                    return (
                      <div
                        key={market.symbol}
                        className="flex items-center justify-between rounded-md border p-3 hover-elevate active-elevate-2"
                        data-testid={`row-available-${displaySymbol}`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold">{displaySymbol}/USD</div>
                          <div className="text-xs text-muted-foreground">
                            ${price.toLocaleString()}
                            <span className={`ml-2 ${change24h >= 0 ? "text-chart-2" : "text-destructive"}`}>
                              {change24h >= 0 ? "+" : ""}{change24h}%
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            addToWatchlist(market.symbol);
                            if (watchlist.length + 1 >= MAX_WATCHLIST_SIZE) {
                              setIsDialogOpen(false);
                            }
                          }}
                          data-testid={`button-add-${displaySymbol}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {availableMarkets.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {searchQuery ? "No pairs found" : "All available pairs are in your watchlist"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Pair</th>
                <th className="pb-2 font-medium text-right">
                  <button
                    onClick={() => handleSort("price")}
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    data-testid="sort-price"
                  >
                    Price
                    {getSortIcon("price")}
                  </button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button
                    onClick={() => handleSort("change24h")}
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    data-testid="sort-change"
                  >
                    24h Change
                    {getSortIcon("change24h")}
                  </button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button
                    onClick={() => handleSort("volume24h")}
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    data-testid="sort-volume"
                  >
                    24h Volume
                    {getSortIcon("volume24h")}
                  </button>
                </th>
                <th className="pb-2 font-medium text-right"></th>
              </tr>
            </thead>
            <SortableContext
              items={watchlistMarkets.map(m => m.symbol)}
              strategy={verticalListSortingStrategy}
              disabled={sortColumn !== null}
            >
              <tbody>
                {watchlistMarkets.map((market) => (
                  <SortableWatchlistRow
                    key={market.symbol}
                    market={market}
                    onRemove={removeFromWatchlist}
                    sortColumn={sortColumn}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
        
        {watchlistMarkets.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No pairs in watchlist. Click "Add Pair" to get started.
          </div>
        )}
      </div>
    </Card>
  );
}
