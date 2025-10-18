import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BookOpen, TrendingUp, TrendingDown, Circle, CheckCircle2, Clock } from "lucide-react";
import Header from "@/components/Header";

interface TradeJournalEntry {
  id: string;
  tradeId: string | null;
  symbol: string;
  side: "buy" | "sell";
  entryType: "limit" | "market";
  status: "planned" | "active" | "closed";
  entryReasoning: string | null;
  expectations: {
    stopLoss: string | null;
    takeProfit: string | null;
    riskRewardRatio: string | null;
    expectedDuration: string | null;
  } | null;
  prices: {
    entry: string | null;
    exit: string | null;
    stopLoss: string | null;
    takeProfit: string | null;
  } | null;
  closeAnalysis: {
    profitAnalysis: string | null;
    targetHit: boolean | null;
    adjustmentsMade: string | null;
    whatWentWrong: string | null;
    lessonsLearned: string | null;
    anomalyDetected: boolean | null;
  } | null;
  createdAt: string;
  activatedAt: string | null;
  closedAt: string | null;
}

export default function TradeJournal() {
  const [selectedEntry, setSelectedEntry] = useState<TradeJournalEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");

  const { data: entriesData, isLoading } = useQuery<{ success: boolean; entries: TradeJournalEntry[] }>({
    queryKey: ["/api/trade-journal", { status: statusFilter !== "all" ? statusFilter : undefined, symbol: symbolFilter !== "all" ? symbolFilter : undefined }]
  });

  const entries = entriesData?.entries || [];
  const symbols = Array.from(new Set(entries.map(e => e.symbol))).sort();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "planned":
        return <Badge variant="outline" className="uppercase text-xs" data-testid={`badge-status-${status}`}><Clock className="w-3 h-3 mr-1" />PLANNED</Badge>;
      case "active":
        return <Badge variant="default" className="uppercase text-xs" data-testid={`badge-status-${status}`}><Circle className="w-3 h-3 mr-1" />ACTIVE</Badge>;
      case "closed":
        return <Badge variant="secondary" className="uppercase text-xs" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />CLOSED</Badge>;
      default:
        return <Badge variant="outline" className="uppercase text-xs">{status}</Badge>;
    }
  };

  const getSideBadge = (side: string) => {
    if (side === "buy") {
      return <Badge className="uppercase text-xs bg-[hsl(120,25%,35%)] dark:bg-[hsl(120,25%,60%)] text-white dark:text-black" data-testid={`badge-side-${side}`}><TrendingUp className="w-3 h-3 mr-1" />LONG</Badge>;
    }
    return <Badge className="uppercase text-xs bg-[hsl(0,30%,40%)] dark:bg-[hsl(0,30%,55%)] text-white dark:text-black" data-testid={`badge-side-${side}`}><TrendingDown className="w-3 h-3 mr-1" />SHORT</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "-";
    return parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-[1600px] p-6 space-y-6" data-testid="page-trade-journal">
      {/* Newspaper Header */}
      <div className="border-b-4 border-double border-foreground pb-4">
        <h1 className="text-4xl font-bold uppercase tracking-tight flex items-center gap-3" data-testid="text-page-title">
          <BookOpen className="w-10 h-10" />
          TRADE JOURNAL
        </h1>
        <p className="text-sm uppercase tracking-wide text-muted-foreground mt-2">
          AI REASONING & TRADE DOCUMENTATION
        </p>
      </div>

      {/* Filters */}
      <Card className="rounded-none border-solid">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl uppercase tracking-normal">FILTERS</CardTitle>
          <CardDescription className="uppercase text-xs tracking-wider">
            REFINE JOURNAL ENTRIES
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter" className="text-sm uppercase tracking-wide">STATUS</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" className="border-solid" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL STATUSES</SelectItem>
                  <SelectItem value="planned">PLANNED</SelectItem>
                  <SelectItem value="active">ACTIVE</SelectItem>
                  <SelectItem value="closed">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol-filter" className="text-sm uppercase tracking-wide">SYMBOL</Label>
              <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                <SelectTrigger id="symbol-filter" className="border-solid" data-testid="select-symbol-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL SYMBOLS</SelectItem>
                  {symbols.map(symbol => (
                    <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card className="rounded-none border-solid">
        <CardHeader>
          <CardTitle className="text-xl uppercase tracking-normal">JOURNAL ENTRIES</CardTitle>
          <CardDescription className="uppercase text-xs tracking-wider">
            {entries.length} TOTAL ENTRIES
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground uppercase tracking-wide">
              LOADING JOURNAL...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground uppercase tracking-wide">
              NO ENTRIES FOUND
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-solid hover:bg-transparent">
                    <TableHead className="uppercase text-xs tracking-wider font-bold">DATE</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-bold">SYMBOL</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-bold">SIDE</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-bold">TYPE</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-bold">STATUS</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-bold">REASONING</TableHead>
                    <TableHead className="uppercase text-xs tracking-wider font-bold">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="border-b border-solid" data-testid={`row-journal-entry-${entry.id}`}>
                      <TableCell className="font-mono text-xs" data-testid={`text-date-${entry.id}`}>
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell className="font-bold" data-testid={`text-symbol-${entry.id}`}>{entry.symbol}</TableCell>
                      <TableCell>{getSideBadge(entry.side)}</TableCell>
                      <TableCell className="uppercase text-xs" data-testid={`text-type-${entry.id}`}>{entry.entryType}</TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground" data-testid={`text-reasoning-preview-${entry.id}`}>
                        {entry.entryReasoning || "-"}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedEntry(entry)}
                          className="uppercase text-xs tracking-wide"
                          data-testid={`button-view-details-${entry.id}`}
                        >
                          VIEW
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto rounded-none border-solid" data-testid="dialog-entry-details">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl uppercase tracking-normal flex items-center gap-2">
                  {selectedEntry.symbol} - {selectedEntry.side === "buy" ? "LONG" : "SHORT"} POSITION
                </DialogTitle>
                <DialogDescription className="uppercase text-xs tracking-wider">
                  ENTRY ID: {selectedEntry.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status & Metadata */}
                <div className="grid grid-cols-2 gap-4 border-solid border p-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">STATUS</Label>
                    <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">SIDE</Label>
                    <div className="mt-1">{getSideBadge(selectedEntry.side)}</div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">ENTRY TYPE</Label>
                    <div className="mt-1 uppercase font-bold" data-testid="text-detail-type">{selectedEntry.entryType}</div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">CREATED</Label>
                    <div className="mt-1 font-mono text-sm" data-testid="text-detail-created">{formatDate(selectedEntry.createdAt)}</div>
                  </div>
                  {selectedEntry.activatedAt && (
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">ACTIVATED</Label>
                      <div className="mt-1 font-mono text-sm" data-testid="text-detail-activated">{formatDate(selectedEntry.activatedAt)}</div>
                    </div>
                  )}
                  {selectedEntry.closedAt && (
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">CLOSED</Label>
                      <div className="mt-1 font-mono text-sm" data-testid="text-detail-closed">{formatDate(selectedEntry.closedAt)}</div>
                    </div>
                  )}
                </div>

                {/* Entry Reasoning */}
                {selectedEntry.entryReasoning && (
                  <div className="border-solid border p-4">
                    <h3 className="text-lg font-bold uppercase tracking-normal mb-2 border-b border-solid pb-2">
                      ENTRY REASONING
                    </h3>
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-detail-reasoning">{selectedEntry.entryReasoning}</p>
                  </div>
                )}

                {/* Expectations */}
                {selectedEntry.expectations && (
                  <div className="border-solid border p-4">
                    <h3 className="text-lg font-bold uppercase tracking-normal mb-2 border-b border-solid pb-2">
                      EXPECTATIONS
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {selectedEntry.expectations.stopLoss && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">STOP LOSS</Label>
                          <div className="mt-1 font-mono font-bold" data-testid="text-detail-stop-loss">{formatPrice(selectedEntry.expectations.stopLoss)}</div>
                        </div>
                      )}
                      {selectedEntry.expectations.takeProfit && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">TAKE PROFIT</Label>
                          <div className="mt-1 font-mono font-bold" data-testid="text-detail-take-profit">{formatPrice(selectedEntry.expectations.takeProfit)}</div>
                        </div>
                      )}
                      {selectedEntry.expectations.riskRewardRatio && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">RISK:REWARD RATIO</Label>
                          <div className="mt-1 font-mono font-bold" data-testid="text-detail-rr-ratio">{selectedEntry.expectations.riskRewardRatio}</div>
                        </div>
                      )}
                      {selectedEntry.expectations.expectedDuration && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">EXPECTED DURATION</Label>
                          <div className="mt-1 font-mono font-bold" data-testid="text-detail-duration">{selectedEntry.expectations.expectedDuration}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Prices */}
                {selectedEntry.prices && (
                  <div className="border-solid border p-4">
                    <h3 className="text-lg font-bold uppercase tracking-normal mb-2 border-b border-solid pb-2">
                      PRICES
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {selectedEntry.prices.entry && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">ENTRY PRICE</Label>
                          <div className="mt-1 font-mono text-lg font-bold" data-testid="text-detail-entry-price">{formatPrice(selectedEntry.prices.entry)}</div>
                        </div>
                      )}
                      {selectedEntry.prices.exit && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">EXIT PRICE</Label>
                          <div className="mt-1 font-mono text-lg font-bold" data-testid="text-detail-exit-price">{formatPrice(selectedEntry.prices.exit)}</div>
                        </div>
                      )}
                      {selectedEntry.prices.stopLoss && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">STOP LOSS PRICE</Label>
                          <div className="mt-1 font-mono font-bold" data-testid="text-detail-sl-price">{formatPrice(selectedEntry.prices.stopLoss)}</div>
                        </div>
                      )}
                      {selectedEntry.prices.takeProfit && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">TAKE PROFIT PRICE</Label>
                          <div className="mt-1 font-mono font-bold" data-testid="text-detail-tp-price">{formatPrice(selectedEntry.prices.takeProfit)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Close Analysis */}
                {selectedEntry.closeAnalysis && (
                  <div className="border-solid border p-4 bg-muted/30">
                    <h3 className="text-lg font-bold uppercase tracking-normal mb-2 border-b border-solid pb-2">
                      CLOSE ANALYSIS
                    </h3>
                    <div className="space-y-4 mt-4">
                      {selectedEntry.closeAnalysis.profitAnalysis && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">PROFIT ANALYSIS</Label>
                          <p className="mt-1 text-sm whitespace-pre-wrap" data-testid="text-detail-profit-analysis">{selectedEntry.closeAnalysis.profitAnalysis}</p>
                        </div>
                      )}
                      {selectedEntry.closeAnalysis.targetHit !== null && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">TARGET HIT</Label>
                          <div className="mt-1 font-bold" data-testid="text-detail-target-hit">
                            {selectedEntry.closeAnalysis.targetHit ? "YES ✓" : "NO ✗"}
                          </div>
                        </div>
                      )}
                      {selectedEntry.closeAnalysis.adjustmentsMade && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">ADJUSTMENTS MADE</Label>
                          <p className="mt-1 text-sm whitespace-pre-wrap" data-testid="text-detail-adjustments">{selectedEntry.closeAnalysis.adjustmentsMade}</p>
                        </div>
                      )}
                      {selectedEntry.closeAnalysis.whatWentWrong && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">WHAT WENT WRONG</Label>
                          <p className="mt-1 text-sm whitespace-pre-wrap" data-testid="text-detail-went-wrong">{selectedEntry.closeAnalysis.whatWentWrong}</p>
                        </div>
                      )}
                      {selectedEntry.closeAnalysis.lessonsLearned && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">LESSONS LEARNED</Label>
                          <p className="mt-1 text-sm whitespace-pre-wrap" data-testid="text-detail-lessons">{selectedEntry.closeAnalysis.lessonsLearned}</p>
                        </div>
                      )}
                      {selectedEntry.closeAnalysis.anomalyDetected !== null && (
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">ANOMALY DETECTED</Label>
                          <div className="mt-1 font-bold" data-testid="text-detail-anomaly">
                            {selectedEntry.closeAnalysis.anomalyDetected ? "YES ⚠" : "NO"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="border-solid border p-4">
                  <h3 className="text-lg font-bold uppercase tracking-normal mb-4 border-b border-solid pb-2">
                    TRADE TIMELINE
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-foreground mt-1" />
                      <div>
                        <div className="font-bold uppercase text-xs tracking-wider">PLANNED</div>
                        <div className="text-xs text-muted-foreground font-mono" data-testid="text-timeline-created">
                          {formatDate(selectedEntry.createdAt)}
                        </div>
                      </div>
                    </div>
                    {selectedEntry.activatedAt && (
                      <>
                        <Separator orientation="vertical" className="h-4 ml-1.5 w-px bg-foreground" />
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-foreground mt-1" />
                          <div>
                            <div className="font-bold uppercase text-xs tracking-wider">ACTIVATED</div>
                            <div className="text-xs text-muted-foreground font-mono" data-testid="text-timeline-activated">
                              {formatDate(selectedEntry.activatedAt)}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {selectedEntry.closedAt && (
                      <>
                        <Separator orientation="vertical" className="h-4 ml-1.5 w-px bg-foreground" />
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-foreground mt-1" />
                          <div>
                            <div className="font-bold uppercase text-xs tracking-wider">CLOSED</div>
                            <div className="text-xs text-muted-foreground font-mono" data-testid="text-timeline-closed">
                              {formatDate(selectedEntry.closedAt)}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
