import { ethers, network } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import {NAFFITI, uint256Max} from "./constant";
import { Duration } from "luxon";

import { expandTo18Decimals } from "../test/utilities";

async function main() {
  const [deployer] = await ethers.getSigners();
  const naffitiTokenAddress = NAFFITI[network.name];

  // Pool configs
  const startBlock: number = 13989754;
  const migrationBlock: number = 13989755;
  const endBlock: BigNumber = uint256Max;
  const rewardPerBlock: BigNumber = expandTo18Decimals(9000000);

  const StakingPools = await ethers.getContractFactory(
    "StakingPools",
    deployer
  );
  console.log("Using deployer: ", deployer.address);
  const migraterDelay = Math.floor(Duration.fromObject({ days: 7 }).as("seconds"))
  console.log("Migrater Delay: ", migraterDelay)
  const stakingPools = await StakingPools.deploy(
    migraterDelay// _migratorSetterDelay
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
  );
  await txnReceipt.wait();
  console.log("All done");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
