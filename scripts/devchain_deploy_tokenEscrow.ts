import { ethers, network } from "hardhat";
import { NAFFITI } from "./constant";

async function main() {
  const [deployer] = await ethers.getSigners();
  const naffitiTokenAddress = NAFFITI[network.name];

  const TokenEscrow = await ethers.getContractFactory("TokenEscrow", deployer);
  const tokenEscrow = await TokenEscrow.deploy();
  await tokenEscrow.deployed();
  await tokenEscrow.__TokenEscrow_init(naffitiTokenAddress);
  console.log("Token Escrow contract deployed to:", tokenEscrow.address);

  console.log("All done");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
