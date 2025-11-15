import { db } from './db';
import { users, x402Transactions, type InsertX402Transaction } from '../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

// x402 Configuration
export const X402_CONFIG = {
  // AI call pricing (in USDC)
  aiCallPrice: 0.18, // $0.18 per AI call
  
  // Platform wallet for receiving deposits (Base network)
  platformWallet: process.env.X402_PLATFORM_WALLET || '0x0000000000000000000000000000000000000000',
  
  // Supported networks
  networks: ['base', 'base-sepolia'] as const,
  
  // Minimum deposit/payment amounts
  minDeposit: 1.0, // $1 minimum deposit
  minPayment: 0.01, // $0.01 minimum payment
} as const;

export type X402Network = typeof X402_CONFIG.networks[number];

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
 * Check if user has sufficient x402 balance for AI call
 */
export async function canPayForAICall(userId: string): Promise<{
  canPay: boolean;
  balance: number;
  required: number;
  shortfall: number;
}> {
  const balance = await getUserX402Balance(userId);
  const required = X402_CONFIG.aiCallPrice;
  const shortfall = Math.max(0, required - balance);
  
  return {
    canPay: balance >= required,
    balance,
    required,
    shortfall
  };
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
  
  if (amount < X402_CONFIG.minDeposit) {
    throw new Error(`Minimum deposit is $${X402_CONFIG.minDeposit} USDC`);
  }
  
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
 * Process AI call payment
 * Deducts from user's x402 balance and records transaction
 * Uses row-level locking to prevent race conditions in concurrent requests
 */
export async function processAICallPayment(params: {
  userId: string;
  strategyId?: string;
  provider: string;
  model: string;
}): Promise<{
  success: boolean;
  transactionId: string;
  balanceAfter: number;
}> {
  const { userId, strategyId, provider, model } = params;
  const amount = X402_CONFIG.aiCallPrice;
  
  // Start transaction with row-level locking to prevent concurrent balance overdraft
  const result = await db.transaction(async (tx) => {
    // Lock the user row for update (prevents concurrent modifications)
    const [user] = await tx.execute(
      sql`SELECT x402_balance FROM users WHERE id = ${userId} FOR UPDATE`
    );
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const currentBalance = parseFloat(user.x402_balance || '0');
    
    // Check balance while holding the lock
    if (currentBalance < amount) {
      throw new Error(`Insufficient x402 balance. Required: $${amount}, Available: $${currentBalance.toFixed(2)}`);
    }
    
    const newBalance = currentBalance - amount;
    
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
        type: 'payment',
        amount: amount.toString(),
        status: 'completed',
        network: 'base',
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        metadata: {
          strategyId,
          provider,
          model,
          purpose: 'ai_call'
        },
        description: `AI call payment - ${provider} ${model}`,
        completedAt: new Date()
      })
      .returning({ id: x402Transactions.id });
    
    return { id: transaction.id, balanceAfter: newBalance };
  });
  
  console.log(`[x402] AI call payment processed: $${amount} for user ${userId}, new balance: $${result.balanceAfter.toFixed(2)}`);
  
  return {
    success: true,
    transactionId: result.id,
    balanceAfter: result.balanceAfter
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
  
  return {
    maxAmountRequired: amount.toFixed(2),
    resource,
    description,
    payTo: X402_CONFIG.platformWallet,
    network: 'base'
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
