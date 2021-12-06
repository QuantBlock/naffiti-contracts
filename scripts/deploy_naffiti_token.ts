import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  let addrNounce: number = await ethers.provider.getTransactionCount(
    deployer.address
  );

  const NaffitiToken = await ethers.getContractFactory("NaffitiToken", deployer);
  const naffitiToken = await NaffitiToken.deploy(deployer.address);
  console.log("Naffiti Token is deployed to: ", naffitiToken.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
