import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedCryptoLattice = await deploy("CryptoLattice", {
    from: deployer,
    log: true,
  });

  console.log(`CryptoLattice contract: `, deployedCryptoLattice.address);
};
export default func;
func.id = "deploy_crypto_lattice"; // id required to prevent reexecution
func.tags = ["CryptoLattice"];
