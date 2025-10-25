import { http, createConfig } from 'wagmi';
import { arbitrum, mainnet, base, optimism } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'demo-project-id';

export const config = getDefaultConfig({
  appName: '1fox',
  projectId,
  chains: [arbitrum, mainnet, base, optimism],
  ssr: false,
});
