import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const RPC_ENDPOINTS = {
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon-rpc.com',
  bnb: 'https://bsc-dataseed1.binance.org',
  hyperliquid: 'https://api.hyperliquid-testnet.xyz/evm',
  solana: 'https://api.mainnet-beta.solana.com',
};

const EXPLORER_URLS = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  bnb: 'https://bscscan.com/tx/',
  hyperliquid: 'https://explorer.hyperliquid.xyz/tx/',
  solana: 'https://solscan.io/tx/',
};

export interface WithdrawalRequest {
  chain: 'ethereum' | 'polygon' | 'solana' | 'bnb' | 'hyperliquid' | 'arbitrum';
  token: string;
  amount: string;
  recipient: string;
  fromAddress: string;
  privateKey: string; // Decrypted private key
}

export interface GasEstimate {
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedFee: string;
  estimatedFeeUSD?: string;
  platformFee?: string;
  platformFeeDescription?: string;
  isGasless?: boolean;
}

export interface TransactionResult {
  transactionHash: string;
  explorerUrl: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: string;
  gasUsed?: string;
  totalFee?: string;
  errorMessage?: string;
}

export class WithdrawalService {
  private getProvider(chain: string): ethers.JsonRpcProvider {
    const rpcUrl = RPC_ENDPOINTS[chain as keyof typeof RPC_ENDPOINTS];
    if (!rpcUrl) throw new Error(`Unsupported chain: ${chain}`);
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  private getSolanaConnection(): Connection {
    return new Connection(RPC_ENDPOINTS.solana, 'confirmed');
  }

  async validateAddress(chain: string, address: string): Promise<boolean> {
    try {
      if (chain === 'solana') {
        try {
          new PublicKey(address);
          return true;
        } catch {
          return false;
        }
      } else {
        return ethers.isAddress(address);
      }
    } catch (error) {
      return false;
    }
  }

  async estimateGas(request: Omit<WithdrawalRequest, 'privateKey'>): Promise<GasEstimate> {
    const { chain, token, amount, recipient, fromAddress } = request;

    // Hyperliquid USDC withdrawals are gasless - validators pay the Arbitrum gas
    // Users only pay the $1 USDC fee which covers everything
    if (chain === 'hyperliquid' && token === 'USDC') {
      return {
        estimatedFee: '0',
        platformFee: '1.0',
        platformFeeDescription: 'Gasless withdrawal - $1 USDC covers all network costs (no ETH needed)',
        isGasless: true,
      };
    }

    let estimate: GasEstimate;
    
    if (chain === 'solana') {
      estimate = await this.estimateSolanaGas(amount, recipient, fromAddress);
    } else {
      estimate = await this.estimateEvmGas(chain, amount, recipient, fromAddress);
    }

    // Add platform-specific fees (separate from network fees)
    const platformFeeInfo = this.getPlatformFee(chain, token);
    if (platformFeeInfo) {
      estimate.platformFee = platformFeeInfo.fee;
      estimate.platformFeeDescription = platformFeeInfo.description;
    }

    return estimate;
  }

  private getPlatformFee(chain: string, token: string): { fee: string; description: string } | null {
    // Hyperliquid charges $1 USDC withdrawal fee for USDC withdrawals only
    if (chain === 'hyperliquid' && token === 'USDC') {
      return {
        fee: '1.0',
        description: 'Hyperliquid charges a flat $1 USDC withdrawal fee for USDC withdrawals',
      };
    }
    
    // Polymarket has no platform fee (only network gas)
    if (chain === 'polygon') {
      return {
        fee: '0.0',
        description: 'Polymarket charges no platform fees. You only pay Polygon network gas fees.',
      };
    }
    
    // No platform fees for other chains/tokens
    return null;
  }

  private async estimateEvmGas(
    chain: string,
    amount: string,
    recipient: string,
    fromAddress: string
  ): Promise<GasEstimate> {
    const provider = this.getProvider(chain);
    
    const tx = {
      from: fromAddress,
      to: recipient,
      value: ethers.parseEther(amount),
    };

    const [gasLimit, feeData] = await Promise.all([
      provider.estimateGas(tx),
      provider.getFeeData(),
    ]);

    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

    const estimatedFee = (gasLimit * maxFeePerGas) / BigInt(1e18);

    return {
      gasLimit: gasLimit.toString(),
      maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei'),
      maxPriorityFeePerGas: ethers.formatUnits(maxPriorityFeePerGas, 'gwei'),
      estimatedFee: estimatedFee.toString(),
    };
  }

  private async estimateSolanaGas(
    amount: string,
    recipient: string,
    fromAddress: string
  ): Promise<GasEstimate> {
    const connection = this.getSolanaConnection();
    const recentBlockhash = await connection.getLatestBlockhash();
    
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(fromAddress),
        toPubkey: new PublicKey(recipient),
        lamports,
      })
    );
    
    transaction.recentBlockhash = recentBlockhash.blockhash;
    transaction.feePayer = new PublicKey(fromAddress);

    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    const estimatedFeeSOL = (fee.value || 5000) / LAMPORTS_PER_SOL;

    return {
      estimatedFee: estimatedFeeSOL.toString(),
    };
  }

  async sendTransaction(request: WithdrawalRequest): Promise<TransactionResult> {
    const { chain } = request;

    if (chain === 'solana') {
      return this.sendSolanaTransaction(request);
    } else {
      return this.sendEvmTransaction(request);
    }
  }

  private async sendEvmTransaction(request: WithdrawalRequest): Promise<TransactionResult> {
    const { chain, amount, recipient, privateKey } = request;
    
    const provider = this.getProvider(chain);
    const wallet = new ethers.Wallet(privateKey, provider);

    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

    const tx = {
      to: recipient,
      value: ethers.parseEther(amount),
      maxFeePerGas,
      maxPriorityFeePerGas,
    };

    try {
      const txResponse = await wallet.sendTransaction(tx);
      const explorerUrl = EXPLORER_URLS[chain as keyof typeof EXPLORER_URLS] + txResponse.hash;

      return {
        transactionHash: txResponse.hash,
        explorerUrl,
        status: 'pending',
      };
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  private async sendSolanaTransaction(request: WithdrawalRequest): Promise<TransactionResult> {
    const { amount, recipient, privateKey } = request;
    
    const connection = this.getSolanaConnection();
    
    const fromKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: new PublicKey(recipient),
        lamports,
      })
    );

    try {
      const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
      const explorerUrl = EXPLORER_URLS.solana + signature;

      return {
        transactionHash: signature,
        explorerUrl,
        status: 'pending',
      };
    } catch (error: any) {
      throw new Error(`Solana transaction failed: ${error.message}`);
    }
  }

  async getTransactionStatus(chain: string, txHash: string): Promise<{ status: 'pending' | 'confirmed' | 'failed', blockNumber?: string, gasUsed?: string }> {
    if (chain === 'solana') {
      return this.getSolanaTransactionStatus(txHash);
    } else {
      return this.getEvmTransactionStatus(chain, txHash);
    }
  }

  private async getEvmTransactionStatus(chain: string, txHash: string): Promise<{ status: 'pending' | 'confirmed' | 'failed', blockNumber?: string, gasUsed?: string }> {
    const provider = this.getProvider(chain);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { status: 'pending' };
    }

    const status = receipt.status === 1 ? 'confirmed' : 'failed';
    const blockNumber = receipt.blockNumber?.toString();
    const gasUsed = ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || BigInt(0)));

    return {
      status,
      blockNumber,
      gasUsed,
    };
  }

  private async getSolanaTransactionStatus(signature: string): Promise<{ status: 'pending' | 'confirmed' | 'failed', blockNumber?: string, gasUsed?: string }> {
    const connection = this.getSolanaConnection();
    
    const status = await connection.getSignatureStatus(signature);
    
    if (!status || !status.value) {
      return { status: 'pending' };
    }

    if (status.value.err) {
      return { status: 'failed' };
    }

    if (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized') {
      return {
        status: 'confirmed',
        blockNumber: status.value.slot?.toString(),
      };
    }

    return { status: 'pending' };
  }
}

export const withdrawalService = new WithdrawalService();
