import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, History, ExternalLink } from "lucide-react";
import { useState } from "react";
import SendModal from "@/components/SendModal";
import WithdrawalHistory from "@/components/WithdrawalHistory";

const CHAIN_NAMES = {
  polygon: "Polymarket",
  hyperliquid: "Hyperliquid"
};

const CHAIN_TOKENS: Record<string, { symbol: string; name: string }[]> = {
  polygon: [
    { symbol: "MATIC", name: "Polygon" },
    { symbol: "USDC", name: "USD Coin" },
  ],
  hyperliquid: [
    { symbol: "USDC", name: "USD Coin" },
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

interface BalancesResponse {
  balances: Record<string, ChainBalance>;
}

interface WalletResponse {
  wallet: {
    hyperliquidAddress: string;
    solanaAddress: string;
    evmAddress: string;
    polygonAddress: string;
    bnbAddress: string;
  };
}

export default function Wallet() {
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  const { data: balancesData, isLoading: balancesLoading, error: balancesError } = useQuery<BalancesResponse>({
    queryKey: ['/api/wallets/balances'],
  });

  const { data: walletData } = useQuery<WalletResponse>({
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

  const getChainTokens = (chain: string, chainData?: ChainBalance) => {
    const defaultTokens = CHAIN_TOKENS[chain] || [];
    const existingBalances = chainData?.balances || [];
    
    const tokenMap = new Map(existingBalances.map(b => [b.token, b]));
    const allTokens = new Set([...defaultTokens.map(t => t.symbol), ...existingBalances.map(b => b.token)]);
    
    return Array.from(allTokens).map(tokenSymbol => {
      const existing = tokenMap.get(tokenSymbol);
      return existing || {
        token: tokenSymbol,
        balance: "0",
        usdValue: 0
      };
    });
  };

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
          {Object.entries(balances)
            .filter(([chain]) => chain === 'polygon' || chain === 'hyperliquid')
            .map(([chain, data]) => {
            const tokens = getChainTokens(chain, data);
            return (
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
                    {tokens.map((balance) => (
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
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
