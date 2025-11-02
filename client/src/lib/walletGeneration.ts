/**
 * Client-side wallet generation from BIP39 seed phrase
 * CRITICAL SECURITY: Private keys and seed phrases are NEVER stored
 * This file only generates wallets in-memory for one-time display to user
 * 
 * Uses @scure/bip39 - browser-native library that doesn't require Node.js Buffer
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair } from '@solana/web3.js';
import { HDNodeWallet } from 'ethers';

// Standard BIP44 derivation paths
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'"; // Solana standard path
const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0"; // Ethereum standard path (first account)

export interface GeneratedWallets {
  seedPhrase: string; // 12-word BIP39 mnemonic - shown once, then discarded
  solana: {
    publicKey: string; // Base58 encoded public key
    privateKey: Uint8Array; // For in-memory use only, never persisted
  };
  evm: {
    address: string; // Checksummed Ethereum address
    privateKey: string; // Hex private key for in-memory use only, never persisted
  };
  polygon: {
    address: string; // Same as EVM address (Polygon is EVM-compatible)
    privateKey: string; // Same as EVM private key
  };
  hyperliquid: {
    address: string; // Same as EVM address
    privateKey: string; // Same as EVM private key
  };
  bnb: {
    address: string; // Same as EVM address (BNB Chain/BSC is EVM-compatible)
    privateKey: string; // Same as EVM private key
  };
}

/**
 * Generate a new 12-word BIP39 seed phrase and derive all wallets
 * SECURITY: This function returns private keys for immediate use
 * The caller MUST:
 * 1. Show seed phrase to user once
 * 2. Never store private keys or seed phrase anywhere
 * 3. Clear all sensitive data from memory after use
 */
export function generateEmbeddedWallets(): GeneratedWallets {
  // Generate 12-word mnemonic (128 bits of entropy) using browser-native library
  const mnemonic = generateMnemonic(wordlist);
  
  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(mnemonic);
  
  // Derive Solana wallet
  const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32)); // Solana uses first 32 bytes
  
  // Derive EVM wallet using ethers HDNodeWallet
  const evmWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_DERIVATION_PATH);
  
  return {
    seedPhrase: mnemonic,
    solana: {
      publicKey: solanaKeypair.publicKey.toBase58(),
      privateKey: solanaKeypair.secretKey,
    },
    evm: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    polygon: {
      // Polygon uses the same EVM wallet (EVM-compatible L2)
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    hyperliquid: {
      // Hyperliquid uses the same EVM wallet
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    bnb: {
      // BNB Chain (BSC) uses the same EVM wallet (EVM-compatible)
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
  };
}

/**
 * Recover wallets from an existing seed phrase
 * Used for testing/verification only - users should NEVER re-enter seed phrases into the platform
 * @param seedPhrase - 12 or 24 word BIP39 mnemonic
 */
export function recoverWalletsFromSeed(seedPhrase: string): GeneratedWallets {
  if (!validateMnemonic(seedPhrase, wordlist)) {
    throw new Error('Invalid seed phrase');
  }
  
  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(seedPhrase);
  
  // Derive Solana wallet
  const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32));
  
  // Derive EVM wallet
  const evmWallet = HDNodeWallet.fromPhrase(seedPhrase, undefined, EVM_DERIVATION_PATH);
  
  return {
    seedPhrase,
    solana: {
      publicKey: solanaKeypair.publicKey.toBase58(),
      privateKey: solanaKeypair.secretKey,
    },
    evm: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    polygon: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    hyperliquid: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    bnb: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
  };
}

/**
 * Securely clear sensitive wallet data from memory
 * Call this after user confirms they've saved their seed phrase
 */
export function clearWalletData(wallets: GeneratedWallets): void {
  // Overwrite sensitive data with zeros
  if (wallets.solana.privateKey) {
    wallets.solana.privateKey.fill(0);
  }
  
  // Clear string references (JS GC will handle actual cleanup)
  (wallets as any).seedPhrase = '';
  (wallets as any).evm.privateKey = '';
  (wallets as any).polygon.privateKey = '';
  (wallets as any).hyperliquid.privateKey = '';
  (wallets as any).bnb.privateKey = '';
}
