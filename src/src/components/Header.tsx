import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark">CL</div>
          <div>
            <p className="brand-title">CryptoLattice</p>
            <p className="brand-subtitle">Encrypted grid NFT</p>
          </div>
        </div>
        <ConnectButton showBalance={false} />
      </div>
    </header>
  );
}
