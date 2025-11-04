import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  pending: "bg-yellow-500",
  confirmed: "bg-green-500",
  failed: "bg-red-500",
};

interface WithdrawalsResponse {
  withdrawals: any[];
}

export default function WithdrawalHistory() {
  const { data, isLoading } = useQuery<WithdrawalsResponse>({
    queryKey: ['/api/withdrawals'],
  });

  const withdrawals = data?.withdrawals || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent withdrawal transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            No withdrawal transactions yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent withdrawal transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {withdrawals.map((withdrawal: any) => (
            <div
              key={withdrawal.id}
              className="flex items-center justify-between p-4 bg-muted rounded-lg"
              data-testid={`withdrawal-${withdrawal.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{withdrawal.chain.toUpperCase()}</Badge>
                  <Badge variant="outline">{withdrawal.token}</Badge>
                  <Badge 
                    className={STATUS_COLORS[withdrawal.status as keyof typeof STATUS_COLORS]}
                    data-testid={`status-${withdrawal.status}`}
                  >
                    {withdrawal.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Amount: {parseFloat(withdrawal.amount).toFixed(6)} {withdrawal.token}</div>
                  <div className="font-mono text-xs truncate">To: {withdrawal.recipient}</div>
                  {withdrawal.createdAt && (
                    <div>{format(new Date(withdrawal.createdAt), "MMM dd, yyyy HH:mm")}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {withdrawal.explorerUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(withdrawal.explorerUrl, '_blank')}
                    data-testid="button-explorer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
