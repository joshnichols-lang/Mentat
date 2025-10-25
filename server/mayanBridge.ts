import { fetchQuote, swapFromSolana, swapFromEvm, Quote } from '@mayanfinance/swap-sdk';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { ethers } from 'ethers';

// Solana RPC endpoint
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Arbitrum RPC endpoint
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';

// Token addresses
export const TOKENS = {
  solana: {
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
    sol: 'So11111111111111111111111111111111111111112' // Wrapped SOL
  },
  arbitrum: {
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
    eth: '0x0000000000000000000000000000000000000000' // Native ETH
  },
  hypercore: {
    usdc: 'USDC' // Hypercore uses symbol
  }
};

export interface BridgeQuoteParams {
  fromChain: 'solana' | 'arbitrum';
  toChain: 'hypercore';
  fromToken: 'usdc' | 'sol' | 'eth';
  toToken: 'usdc';
  amount: number; // Human-readable amount (e.g., 100 for 100 USDC)
  slippageBps?: number | 'auto'; // Default 300 (3%) or 'auto'
  destinationAddress: string;
  referrerAddress?: string; // Optional referrer for fees
}

export interface BridgeQuote {
  expectedAmountOut: number;
  minAmountOut: number;
  price: number;
  priceImpact: number;
  fee: number;
  gasEstimate: number;
  route: string;
  raw: Quote; // Raw quote from Mayan
}

export interface SwapParams {
  quote: Quote; // Mayan quote object
  fromChain: 'solana' | 'arbitrum';
  privateKey: string; // Decrypted private key from embedded wallet
  originAddress: string; // Origin wallet address
  destinationAddress: string; // Hyperliquid address
  referrerAddress?: string; // Optional referrer
}

export interface SwapResult {
  txHash: string;
  explorerUrl: string;
  status: 'pending' | 'processing';
}

/**
 * Fetch bridge quote from Mayan Finance
 */
export async function getBridgeQuote(params: BridgeQuoteParams): Promise<BridgeQuote> {
  try {
    const {
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      slippageBps = 300,
      destinationAddress,
      referrerAddress
    } = params;

    // Get token contract addresses
    let fromTokenAddress: string;
    if (fromChain === 'solana') {
      fromTokenAddress = fromToken === 'usdc' ? TOKENS.solana.usdc : TOKENS.solana.sol;
    } else {
      fromTokenAddress = fromToken === 'usdc' ? TOKENS.arbitrum.usdc : TOKENS.arbitrum.eth;
    }

    const toTokenAddress = TOKENS.hypercore.usdc;

    // Convert amount to smallest unit based on chain and token
    let amountIn64: string;
    if (fromChain === 'solana') {
      // Solana USDC has 6 decimals, SOL has 9 decimals
      const decimals = fromToken === 'usdc' ? 6 : 9;
      amountIn64 = (amount * Math.pow(10, decimals)).toString();
    } else {
      // Arbitrum USDC has 6 decimals, ETH has 18 decimals
      const decimals = fromToken === 'usdc' ? 6 : 18;
      amountIn64 = (amount * Math.pow(10, decimals)).toString();
    }

    console.log('[Mayan Bridge] Fetching quote:', {
      fromChain,
      toChain,
      fromToken: fromTokenAddress,
      toToken: toTokenAddress,
      amountIn64,
      slippageBps,
      referrer: referrerAddress
    });

    // Fetch quote from Mayan
    const quotes = await fetchQuote({
      amountIn64,
      fromToken: fromTokenAddress,
      toToken: toTokenAddress,
      fromChain,
      toChain,
      slippageBps,
      gasDrop: 0, // No gas drop for Hypercore
      referrer: referrerAddress
    });

    if (!quotes || quotes.length === 0) {
      throw new Error('No quotes available for this route');
    }

    // Take the best quote (first one)
    const bestQuote = quotes[0];

    console.log('[Mayan Bridge] Received quote:', {
      expectedAmountOut: bestQuote.expectedAmountOut,
      minAmountOut: bestQuote.minAmountOut,
      slippageBps: bestQuote.slippageBps
    });

    // Convert amounts back to human-readable
    const toDecimals = 6; // USDC on Hypercore has 6 decimals
    const expectedOut = Number(bestQuote.expectedAmountOut) / Math.pow(10, toDecimals);
    const minOut = Number(bestQuote.minAmountOut) / Math.pow(10, toDecimals);

    // Calculate price
    const price = amount / expectedOut;
    
    // Estimate price impact (simplified)
    const priceImpact = Math.abs(1 - price) * 100;

    return {
      expectedAmountOut: expectedOut,
      minAmountOut: minOut,
      price,
      priceImpact,
      fee: bestQuote.redeemRelayerFee ? Number(bestQuote.redeemRelayerFee) / Math.pow(10, toDecimals) : 0,
      gasEstimate: 0, // Not provided by Mayan
      route: `${fromChain} → ${toChain}`,
      raw: bestQuote
    };

  } catch (error) {
    console.error('[Mayan Bridge] Error fetching quote:', error);
    throw new Error(`Failed to fetch bridge quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute swap from Solana to Hypercore
 */
async function swapFromSolanaChain(
  quote: Quote,
  privateKey: string,
  originAddress: string,
  destinationAddress: string,
  referrerAddress?: string
): Promise<SwapResult> {
  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    
    // Parse private key (assuming it's base58 encoded)
    const secretKey = Buffer.from(privateKey, 'base64');
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

    console.log('[Mayan Bridge] Executing Solana swap from:', keypair.publicKey.toString());

    // Referrer addresses (optional)
    const referrerAddresses = referrerAddress ? {
      solana: referrerAddress,
      evm: undefined,
      sui: undefined
    } : undefined;

    // Sign transaction function with proper type overloading
    const signSolanaTransaction: any = async (tx: any) => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
        return tx;
      } else {
        tx.partialSign(keypair);
        return tx;
      }
    };

    // Execute swap
    const result = await swapFromSolana(
      quote,
      originAddress,
      destinationAddress,
      referrerAddresses,
      signSolanaTransaction,
      connection,
      undefined, // extraRpcs
      undefined, // sendOptions
      undefined, // jitoOptions
      undefined  // instructionOptions
    );

    const txHash = result.signature;

    console.log('[Mayan Bridge] Solana swap transaction hash:', txHash);

    return {
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
      status: 'pending'
    };

  } catch (error) {
    console.error('[Mayan Bridge] Error executing Solana swap:', error);
    throw new Error(`Failed to execute Solana swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute swap from Arbitrum to Hypercore
 */
async function swapFromArbitrumChain(
  quote: Quote,
  privateKey: string,
  destinationAddress: string,
  referrerAddress?: string
): Promise<SwapResult> {
  try {
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
    const signer = new ethers.Wallet(privateKey, provider);

    console.log('[Mayan Bridge] Executing Arbitrum swap from:', signer.address);

    // Referrer addresses (optional)
    const referrerAddresses = referrerAddress ? {
      solana: undefined,
      evm: referrerAddress,
      sui: undefined
    } : undefined;

    // Execute swap
    const result = await swapFromEvm(
      quote,
      signer.address,
      destinationAddress,
      referrerAddresses,
      signer,
      undefined, // permit
      undefined, // overrides
      undefined, // payload
      undefined  // options
    );

    const txHash = typeof result === 'string' ? result : result.hash;

    console.log('[Mayan Bridge] Arbitrum swap transaction hash:', txHash);

    return {
      txHash,
      explorerUrl: `https://arbiscan.io/tx/${txHash}`,
      status: 'pending'
    };

  } catch (error) {
    console.error('[Mayan Bridge] Error executing Arbitrum swap:', error);
    throw new Error(`Failed to execute Arbitrum swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute bridge swap (main entry point)
 */
export async function executeBridgeSwap(params: SwapParams): Promise<SwapResult> {
  const { quote, fromChain, privateKey, originAddress, destinationAddress, referrerAddress } = params;

  if (fromChain === 'solana') {
    return swapFromSolanaChain(quote, privateKey, originAddress, destinationAddress, referrerAddress);
  } else if (fromChain === 'arbitrum') {
    return swapFromArbitrumChain(quote, privateKey, destinationAddress, referrerAddress);
  } else {
    throw new Error(`Unsupported source chain: ${fromChain}`);
  }
}

/**
 * Track swap status using Mayan Explorer API
 */
export async function trackSwapStatus(txHash: string): Promise<any> {
  try {
    const response = await fetch(`https://explorer-api.mayan.finance/v3/swap/trx/${txHash}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch swap status: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('[Mayan Bridge] Swap status:', {
      txHash,
      status: data.status,
      fromAmount: data.fromAmount,
      toAmount: data.toAmount
    });

    return data;

  } catch (error) {
    console.error('[Mayan Bridge] Error tracking swap:', error);
    throw new Error(`Failed to track swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
