import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the CryptoLattice address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const deployment = await hre.deployments.get("CryptoLattice");
  console.log(`CryptoLattice address is ${deployment.address}`);
});

task("task:mint-board", "Mints your lattice NFT if you do not own one yet").setAction(
  async function (_taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const signer = (await ethers.getSigners())[0];
    const deployment = await deployments.get("CryptoLattice");
    const contract = await ethers.getContractAt("CryptoLattice", deployment.address);

    const ownedTokenId = await contract.tokenOf(signer.address);
    if (ownedTokenId > 0n) {
      console.log(`You already own token #${ownedTokenId.toString()}`);
      return;
    }

    const tx = await contract.connect(signer).mintBoard();
    console.log(`Waiting for tx ${tx.hash}...`);
    await tx.wait();
    const newTokenId = await contract.tokenOf(signer.address);
    console.log(`Minted board token #${newTokenId.toString()}`);
  },
);

task("task:set-number", "Stores an encrypted number in your board")
  .addParam("position", "Slot position 0-8")
  .addParam("value", "Plain number to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const position = parseInt(taskArguments.position);
    const value = BigInt(taskArguments.value);

    await fhevm.initializeCLIApi();

    const signer = (await ethers.getSigners())[0];
    const deployment = await deployments.get("CryptoLattice");
    const contract = await ethers.getContractAt("CryptoLattice", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add256(value)
      .encrypt();

    const tx = await contract.connect(signer).setNumber(position, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Waiting for tx ${tx.hash}...`);
    await tx.wait();
    console.log(`Stored encrypted number ${value.toString()} at position ${position}`);
  });

task("task:set-address", "Stores an encrypted address in your board")
  .addParam("position", "Slot position 0-8")
  .addParam("value", "Address to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const position = parseInt(taskArguments.position);
    const value = String(taskArguments.value);

    await fhevm.initializeCLIApi();

    const signer = (await ethers.getSigners())[0];
    const deployment = await deployments.get("CryptoLattice");
    const contract = await ethers.getContractAt("CryptoLattice", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(value)
      .encrypt();

    const tx = await contract.connect(signer).setAddress(position, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Waiting for tx ${tx.hash}...`);
    await tx.wait();
    console.log(`Stored encrypted address ${value} at position ${position}`);
  });

task("task:grant-access", "Grants decrypt permission for a board slot")
  .addParam("position", "Slot position 0-8")
  .addParam("grantee", "Address to allow")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const position = parseInt(taskArguments.position);
    const grantee = String(taskArguments.grantee);

    const signer = (await ethers.getSigners())[0];
    const deployment = await deployments.get("CryptoLattice");
    const contract = await ethers.getContractAt("CryptoLattice", deployment.address);

    const tx = await contract.connect(signer).grantAccess(position, grantee);
    console.log(`Waiting for tx ${tx.hash}...`);
    await tx.wait();
    console.log(`Granted access for position ${position} to ${grantee}`);
  });

task("task:decrypt-slot", "Decrypts one of your board slots")
  .addParam("position", "Slot position 0-8")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    const position = parseInt(taskArguments.position);

    await fhevm.initializeCLIApi();

    const signer = (await ethers.getSigners())[0];
    const deployment = await deployments.get("CryptoLattice");
    const contract = await ethers.getContractAt("CryptoLattice", deployment.address);

    const tokenId = await contract.tokenOf(signer.address);
    if (tokenId === 0n) {
      throw new Error("Mint a board first");
    }

    const cell = await contract.getCell(tokenId, position);
    if (!cell[3]) {
      throw new Error("Slot is empty");
    }

    if (cell[2]) {
      const clearAddress = await fhevm.userDecryptEaddress(cell[1], deployment.address, signer);
      console.log(`Decrypted address: ${clearAddress}`);
    } else {
      const clearNumber = await fhevm.userDecryptEuint(
        FhevmType.euint256,
        cell[0],
        deployment.address,
        signer,
      );
      console.log(`Decrypted number: ${clearNumber.toString()}`);
    }
  });
