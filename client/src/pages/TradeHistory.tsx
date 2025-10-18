import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, TrendingUp, AlertCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/Header";

interface TradeHistoryImport {
  id: string;
  sourceType: string;
  fileName: string | null;
  status: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  analysisStatus: string;
  createdAt: string;
  completedAt: string | null;
}

interface StyleProfile {
  id: string;
  avgPositionSize: string | null;
  avgLeverage: string | null;
  avgHoldingPeriodMinutes: number | null;
  preferredAssets: any;
  riskTolerance: string | null;
  winRate: string | null;
  avgRiskRewardRatio: string | null;
  strengthsAnalysis: string | null;
  weaknessesAnalysis: string | null;
  sampleSize: number;
  confidenceScore: string | null;
  createdAt: string;
}

export default function TradeHistory() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: importsData, isLoading: isLoadingImports } = useQuery<{ success: boolean; imports: TradeHistoryImport[] }>({
    queryKey: ["/api/trade-history/imports"]
  });

  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery<{ success: boolean; profiles: StyleProfile[] }>({
    queryKey: ["/api/trade-history/style-profiles"]
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/trade-history/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade-history/imports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade-history/style-profiles"] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Upload completed with errors",
          description: `${data.successfulRows} of ${data.totalRows} trades imported. Check import details for errors.`,
          variant: "default"
        });
      } else {
        toast({
          title: "Upload successful",
          description: `${data.successfulRows} trades imported and analysis started.`
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (importId: string) => {
      return await apiRequest("DELETE", `/api/trade-history/imports/${importId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade-history/imports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade-history/style-profiles"] });
      toast({
        title: "Import deleted",
        description: "Trade history import has been removed."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file.",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      processing: "secondary",
      completed: "default",
      failed: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getAnalysisStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      pending: "outline",
      analyzing: "secondary",
      completed: "default",
      failed: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const activeProfile = profilesData?.profiles?.[0];

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trade History</h1>
          <p className="text-muted-foreground">Upload and analyze your past trading performance</p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-history">
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Trade History</DialogTitle>
              <DialogDescription>
                Import your past trades from a CSV file. Required columns: symbol, side, entrydate, entryprice, exitdate, exitprice, size, pnl
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  data-testid="input-csv-file"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your trade data will be analyzed by AI to extract your trading style patterns and improve autonomous trading recommendations.
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full"
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload and Analyze"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingProfiles ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading your trading style profile...</CardTitle>
          </CardHeader>
        </Card>
      ) : activeProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Your Trading Style Profile
            </CardTitle>
            <CardDescription>
              AI-analyzed insights from {activeProfile.sampleSize} trades
              {activeProfile.confidenceScore && ` (Confidence: ${(parseFloat(activeProfile.confidenceScore) * 100).toFixed(0)}%)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {activeProfile.winRate && (
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold" data-testid="metric-win-rate">{(parseFloat(activeProfile.winRate) * 100).toFixed(1)}%</p>
                </div>
              )}
              {activeProfile.avgRiskRewardRatio && (
                <div>
                  <p className="text-sm text-muted-foreground">Avg R:R Ratio</p>
                  <p className="text-2xl font-bold" data-testid="metric-risk-reward">{parseFloat(activeProfile.avgRiskRewardRatio).toFixed(2)}</p>
                </div>
              )}
              {activeProfile.avgLeverage && (
                <div>
                  <p className="text-sm text-muted-foreground">Avg Leverage</p>
                  <p className="text-2xl font-bold" data-testid="metric-leverage">{parseFloat(activeProfile.avgLeverage).toFixed(1)}x</p>
                </div>
              )}
              {activeProfile.riskTolerance && (
                <div>
                  <p className="text-sm text-muted-foreground">Risk Profile</p>
                  <Badge variant="outline" className="text-base capitalize" data-testid="metric-risk-profile">{activeProfile.riskTolerance}</Badge>
                </div>
              )}
            </div>

            {activeProfile.strengthsAnalysis && (
              <div>
                <h4 className="font-semibold mb-2">Strengths</h4>
                <p className="text-sm whitespace-pre-line" data-testid="text-strengths">{activeProfile.strengthsAnalysis}</p>
              </div>
            )}

            {activeProfile.weaknessesAnalysis && (
              <div>
                <h4 className="font-semibold mb-2">Areas for Improvement</h4>
                <p className="text-sm whitespace-pre-line" data-testid="text-weaknesses">{activeProfile.weaknessesAnalysis}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import History
          </CardTitle>
          <CardDescription>Your uploaded trade history files</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingImports ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Loading imports...</p>
            </div>
          ) : !importsData?.imports || importsData.imports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No trade history uploaded yet</p>
              <p className="text-sm">Upload a CSV file to get AI-powered insights</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Analysis</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importsData.imports.map((imp) => (
                  <TableRow key={imp.id} data-testid={`row-import-${imp.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-filename-${imp.id}`}>{imp.fileName || "Manual Entry"}</TableCell>
                    <TableCell data-testid={`cell-trades-${imp.id}`}>
                      {imp.successfulRows} / {imp.totalRows}
                      {imp.failedRows > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">({imp.failedRows} failed)</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${imp.id}`}>{getStatusBadge(imp.status)}</TableCell>
                    <TableCell data-testid={`cell-analysis-${imp.id}`}>{getAnalysisStatusBadge(imp.analysisStatus)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`cell-date-${imp.id}`}>
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(imp.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${imp.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
