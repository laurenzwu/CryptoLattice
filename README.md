# CryptoLattice

CryptoLattice is a fully homomorphic encryption (FHE) powered, non-transferable NFT that stores a 3x3 lattice of
encrypted slots. Each slot can hold an encrypted number or address, and owners can grant per-slot decrypt permissions
to other wallets without exposing plaintext on-chain.

## Project summary
CryptoLattice combines FHE with an access-controlled NFT to provide privacy-preserving, user-owned data storage. The
NFT acts as a compact grid of encrypted values, and each cell can be shared independently. This enables fine-grained,
on-custodial data sharing without revealing data to the chain or to unauthorized viewers.

## The problem
On-chain applications often require users to store or share data, but public blockchains make that data permanently
visible. Even with access control, data published to the chain can be read by anyone. This limits use cases like
selective disclosure, private identity proofs, or private coordination where only specific parties should decrypt a
value.

## The solution
CryptoLattice uses FHE so encrypted data can be stored on-chain while remaining confidential. Access control is applied
at the per-slot level, so a user can share a single slot without sharing the entire grid. Decryption is performed via a
relayer flow that follows Zama guidance, enabling authorized wallets to decrypt their granted slot only.

## Key advantages
- Fine-grained sharing: permissions are per-slot, not all-or-nothing.
- Privacy by default: values are encrypted before they touch the chain.
- Non-transferable ownership: access control stays aligned with the original owner.
- Deterministic views: read methods avoid msg.sender for predictable results.
- Clear developer workflow: tasks and tests cover the full flow.

## Features
- Mint a single NFT that contains a 3x3 lattice (9 slots).
- Store encrypted numbers or addresses in any slot.
- Grant or revoke decrypt access for a specific slot.
- Decrypt only the slots you are authorized to view.
- Frontend that reads with viem and writes with ethers.

## Repository layout
- `contracts/` Solidity smart contracts
- `deploy/` Hardhat deployment scripts
- `tasks/` Hardhat tasks for minting, writing, granting, and decrypting
- `test/` FHEVM mock tests
- `src/` React + Vite frontend (no Tailwind, no env vars, no localstorage)
- `deployments/sepolia/` Deployment JSON and ABI snapshot for the frontend

## Tech stack
- Smart contracts: Solidity with Hardhat
- FHE: Zama FHEVM libraries and relayer flow
- Frontend: React + Vite
- Wallet UX: RainbowKit
- On-chain reads: viem
- On-chain writes: ethers
- Tests: TypeScript + Hardhat
- Package manager: npm

## How it works
1. Mint the lattice NFT.
2. Encrypt a number or address off-chain.
3. Write the encrypted value into a slot.
4. Grant decrypt access to a specific wallet for that slot.
5. The grantee uses the relayer flow to decrypt their slot.

## Prerequisites
- Node.js 20+
- npm
- A Sepolia RPC key and a deployer private key in a local `.env` file

Required environment variables (backend only):
- `INFURA_API_KEY`
- `PRIVATE_KEY`

Notes:
- No mnemonic support is used or expected.
- The frontend does not use environment variables; all frontend config is inline.

## Install and build
```bash
npm install
npm run compile
```

## Test
```bash
npm test
```

## Deploy
Local node deployment (requires a local node already running):
```bash
npx hardhat deploy --network localhost
```

Sepolia deployment (requires INFURA_API_KEY and PRIVATE_KEY):
```bash
npx hardhat deploy --network sepolia
```

## Hardhat tasks
- `npx hardhat task:address`
- `npx hardhat task:mint-board`
- `npx hardhat task:set-number --position 0 --value 123`
- `npx hardhat task:set-address --position 1 --value <addr>`
- `npx hardhat task:grant-access --position 0 --grantee <addr>`
- `npx hardhat task:decrypt-slot --position 0`

## Frontend setup
- The frontend is in `src/` and targets Sepolia.
- Reads are executed with viem and writes are executed with ethers.
- The contract ABI must be copied from `deployments/sepolia/CryptoLattice.json`.
- After deployment, update the address in `src/src/config/contracts.ts` and the JSON deployment file.
- Do not introduce Tailwind, environment variables, or localstorage.

## Contract notes
- The NFT is non-transferable to keep access control consistent with the minter.
- View methods avoid msg.sender to keep reads deterministic across callers.
- Encrypted values remain opaque on-chain.

## Security and limitations
- Decryption relies on the Zama relayer flow; only granted wallets should decrypt.
- The grid is fixed to 3x3 to keep gas and UX predictable.
- Access control is per-slot; sharing one slot does not imply sharing others.
- Users are responsible for key management and wallet security.

## Future plans
- Slot-level revocation UX improvements.
- Better visual diffing of slot states and access grants.
- Multi-slot batch writes and grants to reduce transaction count.
- Optional slot metadata that stays encrypted.
- More robust relayer status and error surfaces in the UI.
- Additional test coverage for edge cases and failure modes.

## License
See `LICENSE`.
