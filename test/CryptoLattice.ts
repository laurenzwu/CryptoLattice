import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { CryptoLattice, CryptoLattice__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("CryptoLattice")) as CryptoLattice__factory;
  const contract = (await factory.deploy()) as CryptoLattice;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

describe("CryptoLattice", function () {
  let signers: Signers;
  let lattice: CryptoLattice;
  let latticeAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ contract: lattice, contractAddress: latticeAddress } = await deployFixture());
    await lattice.connect(signers.alice).mintBoard();
  });

  it("only allows one mint per address", async function () {
    await expect(lattice.connect(signers.alice).mintBoard()).to.be.revertedWithCustomError(lattice, "AlreadyMinted");

    await expect(lattice.connect(signers.bob).mintBoard()).to.emit(lattice, "BoardMinted");
    const bobTokenId = await lattice.tokenOf(signers.bob.address);
    expect(bobTokenId).to.eq(2n);
  });

  it("stores and decrypts a numeric slot", async function () {
    const tokenId = await lattice.tokenOf(signers.alice.address);
    const clearValue = 42n;

    const encryptedInput = await fhevm
      .createEncryptedInput(latticeAddress, signers.alice.address)
      .add256(clearValue)
      .encrypt();

    const tx = await lattice
      .connect(signers.alice)
      .setNumber(0, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const cell = await lattice.getCell(tokenId, 0);
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint256, cell[0], latticeAddress, signers.alice);
    expect(decrypted).to.eq(clearValue);
  });

  it("stores and decrypts an address slot", async function () {
    const tokenId = await lattice.tokenOf(signers.alice.address);
    const target = signers.bob.address;

    const encryptedInput = await fhevm
      .createEncryptedInput(latticeAddress, signers.alice.address)
      .addAddress(target)
      .encrypt();

    const tx = await lattice
      .connect(signers.alice)
      .setAddress(1, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const cell = await lattice.getCell(tokenId, 1);
    const decrypted = await fhevm.userDecryptEaddress(cell[1], latticeAddress, signers.alice);
    expect(decrypted.toLowerCase()).to.eq(target.toLowerCase());
  });

  it("grants decryption access for a slot", async function () {
    const clearValue = 77n;

    const encryptedInput = await fhevm
      .createEncryptedInput(latticeAddress, signers.alice.address)
      .add256(clearValue)
      .encrypt();

    await lattice.connect(signers.alice).setNumber(2, encryptedInput.handles[0], encryptedInput.inputProof);
    await lattice.connect(signers.alice).grantAccess(2, signers.bob.address);

    const cell = await lattice.getCell(await lattice.tokenOf(signers.alice.address), 2);
    const decryptedByBob = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      cell[0],
      latticeAddress,
      signers.bob,
    );
    expect(decryptedByBob).to.eq(clearValue);
  });
});
