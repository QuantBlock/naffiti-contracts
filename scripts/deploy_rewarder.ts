import { ethers, network } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import {NAFFITI, REWARD_DISPATCHER, STAKING_POOLS, uint256Max} from "./constant";
import { Duration } from "luxon";

import { expandTo18Decimals } from "../test/utilities";

async function main() {
  const [deployer] = await ethers.getSigners();

  const DirectPayoutRewarder = await ethers.getContractFactory(
      "DirectPayoutRewarder",
      deployer
  );

  console.log("Using deployer: ", deployer.address);

  const stakingpoolAddress = STAKING_POOLS[network.name];
  const naffitiTokenAddress = NAFFITI[network.name];
  const rewardDispatcherAddress = REWARD_DISPATCHER[network.name];

  console.log("Deploying directPayoutRewarder");

  const directPayoutRewarder = await DirectPayoutRewarder.deploy(
      stakingpoolAddress,
      naffitiTokenAddress,
      rewardDispatcherAddress
  );
  await directPayoutRewarder.deployed();


  const directPayoutRewarderAddress = directPayoutRewarder.address;
  const StakingPools = await ethers.getContractFactory(
    "StakingPools",
    deployer
  );

  const stakingPools = StakingPools.attach(stakingpoolAddress);

  console.log("StakingPools at %s is setting rewarder to %s", stakingpoolAddress, directPayoutRewarderAddress);
  const setRewarderTx = await stakingPools.setRewarder(directPayoutRewarderAddress);
  await setRewarderTx.wait();

  console.log("All Done");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
