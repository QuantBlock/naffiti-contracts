import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const NAOToken = await ethers.getContractFactory("NAOToken", deployer);
  const naoToken = await NAOToken.deploy(deployer.address);
  console.log("NAO Token is deployed to: ", naoToken.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
