import { ethers, network } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { NAFFITI } from "./constant";
import { Duration } from "luxon";

import { expandTo18Decimals } from "../test/utilities";

async function main() {
  const [deployer] = await ethers.getSigners();
  const naffitiTokenAddress = NAFFITI[network.name];

  // Pool configs
  const startBlock: number = 9767000;
  const migrationBlock: number = 12336000;
  const endBlock: number = 12382500;
  const rewardPerBlock: BigNumber = expandTo18Decimals(10);

  const StakingPools = await ethers.getContractFactory(
    "StakingPools",
    deployer
  );
  console.log("Using deployer: ", deployer.address);
  const migraterDelay = Math.floor(Duration.fromObject({ days: 7 }).as("seconds"))
  console.log("Migrater Delay: ", migraterDelay)
  const stakingPools = await StakingPools.deploy(
    migraterDelay// _migratorSetterDelay
    , {
      gasPrice: 1_000_000_000,
      gasLimit: 8_000_000,
    }
  );
  console.log("StakingPools contract deployed to:", stakingPools.address);
  await stakingPools.deployed();

  console.log("Create Naffiti pre-staking pool");
  const txnReceipt = await stakingPools.createPool(
    naffitiTokenAddress, // token
    startBlock, // startBlock
    endBlock, // endBlock
    migrationBlock, // migrationBlock
    rewardPerBlock // rewardPerBlock
  ,{
    gasPrice: 1_000_000_000,
    gasLimit: 8_000_000,
  });
  await txnReceipt.wait();
  console.log("All done");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
