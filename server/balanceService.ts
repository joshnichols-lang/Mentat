import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import type { IStorage } from './storage';

// Solana RPC endpoint (Helius or public)
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Arbitrum RPC endpoint
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';

// USDC token addresses
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC
const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Arbitrum USDC

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export interface WalletBalances {
  solana: {
    sol: number;
    usdc: number;
    totalUsd: number;
  };
  arbitrum: {
    eth: number;
    usdc: number;
    totalUsd: number;
  };
  hyperliquid: {
    accountValue: number;
    withdrawable: number;
  };
  totalUsd: number;
}

export class BalanceService {
  private solanaConnection: Connection;
  private arbitrumProvider: ethers.JsonRpcProvider;
  
  constructor() {
    this.solanaConnection = new Connection(SOLANA_RPC_URL, 'confirmed');
    this.arbitrumProvider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
  }
  
  async getSolanaBalances(publicKey: string): Promise<{ sol: number; usdc: number; totalUsd: number }> {
    try {
      const pubKey = new PublicKey(publicKey);
      
      // Get SOL balance
      const solBalance = await this.solanaConnection.getBalance(pubKey);
      const sol = solBalance / LAMPORTS_PER_SOL;
      
      // Get USDC balance (simplified - would need to parse token accounts properly)
      // For now, we'll return 0 for USDC and implement proper SPL token parsing later
      const usdc = 0;
      
      // Approximate USD value (would need price oracle in production)
      // For now, assume SOL = $150 (placeholder)
      const solPrice = 150;
      const totalUsd = (sol * solPrice) + usdc;
      
      return { sol, usdc, totalUsd };
    } catch (error) {
      console.error('[Balance Service] Solana balance error:', error);
      return { sol: 0, usdc: 0, totalUsd: 0 };
    }
  }
  
  async getArbitrumBalances(address: string): Promise<{ eth: number; usdc: number; totalUsd: number }> {
    try {
      // Get ETH balance
      const ethBalance = await this.arbitrumProvider.getBalance(address);
      const eth = parseFloat(ethers.formatEther(ethBalance));
      
      // Get USDC balance
      const usdcContract = new ethers.Contract(ARBITRUM_USDC_ADDRESS, ERC20_ABI, this.arbitrumProvider);
      const usdcBalance = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();
      const usdc = parseFloat(ethers.formatUnits(usdcBalance, decimals));
      
      // Approximate USD value (would need price oracle in production)
      // For now, assume ETH = $3500 (placeholder)
      const ethPrice = 3500;
      const totalUsd = (eth * ethPrice) + usdc;
      
      return { eth, usdc, totalUsd };
    } catch (error) {
      console.error('[Balance Service] Arbitrum balance error:', error);
      return { eth: 0, usdc: 0, totalUsd: 0 };
    }
  }
  
  async getHyperliquidBalance(userId: string, storage: IStorage): Promise<{ accountValue: number; withdrawable: number }> {
    try {
      // Import getUserHyperliquidClient dynamically to avoid circular dependency
      const { getUserHyperliquidClient } = await import('./hyperliquid/client');
      
      const hyperliquid = await getUserHyperliquidClient(userId);
      const state = await hyperliquid.getUserState();
      
      const accountValue = parseFloat(state.marginSummary?.accountValue || '0');
      const withdrawable = parseFloat(state.withdrawable || '0');
      
      return { accountValue, withdrawable };
    } catch (error: any) {
      console.error('[Balance Service] Hyperliquid balance error:', error);
      // Return zeros if no credentials configured
      if (error.message?.includes('No Hyperliquid credentials')) {
        return { accountValue: 0, withdrawable: 0 };
      }
      throw error;
    }
  }
  
  async getAllBalances(userId: string, storage: IStorage): Promise<WalletBalances> {
    // Get embedded wallet addresses
    const embeddedWallet = await storage.getEmbeddedWallet(userId);
    
    if (!embeddedWallet) {
      throw new Error('No embedded wallet found for user');
    }
    
    // Fetch all balances in parallel
    const [solana, arbitrum, hyperliquid] = await Promise.allSettled([
      this.getSolanaBalances(embeddedWallet.solanaAddress),
      this.getArbitrumBalances(embeddedWallet.evmAddress),
      this.getHyperliquidBalance(userId, storage),
    ]);
    
    const solanaBalances = solana.status === 'fulfilled' ? solana.value : { sol: 0, usdc: 0, totalUsd: 0 };
    const arbitrumBalances = arbitrum.status === 'fulfilled' ? arbitrum.value : { eth: 0, usdc: 0, totalUsd: 0 };
    const hyperliquidBalances = hyperliquid.status === 'fulfilled' ? hyperliquid.value : { accountValue: 0, withdrawable: 0 };
    
    const totalUsd = solanaBalances.totalUsd + arbitrumBalances.totalUsd + hyperliquidBalances.accountValue;
    
    return {
      solana: solanaBalances,
      arbitrum: arbitrumBalances,
      hyperliquid: hyperliquidBalances,
      totalUsd,
    };
  }
}

// Singleton instance
export const balanceService = new BalanceService();
