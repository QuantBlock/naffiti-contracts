import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect, use } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import { Duration } from "luxon";
import { expandTo18Decimals, uint256Max } from "./utilities";
import {
  getBlockDateTime,
  mineBlock,
  setNextBlockNumber,
} from "./utilities/timeTravel";

use(waffle.solidity);

describe("StakingPools", function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    rewardDispatcher: SignerWithAddress

  const migratorSetterDelay: Duration = Duration.fromObject({
    hours: 1,
  });

  const poolAId: number = 1;

  let tokenA: Contract,
    tokenB: Contract,
    stakingPools: Contract,
    migrator: Contract,
    rewarder: Contract;

  let poolAStartBlock: number,
    poolAEndBlock: number,
    poolAMigrationBlock: number;

  const assertStakerRewardEqual = async (
    poolId: number | BigNumber,
    staker: string,
    reward: BigNumber
  ) => {
    expect(await stakingPools.getReward(poolId, staker)).to.equal(reward);
  };

  beforeEach(async function () {
    [deployer, alice, rewardDispatcher] = await ethers.getSigners();

    const NAOToken = await ethers.getContractFactory(
      "NAOToken"
    );
    const StakingPools = await ethers.getContractFactory("StakingPools");
    const MockStakingPoolMigrator = await ethers.getContractFactory(
      "MockStakingPoolMigrator"
    );
    const DirectPayoutRewarder = await ethers.getContractFactory(
      "DirectPayoutRewarder"
    );

    // Using `NAOToken` contract as ERC20 mock
    tokenA = await NAOToken.deploy(
      deployer.address // genesis_holder
    );
    tokenB = await NAOToken.deploy(
      deployer.address // genesis_holder
    );

    stakingPools = await StakingPools.deploy(
      migratorSetterDelay.as("seconds") // _migratorSetterDelay
    );

    migrator = await MockStakingPoolMigrator.deploy();

    rewarder = await DirectPayoutRewarder.deploy(
        stakingPools.address,
        tokenB.address,
        rewardDispatcher.address
    );

    await stakingPools.connect(deployer).setRewarder(rewarder.address);

    // Alice gets 1000 of tokens A to stake
    await tokenA.connect(deployer).transfer(
        alice.address, // recipient
        expandTo18Decimals(1_000) // amount
    );
    await tokenA.connect(alice).approve(
        stakingPools.address, // spender
        uint256Max // amount
    );

    // Reward dispatcher gets 1000 of tokens B to reward
    await tokenB.connect(deployer).transfer(
        rewardDispatcher.address, // recipient
        expandTo18Decimals(2_000) // amount
    );
    await tokenB.connect(rewardDispatcher).approve(
        rewarder.address, // spender
        uint256Max // amount
    );

    const currentBlockNumber: number = await ethers.provider.getBlockNumber();
    poolAStartBlock = currentBlockNumber + 10;
    poolAEndBlock = currentBlockNumber + 30;
    poolAMigrationBlock = currentBlockNumber + 20;

    // Create token A pool: 20 blocks with 100 reward per block
    await stakingPools.connect(deployer).createPool(
      tokenA.address, // token
      poolAStartBlock, // startBlock
      poolAEndBlock, // endBlock
      poolAMigrationBlock, // migrationBlock
      expandTo18Decimals(100) // rewardPerBlock
    );
  });

  it("All reward are payout upon claim", async function () {
    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // The immediate reward amount is zero
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
    // Should earn 5 blocks of reward after 5 blocks
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 10);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(500)
    );

    expect(await tokenB.balanceOf(alice.address)).to.equal( expandTo18Decimals(0));
    await stakingPools.connect(alice).redeemRewards(poolAId);
    // one more block has passed
    expect(await tokenB.balanceOf(alice.address)).to.equal( expandTo18Decimals(600));

    // Reward is capped at endBlock
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(900)
    );
    await stakingPools.connect(alice).redeemRewards(poolAId);
    expect(await tokenB.balanceOf(alice.address)).to.equal( expandTo18Decimals(1500));

  });

});
