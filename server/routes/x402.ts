import express from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  getUserX402Balance,
  canPayForAICall,
  recordDeposit,
  getTransactionHistory,
  getX402Stats,
  verifyBlockchainTransaction,
  generatePaymentRequest,
  X402_CONFIG,
  type X402Network
} from '../x402';

const router = express.Router();

/**
 * GET /api/x402/balance
 * Get user's current x402 balance and payment capability
 */
router.get('/balance', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user!.id;
    const balance = await getUserX402Balance(userId);
    const paymentStatus = await canPayForAICall(userId);

    res.json({
      success: true,
      balance,
      canPayForAICall: paymentStatus.canPay,
      aiCallPrice: paymentStatus.required,
      config: {
        platformWallet: X402_CONFIG.platformWallet,
        networks: X402_CONFIG.networks,
        minDeposit: X402_CONFIG.minDeposit,
        minPayment: X402_CONFIG.minPayment
      }
    });
  } catch (error: any) {
    console.error('[x402] Error fetching balance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/x402/deposit
 * Record a deposit transaction after user sends USDC
 */
router.post('/deposit', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user!.id;
    const { amount, network, transactionHash, fromAddress } = req.body;

    // Validate inputs
    if (!amount || !network || !transactionHash || !fromAddress) {
      return res.status(400).json({
        error: 'Missing required fields: amount, network, transactionHash, fromAddress'
      });
    }

    if (!X402_CONFIG.networks.includes(network as X402Network)) {
      return res.status(400).json({
        error: `Invalid network. Supported networks: ${X402_CONFIG.networks.join(', ')}`
      });
    }

    if (amount < X402_CONFIG.minDeposit) {
      return res.status(400).json({
        error: `Minimum deposit is $${X402_CONFIG.minDeposit} USDC`
      });
    }

    // Verify blockchain transaction
    const verification = await verifyBlockchainTransaction({
      transactionHash,
      network,
      expectedAmount: amount,
      expectedRecipient: X402_CONFIG.platformWallet
    });

    if (!verification.verified) {
      return res.status(400).json({
        error: 'Transaction verification failed',
        details: verification.error
      });
    }

    // Record deposit
    const transactionId = await recordDeposit({
      userId,
      amount,
      network,
      transactionHash,
      fromAddress
    });

    const newBalance = await getUserX402Balance(userId);

    res.json({
      success: true,
      transactionId,
      amount,
      newBalance,
      message: 'Deposit recorded successfully'
    });
  } catch (error: any) {
    console.error('[x402] Error recording deposit:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/x402/transactions
 * Get user's transaction history with pagination
 */
router.get('/transactions', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as 'deposit' | 'payment' | 'refund' | undefined;

    const result = await getTransactionHistory({
      userId,
      limit,
      offset,
      type
    });

    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit,
      offset,
      hasMore: offset + limit < result.total
    });
  } catch (error: any) {
    console.error('[x402] Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/x402/stats
 * Get comprehensive x402 statistics for user
 */
router.get('/stats', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user!.id;
    const stats = await getX402Stats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('[x402] Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/x402/payment-request
 * Generate x402 payment request details for AI call
 */
router.get('/payment-request', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const description = req.query.description as string || 'AI call payment';
    const resource = req.query.resource as string;

    const paymentRequest = generatePaymentRequest({
      amount: X402_CONFIG.aiCallPrice,
      description,
      resource
    });

    res.json({
      success: true,
      payment: paymentRequest
    });
  } catch (error: any) {
    console.error('[x402] Error generating payment request:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/x402/config
 * Get x402 configuration (public endpoint)
 */
router.get('/config', async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        aiCallPrice: X402_CONFIG.aiCallPrice,
        platformWallet: X402_CONFIG.platformWallet,
        networks: X402_CONFIG.networks,
        minDeposit: X402_CONFIG.minDeposit,
        minPayment: X402_CONFIG.minPayment
      }
    });
  } catch (error: any) {
    console.error('[x402] Error fetching config:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
