import { db } from './db';
import { users, x402Transactions, userWallets, type InsertX402Transaction } from '../shared/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { 
  createPublicClient, 
  createWalletClient,
  http, 
  type Address, 
  type Hash,
  formatUnits, 
  parseUnits
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

// x402 Configuration
// USDC contract addresses on Arbitrum
export const USDC_CONTRACTS = {
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const, // USDC on Arbitrum One
  'arbitrum-sepolia': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as const, // USDC on Arbitrum Sepolia
} as const;

// Validate platform wallet configuration at startup
// Returns null if not configured (x402 will be disabled)
function validatePlatformWallet(): Address | null {
  const wallet = process.env.X402_PLATFORM_WALLET;
  
  if (!wallet) {
    console.warn('[x402] X402_PLATFORM_WALLET not configured. x402 micropayments disabled. Set this environment variable to enable fallback payments.');
    return null;
  }
  
  // Check if it's the zero address
  if (wallet.toLowerCase() === '0x0000000000000000000000000000000000000000' || wallet === '0x0') {
    throw new Error('CRITICAL: X402_PLATFORM_WALLET is set to zero address. This would burn user funds. Configure a valid wallet address or remove the variable.');
  }
  
  // Basic validation that it looks like an Ethereum address
  if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error(`CRITICAL: X402_PLATFORM_WALLET is invalid. Expected 0x-prefixed 40-character hex address, got: ${wallet}`);
  }
  
  console.log(`[x402] Platform wallet configured: ${wallet}`);
  return wallet as Address;
}

const platformWallet = validatePlatformWallet();

export const X402_CONFIG = {
  // Dynamic pricing: charge 2x actual AI cost (100% markup)
  markupMultiplier: 2.0, // 100% markup on actual AI cost
  
  // Estimated typical AI call cost (for pre-payment estimates)
  estimatedAiCost: 0.01, // ~$0.01 for Grok 4 Fast typical call
  
  // Platform wallet for receiving payments (Arbitrum network)
  // null if not configured (x402 disabled)
  platformWallet: platformWallet,
  
  // Whether x402 is enabled (requires platform wallet)
  enabled: platformWallet !== null,
  
  // Supported networks (switched from Base to Arbitrum)
  networks: ['arbitrum', 'arbitrum-sepolia'] as const,
  
  // USDC contract addresses
  usdcContracts: USDC_CONTRACTS,
  
  // Minimum payment amounts
  minPayment: 0.001, // $0.001 minimum payment (very low for AI calls)
  
  // ERC-20 ABI fragments for USDC interaction
  usdcAbi: [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: 'balance', type: 'uint256' }],
    },
    {
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
      outputs: [{ name: 'remaining', type: 'uint256' }],
    },
    {
      name: 'transferFrom',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
      ],
      outputs: [{ name: 'success', type: 'bool' }],
    },
    {
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
      ],
      outputs: [{ name: 'success', type: 'bool' }],
    },
  ] as const,
} as const;

export type X402Network = typeof X402_CONFIG.networks[number];

// Viem public clients for reading blockchain data
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http()
});

const arbitrumSepoliaClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http()
});

function getClient(network: X402Network) {
  return network === 'arbitrum' ? arbitrumClient : arbitrumSepoliaClient;
}

// Create wallet client for executing transactions (requires private key)
function getWalletClient(network: X402Network) {
  const privateKey = process.env.X402_PLATFORM_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('X402_PLATFORM_PRIVATE_KEY not set in environment');
  }
  
  // Ensure private key starts with 0x
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  const chain = network === 'arbitrum' ? arbitrum : arbitrumSepolia;
  
  return createWalletClient({
    account,
    chain,
    transport: http()
  });
}

/**
 * Calculate x402 charge based on actual AI cost
 * Applies 100% markup (2x actual cost)
 */
export function calculateX402Price(actualAiCost: number): number {
  return actualAiCost * X402_CONFIG.markupMultiplier;
}

/**
 * Get user's x402 balance
 */
export async function getUserX402Balance(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { x402Balance: true }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return parseFloat(user.x402Balance || '0');
}

/**
 * Get user's Arbitrum wallet address
 */
export async function getUserArbitrumWallet(userId: string): Promise<{
  address: Address;
  network: X402Network;
} | null> {
  // First try to get user's connected Arbitrum wallet from userWallets table
  const wallet = await db.query.userWallets.findFirst({
    where: and(
      eq(userWallets.userId, userId),
      eq(userWallets.chain, 'arbitrum')
    ),
    columns: {
      normalizedAddress: true,
      chainId: true
    }
  });

  if (wallet) {
    const network: X402Network = wallet.chainId === '42161' ? 'arbitrum' : 'arbitrum-sepolia';
    return {
      address: wallet.normalizedAddress as Address,
      network
    };
  }

  return null;
}

/**
 * Check user's Arbitrum USDC balance on-chain
 */
export async function checkArbitrumUsdcBalance(params: {
  walletAddress: Address;
  network: X402Network;
}): Promise<number> {
  const { walletAddress, network } = params;
  const client = getClient(network);
  const usdcContract = X402_CONFIG.usdcContracts[network];

  try {
    const balance = await client.readContract({
      address: usdcContract as Address,
      abi: X402_CONFIG.usdcAbi,
      functionName: 'balanceOf',
      args: [walletAddress],
    }) as bigint;

    // USDC has 6 decimals
    return parseFloat(formatUnits(balance, 6));
  } catch (error) {
    console.error(`[x402] Error checking USDC balance for ${walletAddress} on ${network}:`, error);
    return 0;
  }
}

/**
 * Check how much USDC the platform is approved to spend from user's wallet
 */
export async function checkUsdcAllowance(params: {
  walletAddress: Address;
  network: X402Network;
}): Promise<number> {
  const { walletAddress, network } = params;
  const client = getClient(network);
  const usdcContract = X402_CONFIG.usdcContracts[network];

  try {
    const allowance = await client.readContract({
      address: usdcContract as Address,
      abi: X402_CONFIG.usdcAbi,
      functionName: 'allowance',
      args: [walletAddress, X402_CONFIG.platformWallet as Address],
    }) as bigint;

    // USDC has 6 decimals
    return parseFloat(formatUnits(allowance, 6));
  } catch (error) {
    console.error(`[x402] Error checking USDC allowance for ${walletAddress} on ${network}:`, error);
    return 0;
  }
}

/**
 * Check if user can pay for AI call using their Arbitrum USDC
 * Checks both wallet balance and approval status
 */
export async function canPayForAICall(userId: string, estimatedAiCost?: number): Promise<{
  canPay: boolean;
  balance: number;
  required: number;
  shortfall: number;
  hasApproval: boolean;
  walletAddress?: string;
  network?: X402Network;
}> {
  const aiCost = estimatedAiCost || X402_CONFIG.estimatedAiCost;
  const required = calculateX402Price(aiCost);

  // Get user's Arbitrum wallet
  const wallet = await getUserArbitrumWallet(userId);
  
  if (!wallet) {
    return {
      canPay: false,
      balance: 0,
      required,
      shortfall: required,
      hasApproval: false,
    };
  }

  // Check on-chain USDC balance
  const balance = await checkArbitrumUsdcBalance({
    walletAddress: wallet.address,
    network: wallet.network
  });

  // Check if platform has approval to spend USDC
  const allowance = await checkUsdcAllowance({
    walletAddress: wallet.address,
    network: wallet.network
  });

  const hasApproval = allowance >= required;
  const shortfall = Math.max(0, required - balance);
  const canPay = balance >= required && hasApproval;

  return {
    canPay,
    balance,
    required,
    shortfall,
    hasApproval,
    walletAddress: wallet.address,
    network: wallet.network
  };
}

/**
 * Execute USDC transfer from user's Arbitrum wallet to platform wallet
 * Uses ERC-20 transferFrom (requires prior approval from user)
 * Waits for transaction confirmation before returning
 */
export async function executeUsdcTransfer(params: {
  userId: string;
  fromAddress: Address;
  amount: number;
  network: X402Network;
}): Promise<{
  success: boolean;
  transactionHash: Hash;
  actualAmount: number;
}> {
  const { userId, fromAddress, amount, network } = params;
  
  console.log(`[x402] Executing USDC transfer: ${amount} from ${fromAddress} on ${network}`);
  
  // Convert amount to USDC units (6 decimals)
  const amountInUnits = parseUnits(amount.toString(), 6);
  const usdcContract = X402_CONFIG.usdcContracts[network];
  const platformWallet = X402_CONFIG.platformWallet as Address;
  
  try {
    // Get wallet client (uses platform wallet's private key)
    const walletClient = getWalletClient(network);
    const publicClient = getClient(network);
    
    // Execute transferFrom transaction
    // This pulls USDC from user's wallet (they must have approved platform wallet)
    const hash = await walletClient.writeContract({
      address: usdcContract as Address,
      abi: X402_CONFIG.usdcAbi,
      functionName: 'transferFrom',
      args: [fromAddress, platformWallet, amountInUnits],
      account: walletClient.account,
    });
    
    console.log(`[x402] Transfer transaction submitted: ${hash}`);
    
    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1, // Wait for 1 confirmation on Arbitrum (fast L2)
    });
    
    if (receipt.status === 'success') {
      console.log(`[x402] Transfer confirmed: ${hash}, gas used: ${receipt.gasUsed}`);
      return {
        success: true,
        transactionHash: hash,
        actualAmount: amount
      };
    } else {
      console.error(`[x402] Transfer failed: ${hash}`);
      throw new Error('Transaction reverted');
    }
  } catch (error: any) {
    console.error(`[x402] Transfer error:`, error);
    
    // Provide more specific error messages
    if (error.message?.includes('insufficient allowance')) {
      throw new Error('Insufficient USDC approval. Please approve the platform to spend your USDC.');
    } else if (error.message?.includes('insufficient balance')) {
      throw new Error('Insufficient USDC balance in your Arbitrum wallet.');
    } else {
      throw new Error(`Transfer failed: ${error.message || 'Unknown error'}`);
    }
  }
}

/**
 * Record a deposit transaction
 * Called when user sends USDC to the platform wallet
 */
export async function recordDeposit(params: {
  userId: string;
  amount: number;
  network: X402Network;
  transactionHash: string;
  fromAddress: string;
}): Promise<string> {
  const { userId, amount, network, transactionHash, fromAddress } = params;
  
  // Check if x402 is enabled
  if (!X402_CONFIG.enabled || !X402_CONFIG.platformWallet) {
    throw new Error('x402 micropayments not configured. Deposits cannot be processed.');
  }
  
  // No minimum deposit check - allow any amount
  // Get current balance
  const currentBalance = await getUserX402Balance(userId);
  const newBalance = currentBalance + amount;
  
  // Start transaction to update balance and record transaction
  const result = await db.transaction(async (tx) => {
    // Update user balance
    await tx.update(users)
      .set({
        x402Balance: newBalance.toString(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    // Record transaction
    const [transaction] = await tx.insert(x402Transactions)
      .values({
        userId,
        type: 'deposit',
        amount: amount.toString(),
        status: 'completed',
        network,
        transactionHash,
        fromAddress,
        toAddress: X402_CONFIG.platformWallet,
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        description: `Deposit ${amount.toFixed(2)} USDC from ${fromAddress.slice(0, 10)}...`,
        completedAt: new Date()
      })
      .returning({ id: x402Transactions.id });
    
    return transaction.id;
  });
  
  console.log(`[x402] Recorded deposit: ${amount} USDC for user ${userId}, new balance: ${newBalance}`);
  
  return result;
}

/**
 * Process AI call payment using Arbitrum USDC transfer
 * Executes transferFrom to pull USDC from user's wallet
 * Waits for blockchain confirmation before returning (2-5 seconds on Arbitrum)
 */
export async function processAICallPayment(params: {
  userId: string;
  actualAiCost: number;
  strategyId?: string;
  provider: string;
  model: string;
}): Promise<{
  success: boolean;
  transactionId: string;
  balanceAfter: number;
  costBreakdown: {
    aiCost: number;
    markup: number;
    totalCharge: number;
  };
}> {
  const { userId, actualAiCost, strategyId, provider, model } = params;
  const totalCharge = calculateX402Price(actualAiCost);
  const markup = totalCharge - actualAiCost;
  
  console.log(`[x402] Processing AI call payment: user ${userId}, AI cost $${actualAiCost.toFixed(4)}, total charge $${totalCharge.toFixed(4)}`);
  
  // Check if x402 is enabled
  if (!X402_CONFIG.enabled || !X402_CONFIG.platformWallet) {
    throw new Error('x402 micropayments not configured. Cannot process payment.');
  }
  
  // Get user's Arbitrum wallet
  const wallet = await getUserArbitrumWallet(userId);
  if (!wallet) {
    throw new Error('No Arbitrum wallet found for user. Please connect your wallet.');
  }
  
  // Get current on-chain balance before transfer
  const balanceBefore = await checkArbitrumUsdcBalance({
    walletAddress: wallet.address,
    network: wallet.network
  });
  
  // Execute USDC transfer from user's wallet to platform wallet
  // This will wait for blockchain confirmation (2-5 seconds on Arbitrum L2)
  const transferResult = await executeUsdcTransfer({
    userId,
    fromAddress: wallet.address,
    amount: totalCharge,
    network: wallet.network
  });
  
  if (!transferResult.success) {
    throw new Error('USDC transfer failed');
  }
  
  // Get balance after transfer for accurate record-keeping
  const balanceAfter = await checkArbitrumUsdcBalance({
    walletAddress: wallet.address,
    network: wallet.network
  });
  
  // Record the transaction in database with actual on-chain balances
  const [transaction] = await db.insert(x402Transactions)
    .values({
      userId,
      type: 'payment',
      amount: totalCharge.toString(),
      status: 'completed',
      network: wallet.network,
      transactionHash: transferResult.transactionHash,
      fromAddress: wallet.address,
      toAddress: X402_CONFIG.platformWallet!,
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      metadata: {
        strategyId,
        provider,
        model,
        purpose: 'ai_call',
        actualAiCost,
        markup,
        totalCharge,
        markupPercentage: 100
      },
      description: `AI call payment - ${provider} ${model} (cost: $${actualAiCost.toFixed(4)}, charge: $${totalCharge.toFixed(4)})`,
      completedAt: new Date()
    })
    .returning({ id: x402Transactions.id });
  
  console.log(`[x402] AI call payment completed: tx ${transferResult.transactionHash}, charged $${totalCharge.toFixed(4)}`);
  
  return {
    success: true,
    transactionId: transaction.id,
    balanceAfter: balanceAfter,
    costBreakdown: {
      aiCost: actualAiCost,
      markup,
      totalCharge
    }
  };
}

/**
 * Process refund (if AI call fails, etc.)
 */
export async function processRefund(params: {
  userId: string;
  amount: number;
  reason: string;
  originalTransactionId?: string;
}): Promise<string> {
  const { userId, amount, reason, originalTransactionId } = params;
  
  // Get current balance
  const currentBalance = await getUserX402Balance(userId);
  const newBalance = currentBalance + amount;
  
  // Start transaction
  const result = await db.transaction(async (tx) => {
    // Update user balance
    await tx.update(users)
      .set({
        x402Balance: newBalance.toString(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    // Record refund transaction
    const [transaction] = await tx.insert(x402Transactions)
      .values({
        userId,
        type: 'refund',
        amount: amount.toString(),
        status: 'completed',
        network: 'base',
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        metadata: {
          reason,
          originalTransactionId
        },
        description: `Refund: ${reason}`,
        completedAt: new Date()
      })
      .returning({ id: x402Transactions.id });
    
    return transaction.id;
  });
  
  console.log(`[x402] Refund processed: $${amount} for user ${userId}, reason: ${reason}`);
  
  return result;
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(params: {
  userId: string;
  limit?: number;
  offset?: number;
  type?: 'deposit' | 'payment' | 'refund';
}): Promise<{
  transactions: any[];
  total: number;
}> {
  const { userId, limit = 50, offset = 0, type } = params;
  
  // Build where conditions
  const conditions = type 
    ? sql`${x402Transactions.userId} = ${userId} AND ${x402Transactions.type} = ${type}`
    : eq(x402Transactions.userId, userId);
  
  // Execute query
  const transactions = await db.select()
    .from(x402Transactions)
    .where(conditions)
    .orderBy(desc(x402Transactions.createdAt))
    .limit(limit)
    .offset(offset);
  
  // Get total count
  const countResult = await db.select({
    count: sql<number>`count(*)`
  })
  .from(x402Transactions)
  .where(conditions);
  
  return {
    transactions,
    total: Number(countResult[0]?.count || 0)
  };
}

/**
 * Verify blockchain transaction for deposit
 * This would integrate with Base blockchain to verify the USDC transfer
 * For now, it's a placeholder that returns true for testing
 */
export async function verifyBlockchainTransaction(params: {
  transactionHash: string;
  network: X402Network;
  expectedAmount: number;
  expectedRecipient: string;
}): Promise<{
  verified: boolean;
  actualAmount?: number;
  error?: string;
}> {
  const { transactionHash, network, expectedAmount, expectedRecipient } = params;
  
  // TODO: Implement actual blockchain verification using viem or ethers
  // For now, return placeholder
  console.log(`[x402] Verifying transaction ${transactionHash} on ${network}`);
  console.log(`[x402] Expected: ${expectedAmount} USDC to ${expectedRecipient}`);
  
  // Placeholder - in production, this would:
  // 1. Connect to Base RPC
  // 2. Get transaction details
  // 3. Verify recipient and amount
  // 4. Check USDC contract transfer event
  
  return {
    verified: true,
    actualAmount: expectedAmount,
  };
}

/**
 * Generate x402 payment request details
 * Returns payment information for client to pay via x402 protocol
 */
export function generatePaymentRequest(params: {
  amount: number;
  description: string;
  resource?: string;
}): {
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  network: string;
} {
  const { amount, description, resource = '/api/ai/chat' } = params;
  
  // Check if x402 is enabled
  if (!X402_CONFIG.enabled || !X402_CONFIG.platformWallet) {
    throw new Error('x402 micropayments not configured. Please contact support or upgrade your tier.');
  }
  
  return {
    maxAmountRequired: amount.toFixed(2),
    resource,
    description,
    payTo: X402_CONFIG.platformWallet,
    network: 'arbitrum' // Changed from 'base' to 'arbitrum'
  };
}

/**
 * Get x402 statistics for user
 */
export async function getX402Stats(userId: string): Promise<{
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  totalRefunded: number;
  transactionCount: number;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { x402Balance: true }
  });
  
  const stats = await db.select({
    totalDeposited: sql<string>`COALESCE(SUM(CASE WHEN ${x402Transactions.type} = 'deposit' THEN CAST(${x402Transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
    totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${x402Transactions.type} = 'payment' THEN CAST(${x402Transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
    totalRefunded: sql<string>`COALESCE(SUM(CASE WHEN ${x402Transactions.type} = 'refund' THEN CAST(${x402Transactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
    count: sql<number>`COUNT(*)`
  })
  .from(x402Transactions)
  .where(eq(x402Transactions.userId, userId));
  
  return {
    balance: parseFloat(user?.x402Balance || '0'),
    totalDeposited: parseFloat(stats[0]?.totalDeposited || '0'),
    totalSpent: parseFloat(stats[0]?.totalSpent || '0'),
    totalRefunded: parseFloat(stats[0]?.totalRefunded || '0'),
    transactionCount: Number(stats[0]?.count || 0)
  };
}
