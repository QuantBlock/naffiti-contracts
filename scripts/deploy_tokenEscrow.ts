import { ethers, network, upgrades } from "hardhat";
import { NAFFITI } from "./constant";

async function main() {
  const [deployer] = await ethers.getSigners();
  const naffitiTokenAddress = NAFFITI[network.name];

  const TokenEscrow = await ethers.getContractFactory("TokenEscrow", deployer);
  const tokenEscrow = await upgrades.deployProxy(
    TokenEscrow,
    [
      naffitiTokenAddress
    ],
    {
      initializer: "__TokenEscrow_init"
    }
  );
  await tokenEscrow.deployed();
  console.log("Token Escrow contract deployed to:", tokenEscrow.address);

  console.log("All done");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
