import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, History, ExternalLink } from "lucide-react";
import { useState } from "react";
import SendModal from "@/components/SendModal";
import WithdrawalHistory from "@/components/WithdrawalHistory";

const CHAIN_NAMES = {
  solana: "Solana",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  ethereum: "Ethereum",
  bnb: "BNB Chain",
  hyperliquid: "Hyperliquid"
};

const CHAIN_TOKENS: Record<string, { symbol: string; name: string }[]> = {
  solana: [
    { symbol: "SOL", name: "Solana" },
    { symbol: "USDC", name: "USD Coin" },
  ],
  arbitrum: [
    { symbol: "ETH", name: "Ethereum" },
    { symbol: "USDC", name: "USD Coin" },
  ],
  polygon: [
    { symbol: "MATIC", name: "Polygon" },
    { symbol: "USDC", name: "USD Coin" },
  ],
  ethereum: [
    { symbol: "ETH", name: "Ethereum" },
  ],
  bnb: [
    { symbol: "BNB", name: "BNB" },
  ],
  hyperliquid: [
    { symbol: "ETH", name: "Ethereum" },
  ],
};

interface ChainBalance {
  address: string;
  balances: Array<{
    token: string;
    balance: string;
    usdValue: number;
  }>;
}

export default function Wallet() {
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  const { data: balancesData, isLoading: balancesLoading, error: balancesError } = useQuery({
    queryKey: ['/api/wallets/balances'],
  });

  const { data: walletData } = useQuery({
    queryKey: ['/api/wallets/embedded'],
  });

  const handleSend = (chain: string, token: string) => {
    setSelectedChain(chain);
    setSelectedToken(token);
    setShowSendModal(true);
  };

  if (balancesLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (balancesError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load wallet balances. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const balances: Record<string, ChainBalance> = balancesData?.balances || {};
  const wallet = walletData?.wallet;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Multi-Chain Wallet</h1>
          <p className="text-muted-foreground">Manage your crypto assets across multiple chains</p>
        </div>
        <Button onClick={() => setShowHistory(!showHistory)} variant="outline" data-testid="button-history">
          <History className="w-4 h-4 mr-2" />
          {showHistory ? "Hide History" : "Transaction History"}
        </Button>
      </div>

      {showHistory ? (
        <WithdrawalHistory />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(balances).map(([chain, data]) => (
            <Card key={chain} data-testid={`card-chain-${chain}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{CHAIN_NAMES[chain as keyof typeof CHAIN_NAMES] || chain}</span>
                </CardTitle>
                <CardDescription className="font-mono text-xs truncate">
                  {data.address}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.balances && data.balances.length > 0 ? (
                    data.balances.map((balance) => (
                      <div key={balance.token} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-semibold">{balance.token}</div>
                          <div className="text-sm text-muted-foreground">
                            {parseFloat(balance.balance).toFixed(6)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              ${balance.usdValue?.toFixed(2) || "0.00"}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSend(chain, balance.token)}
                            disabled={parseFloat(balance.balance) === 0}
                            data-testid={`button-send-${chain}-${balance.token}`}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No balances available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {wallet && (
            <Card>
              <CardHeader>
                <CardTitle>Wallet Addresses</CardTitle>
                <CardDescription>Your embedded wallet addresses across all chains</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {wallet.solanaAddress && (
                    <div>
                      <div className="text-xs text-muted-foreground">Solana</div>
                      <div className="font-mono text-sm truncate">{wallet.solanaAddress}</div>
                    </div>
                  )}
                  {wallet.evmAddress && (
                    <div>
                      <div className="text-xs text-muted-foreground">EVM (Ethereum, Arbitrum, BNB)</div>
                      <div className="font-mono text-sm truncate">{wallet.evmAddress}</div>
                    </div>
                  )}
                  {wallet.polygonAddress && (
                    <div>
                      <div className="text-xs text-muted-foreground">Polygon</div>
                      <div className="font-mono text-sm truncate">{wallet.polygonAddress}</div>
                    </div>
                  )}
                  {wallet.hyperliquidAddress && (
                    <div>
                      <div className="text-xs text-muted-foreground">Hyperliquid</div>
                      <div className="font-mono text-sm truncate">{wallet.hyperliquidAddress}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showSendModal && (
        <SendModal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          chain={selectedChain}
          token={selectedToken}
          availableBalance={
            balances[selectedChain]?.balances?.find((b) => b.token === selectedToken)?.balance || "0"
          }
        />
      )}
    </div>
  );
}
