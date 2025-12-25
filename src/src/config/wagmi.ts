import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'CryptoLattice',
  projectId: 'c6f68636b5f45b1cf0e37b975c7c6748',
  chains: [sepolia],
  ssr: false,
});
