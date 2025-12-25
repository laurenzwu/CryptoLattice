import { useMemo, useState } from 'react';
import { Contract, ethers } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/Lattice.css';

type BoardCell = {
  position: number;
  isAddress: boolean;
  initialized: boolean;
  numericCipher: string;
  addressCipher: string;
};

const EMPTY_GRID: BoardCell[] = Array.from({ length: 9 }, (_, index) => ({
  position: index,
  isAddress: false,
  initialized: false,
  numericCipher: '0x',
  addressCipher: '0x',
}));

export function LatticeApp() {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const contractReady = CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [numberInput, setNumberInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [grantInput, setGrantInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const { data: tokenData, refetch: refetchToken } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'tokenOf',
    args: address && contractReady ? [address] : undefined,
    query: { enabled: Boolean(address && contractReady) },
  });

  const tokenId = typeof tokenData === 'bigint' ? tokenData : tokenData ? BigInt(tokenData as any) : 0n;
  const hasBoard = tokenId > 0n;

  const {
    data: boardData,
    refetch: refetchBoard,
    isFetching: boardLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getBoard',
    args: hasBoard && contractReady ? [tokenId] : undefined,
    query: { enabled: hasBoard && contractReady },
  });

  const { data: allowedData, refetch: refetchAllowed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getAllowedAddresses',
    args: hasBoard && contractReady ? [tokenId, selectedPosition] : undefined,
    query: { enabled: hasBoard && contractReady },
  });

  const cells: BoardCell[] = useMemo(() => {
    if (!boardData) {
      return EMPTY_GRID;
    }

    const [numbers, addresses, types, initialized] = boardData as unknown as [
      string[],
      string[],
      boolean[],
      boolean[],
    ];

    return numbers.map((numericCipher, index) => ({
      position: index,
      isAddress: types[index],
      initialized: initialized[index],
      numericCipher: numericCipher,
      addressCipher: addresses[index],
    }));
  }, [boardData]);

  const selectedCell = cells[selectedPosition] || EMPTY_GRID[selectedPosition];
  const allowedAddresses = (allowedData || []) as string[];

  const refreshBoard = async () => {
    await Promise.all([refetchBoard(), refetchAllowed()]);
  };

  const requireSigner = async () => {
    const resolved = await signer;
    if (!resolved) {
      throw new Error('Connect your wallet first.');
    }
    return resolved;
  };

  const requireBoard = () => {
    if (!contractReady) {
      throw new Error('Set the deployed contract address before interacting.');
    }
    if (!hasBoard) {
      throw new Error('Mint your lattice NFT before interacting with slots.');
    }
  };

  const handleMint = async () => {
    try {
      if (!contractReady) {
        throw new Error('Set the deployed contract address before minting.');
      }
      setStatus('Preparing mint transaction...');
      const resolvedSigner = await requireSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      setTxPending(true);
      const tx = await contract.mintBoard();
      setStatus('Waiting for confirmation...');
      await tx.wait();
      setStatus('Minted your lattice!');
      await refetchToken();
      await refreshBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mint failed';
      setStatus(message);
    } finally {
      setTxPending(false);
    }
  };

  const handleSaveNumber = async () => {
    try {
      requireBoard();
      if (!instance || !address) {
        throw new Error('Encryption is still loading.');
      }
      if (!numberInput.trim()) {
        throw new Error('Enter a number to store.');
      }

      const parsed = BigInt(numberInput.trim());
      const resolvedSigner = await requireSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      setTxPending(true);
      setStatus('Encrypting number...');
      const encryptedInput = await instance.createEncryptedInput(CONTRACT_ADDRESS, address).add256(parsed).encrypt();

      const tx = await contract.setNumber(selectedPosition, encryptedInput.handles[0], encryptedInput.inputProof);
      setStatus('Sending transaction...');
      await tx.wait();
      setStatus('Number stored securely.');
      setNumberInput('');
      setDecryptedValue(null);
      await refreshBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to store number';
      setStatus(message);
    } finally {
      setTxPending(false);
    }
  };

  const handleSaveAddress = async () => {
    try {
      requireBoard();
      if (!instance || !address) {
        throw new Error('Encryption is still loading.');
      }
      if (!ethers.isAddress(addressInput.trim())) {
        throw new Error('Enter a valid address.');
      }

      const resolvedSigner = await requireSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      setTxPending(true);
      setStatus('Encrypting address...');
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(addressInput.trim())
        .encrypt();

      const tx = await contract.setAddress(selectedPosition, encryptedInput.handles[0], encryptedInput.inputProof);
      setStatus('Sending transaction...');
      await tx.wait();
      setStatus('Address stored securely.');
      setAddressInput('');
      setDecryptedValue(null);
      await refreshBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to store address';
      setStatus(message);
    } finally {
      setTxPending(false);
    }
  };

  const handleGrantAccess = async () => {
    try {
      requireBoard();
      if (!ethers.isAddress(grantInput.trim())) {
        throw new Error('Enter a valid address to grant access.');
      }
      const resolvedSigner = await requireSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      setTxPending(true);
      setStatus('Granting access...');
      const tx = await contract.grantAccess(selectedPosition, grantInput.trim());
      await tx.wait();
      setStatus('Access granted.');
      setGrantInput('');
      await refetchAllowed();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to grant access';
      setStatus(message);
    } finally {
      setTxPending(false);
    }
  };

  const handleDecrypt = async () => {
    try {
      requireBoard();
      if (!instance || !address) {
        throw new Error('Encryption is still loading.');
      }
      if (!selectedCell.initialized) {
        throw new Error('Select a slot with data.');
      }

      setDecrypting(true);
      setStatus('Preparing user decryption...');

      const handle = selectedCell.isAddress ? selectedCell.addressCipher : selectedCell.numericCipher;
      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle, contractAddress: CONTRACT_ADDRESS }];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const resolvedSigner = await requireSigner();
      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const plaintext = result[handle];
      const formatted = selectedCell.isAddress ? plaintext : BigInt(plaintext).toString();
      setDecryptedValue(formatted);
      setStatus('Decryption complete.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decrypt slot';
      setStatus(message);
    } finally {
      setDecrypting(false);
    }
  };

  const connectionNotice = !contractReady
    ? 'Update the contract address after deploying to Sepolia.'
    : !address
      ? 'Connect your wallet to mint and manage your lattice.'
      : !hasBoard
        ? 'Mint your board to start storing encrypted values.'
        : '';

  return (
    <div className="page-shell">
      <Header />
      <main className="lattice-main">
        <section className="hero">
          <div>
            <p className="eyebrow">Encrypted NFT Playground</p>
            <h1>Build your private 3x3 lattice.</h1>
            <p className="lede">
              Each slot holds an encrypted number or address. Grant precise decrypt permissions without ever revealing
              the data on-chain.
            </p>
            {connectionNotice && <div className="pill pill-warning">{connectionNotice}</div>}
            {status && <div className="pill pill-info">{status}</div>}
            {zamaError && <div className="pill pill-danger">{zamaError}</div>}
          </div>
          <div className="summary-card">
            <div className="summary-row">
              <span>Wallet</span>
              <span className="value-text">{address || 'Not connected'}</span>
            </div>
            <div className="summary-row">
              <span>Token Id</span>
              <span className="value-text">{hasBoard ? tokenId.toString() : '—'}</span>
            </div>
            <div className="summary-row">
              <span>Grid</span>
              <span className="value-text">3 × 3</span>
            </div>
            <button className="action-button" onClick={handleMint} disabled={!address || hasBoard || txPending}>
              {hasBoard ? 'Board ready' : txPending ? 'Minting...' : 'Mint your board'}
            </button>
          </div>
        </section>

        <section className="board-section">
          <div className="board-header">
            <div>
              <p className="eyebrow">Encrypted slots</p>
              <h2>Your lattice</h2>
            </div>
            <div className="board-meta">
              <span className="badge">{boardLoading ? 'Refreshing' : 'Live'}</span>
              <span className="badge secondary">Position {selectedPosition + 1}/9</span>
            </div>
          </div>
          <div className="board-grid">
            {cells.map((cell) => {
              const active = cell.position === selectedPosition;
              const stateLabel = !cell.initialized ? 'Empty' : cell.isAddress ? 'Address' : 'Number';
              return (
                <button
                  key={cell.position}
                  className={`cell-card ${active ? 'active' : ''}`}
                  onClick={() => setSelectedPosition(cell.position)}
                >
                  <div className="cell-top">
                    <div className="cell-id">Slot {cell.position + 1}</div>
                    <span className={`chip ${cell.initialized ? 'chip-live' : 'chip-empty'}`}>{stateLabel}</span>
                  </div>
                  <p className="cipher-label">
                    Cipher handle
                    <span className="cipher-text">
                      {(cell.isAddress ? cell.addressCipher : cell.numericCipher).slice(0, 10)}...
                    </span>
                  </p>
                  <p className="cell-foot">
                    {cell.initialized ? 'Ready to decrypt' : 'Awaiting data'}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panels">
          <div className="panel">
            <div className="panel-header">
              <p className="eyebrow">Write</p>
              <h3>Store encrypted values</h3>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Number</label>
                <input
                  type="number"
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value)}
                  placeholder="Enter any integer"
                />
                <button onClick={handleSaveNumber} disabled={txPending || zamaLoading || !hasBoard}>
                  {txPending ? 'Working...' : 'Save number'}
                </button>
              </div>
              <div className="field">
                <label>Address</label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="0x..."
                />
                <button onClick={handleSaveAddress} disabled={txPending || zamaLoading || !hasBoard}>
                  {txPending ? 'Working...' : 'Save address'}
                </button>
              </div>
            </div>
            <p className="hint">Writes use ethers while reads stay on viem to avoid RPC switching.</p>
          </div>

          <div className="panel">
            <div className="panel-header">
              <p className="eyebrow">Decrypt</p>
              <h3>Personal access</h3>
            </div>
            <div className="field">
              <label>Selected slot</label>
              <div className="slot-summary">
                <span>Slot {selectedPosition + 1}</span>
                <span>{selectedCell.initialized ? (selectedCell.isAddress ? 'Address' : 'Number') : 'Empty'}</span>
              </div>
            </div>
            <button
              className="action-button"
              onClick={handleDecrypt}
              disabled={!hasBoard || decrypting || zamaLoading || !selectedCell.initialized}
            >
              {decrypting ? 'Decrypting...' : 'Decrypt with relayer'}
            </button>
            {decryptedValue && (
              <div className="decrypt-card">
                <p className="eyebrow">Decrypted value</p>
                <p className="decrypted-text">{decryptedValue}</p>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <p className="eyebrow">Share</p>
              <h3>Grant access to slot</h3>
            </div>
            <div className="field">
              <label>Address to allow</label>
              <input
                type="text"
                value={grantInput}
                onChange={(e) => setGrantInput(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <button onClick={handleGrantAccess} disabled={!hasBoard || txPending}>
              {txPending ? 'Working...' : 'Grant access'}
            </button>
            <div className="allowed-list">
              <p className="eyebrow">Allowed for slot {selectedPosition + 1}</p>
              {allowedAddresses.length === 0 && <p className="muted">No external readers yet.</p>}
              {allowedAddresses.map((item) => (
                <div key={item} className="allowed-item">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
