import { http, createConfig } from 'wagmi';
import { arbitrum, mainnet, base, optimism } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  rabbyWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'demo-project-id';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        rabbyWallet,
        metaMaskWallet,
        rainbowWallet,
        coinbaseWallet,
        walletConnectWallet,
        trustWallet,
      ],
    },
  ],
  {
    appName: '1fox',
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [arbitrum, mainnet, base, optimism],
  ssr: false,
  transports: {
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
  },
});
