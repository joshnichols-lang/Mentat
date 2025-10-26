import { useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { PathFinder, Network } from '@routerprotocol/asset-transfer-sdk-ts';

// Router Nitro Partner ID - get from https://app.routernitro.com/partnerId
const PARTNER_ID = "0"; // Using default for now

interface BridgeQuoteParams {
  fromChainId: string;
  fromTokenAddress: string;
  toChainId: string;
  toTokenAddress: string;
  amount: string; // In smallest unit (wei)
  slippageTolerance?: string;
}

interface BridgeExecuteParams {
  quote: any;
  recipientAddress: string; // Embedded Hyperliquid address
}

export function useRouterBridge() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get bridge quote from Router Nitro
   */
  const getQuote = async (params: BridgeQuoteParams) => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }

    setIsGettingQuote(true);
    setError(null);

    try {
      const pathfinder = new PathFinder(Network.Mainnet, PARTNER_ID);

      const quoteResult = await pathfinder.getQuote({
        sourceChainId: params.fromChainId,
        sourceTokenAddress: params.fromTokenAddress,
        destinationChainId: params.toChainId,
        destinationTokenAddress: params.toTokenAddress,
        expandedInputAmount: params.amount,
        slippageTolerance: params.slippageTolerance ? parseFloat(params.slippageTolerance) : 1,
      });

      setQuote(quoteResult);
      return quoteResult;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to get bridge quote';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsGettingQuote(false);
    }
  };

  /**
   * Execute bridge transaction
   * Funds from connected wallet → recipientAddress (embedded Hyperliquid wallet)
   */
  const executeBridge = async (params: BridgeExecuteParams) => {
    if (!isConnected || !address || !walletClient) {
      throw new Error('Wallet not connected');
    }

    if (!params.quote) {
      throw new Error('No quote available. Please get a quote first.');
    }

    setIsExecuting(true);
    setError(null);

    try {
      const pathfinder = new PathFinder(Network.Mainnet, PARTNER_ID);

      // Create an EVM signer adapter for wagmi's wallet client
      // Router SDK expects an ethers-like signer interface
      const evmSigner = {
        getAddress: async () => address,
        signMessage: async (message: string) => {
          return await walletClient.signMessage({ 
            message 
          });
        },
        sendTransaction: async (transaction: any) => {
          return await walletClient.sendTransaction({
            to: transaction.to as `0x${string}`,
            data: transaction.data as `0x${string}`,
            value: transaction.value ? BigInt(transaction.value) : undefined,
            gas: transaction.gas ? BigInt(transaction.gas) : undefined,
          });
        },
        provider: publicClient ? {
          call: async (transaction: any) => {
            return await publicClient.call({
              to: transaction.to as `0x${string}`,
              data: transaction.data as `0x${string}`,
            });
          },
        } : undefined,
      };

      // Execute the bridge transaction
      // executeQuote handles token approval automatically
      const transaction = await pathfinder.executeQuote(
        {
          quote: params.quote,
          slippageTolerance: "1",
          senderAddress: address, // Connected wallet (source)
          receiverAddress: params.recipientAddress, // Embedded Hyperliquid wallet (destination)
        },
        {
          evmSigner: evmSigner as any,
        }
      );

      setTxHash(transaction);
      return transaction;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to execute bridge transaction';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * Reset state
   */
  const reset = () => {
    setQuote(null);
    setTxHash(null);
    setError(null);
    setIsGettingQuote(false);
    setIsExecuting(false);
  };

  return {
    // State
    isConnected,
    address,
    quote,
    txHash,
    error,
    isGettingQuote,
    isExecuting,
    isLoading: isGettingQuote || isExecuting,

    // Actions
    getQuote,
    executeBridge,
    reset,
  };
}
