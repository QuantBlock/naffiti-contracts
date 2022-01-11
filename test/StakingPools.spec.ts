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
    bob: SignerWithAddress,
    charlie: SignerWithAddress,
    david: SignerWithAddress;

  const migratorSetterDelay: Duration = Duration.fromObject({
    hours: 1,
  });

  const poolAId: number = 1;
  const poolBId: number = 2;

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
    [deployer, alice, bob, charlie, david] = await ethers.getSigners();

    const NAOToken = await ethers.getContractFactory(
      "NAOToken"
    );
    const StakingPools = await ethers.getContractFactory("StakingPools");
    const MockStakingPoolMigrator = await ethers.getContractFactory(
      "MockStakingPoolMigrator"
    );
    const MockStakingPoolRewarder = await ethers.getContractFactory(
      "MockStakingPoolRewarder"
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
    rewarder = await MockStakingPoolRewarder.deploy();

    await stakingPools.connect(deployer).setRewarder(rewarder.address);

    // Everyone gets 1000 of both tokens
    for (const user of [alice, bob, charlie, david]) {
      for (const token of [tokenA, tokenB]) {
        await token.connect(deployer).transfer(
          user.address, // recipient
          expandTo18Decimals(1_000) // amount
        );
        await token.connect(user).approve(
          stakingPools.address, // spender
          uint256Max // amount
        );
      }
    }

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

  it("pool info should be set correctly", async function () {
    expect((await stakingPools.poolInfos(poolAId)).startBlock).to.equal(
      poolAStartBlock
    );
    expect((await stakingPools.poolInfos(poolAId)).endBlock).to.equal(
      poolAEndBlock
    );
    expect((await stakingPools.poolInfos(poolAId)).migrationBlock).to.equal(
      poolAMigrationBlock
    );
  });

  it("cannot stake before start block", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock - 1);
    await expect(
      stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1))
    ).to.be.revertedWith("StakingPools: pool not active");
  });

  it("can stake after start block", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));
  });

  it("cannot stake after end block", async function () {
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await expect(
      stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1))
    ).to.be.revertedWith("StakingPools: pool not active");
  });

  it("can unstake after end block", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(1));
  });

  it("staking should emit Staked event", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await expect(
      stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1))
    )
      .to.emit(stakingPools, "Staked")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        tokenA.address, // token
        expandTo18Decimals(1) // amount
      );
  });

  it("unstaking should emit Unstaked event", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    await expect(
      stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(0.3))
    )
      .to.emit(stakingPools, "Unstaked")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        tokenA.address, // token
        expandTo18Decimals(0.3) // amount
      );
  });

  it("cannot unstake when staked amount is zero", async function () {
    // Cannot unstake without staking first
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await expect(
      stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(1))
    ).to.be.revertedWith("SafeMath: subtraction overflow");

    // Cannot unstake once all of the staked amount has been unstaked
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));
    await stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(1));
    await expect(
      stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(1))
    ).to.be.revertedWith("SafeMath: subtraction overflow");
  });

  it("cannot unstake more than staked amount", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));
    await expect(
      stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(2))
    ).to.be.revertedWith("SafeMath: subtraction overflow");
  });

  it("token should be transferred on stake", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await expect(
      stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1))
    )
      .to.emit(tokenA, "Transfer")
      .withArgs(
        alice.address, // from
        stakingPools.address, // to
        expandTo18Decimals(1) // amount
      );

    expect(await tokenA.balanceOf(alice.address)).to.equal(
      expandTo18Decimals(999)
    );
    expect(await tokenA.balanceOf(stakingPools.address)).to.equal(
      expandTo18Decimals(1)
    );
  });

  it("token should be transferred on unstake", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    await expect(
      stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(0.3))
    )
      .to.emit(tokenA, "Transfer")
      .withArgs(
        stakingPools.address, // from
        alice.address, // to
        expandTo18Decimals(0.3) // amount
      );

    expect(await tokenA.balanceOf(alice.address)).to.equal(
      expandTo18Decimals(999.3)
    );
    expect(await tokenA.balanceOf(stakingPools.address)).to.equal(
      expandTo18Decimals(0.7)
    );
  });

  it("PoolData.totalStakeAmount should track total staked amount", async function () {
    expect((await stakingPools.poolData(poolAId)).totalStakeAmount).to.equal(0);

    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));
    expect((await stakingPools.poolData(poolAId)).totalStakeAmount).to.equal(
      expandTo18Decimals(1)
    );

    await stakingPools.connect(bob).stake(poolAId, expandTo18Decimals(3));
    expect((await stakingPools.poolData(poolAId)).totalStakeAmount).to.equal(
      expandTo18Decimals(4)
    );

    await stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(0.1));
    expect((await stakingPools.poolData(poolAId)).totalStakeAmount).to.equal(
      expandTo18Decimals(3.9)
    );
  });

  it("UserData.stakeAmount should track user staked amount", async function () {
    expect(
      (await stakingPools.userData(poolAId, alice.address)).stakeAmount
    ).to.equal(0);
    expect(
      (await stakingPools.userData(poolAId, bob.address)).stakeAmount
    ).to.equal(0);

    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));
    expect(
      (await stakingPools.userData(poolAId, alice.address)).stakeAmount
    ).to.equal(expandTo18Decimals(1));
    expect(
      (await stakingPools.userData(poolAId, bob.address)).stakeAmount
    ).to.equal(0);

    await stakingPools.connect(bob).stake(poolAId, expandTo18Decimals(3));
    expect(
      (await stakingPools.userData(poolAId, alice.address)).stakeAmount
    ).to.equal(expandTo18Decimals(1));
    expect(
      (await stakingPools.userData(poolAId, bob.address)).stakeAmount
    ).to.equal(expandTo18Decimals(3));

    await stakingPools.connect(alice).unstake(poolAId, expandTo18Decimals(0.1));
    expect(
      (await stakingPools.userData(poolAId, alice.address)).stakeAmount
    ).to.equal(expandTo18Decimals(0.9));
    expect(
      (await stakingPools.userData(poolAId, bob.address)).stakeAmount
    ).to.equal(expandTo18Decimals(3));
  });

  it("one staker should earn all rewards", async function () {
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

    // Reward is capped at endBlock
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(1500)
    );
  });

  it("proportional reward distribution for multiple stakers", async function () {
    // Alice stakes at start block
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // // Bob stakes 5 blocks after
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(bob).stake(poolAId, expandTo18Decimals(9));

    // Bob has accurred any reward just yet
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(500)
    );
    await assertStakerRewardEqual(poolAId, bob.address, BigNumber.from(0));

    // After 5 blocks, Bob unstakes such that his share is the same as Alice's
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 10);
    await stakingPools.connect(bob).unstake(poolAId, expandTo18Decimals(8));

    // Bob takes 90% of reward for the past week
    //
    // Alice: 500 + 5 * 100 * 0.1 = 550
    // Bob: 5 * 100 * 0.9 = 450
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(550)
    );
    await assertStakerRewardEqual(
      poolAId,
      bob.address,
      expandTo18Decimals(450)
    );

    // After 5 blocks, Bob unstakes everything such that Alice will earn all remaining rewards
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 15);
    await stakingPools.connect(bob).unstake(poolAId, expandTo18Decimals(1));

    // Alice and Bob both take half of the reward from the past week
    //
    // Alice: 550 + 5 * 100 * 0.5 = 800
    // Bob: 450 + 5 * 100 * 0.5 = 700
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(800)
    );
    await assertStakerRewardEqual(
      poolAId,
      bob.address,
      expandTo18Decimals(700)
    );

    // Alice takes all reward from the final week
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 20);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(1300)
    );
    await assertStakerRewardEqual(
      poolAId,
      bob.address,
      expandTo18Decimals(700)
    );

    // No more reward accumulation after endBlock
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 30);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(1300)
    );
    await assertStakerRewardEqual(
      poolAId,
      bob.address,
      expandTo18Decimals(700)
    );
  });

  it("unable to stake if pool does not exist", async function () {
    await expect(
      stakingPools.connect(alice).stake(poolBId, expandTo18Decimals(1))
    ).to.be.revertedWith("StakingPools: pool not found");
  });

  it("user receives no reward after emergency unstake", async function () {
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

    // Emergency unstake will unstake all amount
    await expect(stakingPools.connect(alice).emergencyUnstake(poolAId))
      .to.emit(tokenA, "Transfer")
      .withArgs(
        stakingPools.address, // from
        alice.address, // to
        expandTo18Decimals(1) // amount
      );
    // Alice lose all reward if she emergency unstake
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(0)
    );
    expect(
      (await stakingPools.userData(poolAId, alice.address)).stakeAmount
    ).to.equal(0);
    expect(await tokenA.balanceOf(alice.address)).to.equal(
      expandTo18Decimals(1000)
    );
  });

  it("able to extend end block before pool's end block", async function () {
    // Extend the end block to poolAEndBlock + 10 blocks
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools
      .connect(deployer)
      .extendEndBlock(poolAId, poolAEndBlock + 10);

    // Alice is still able to stake right fter the original end block
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await expect(
      stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1))
    )
      .to.emit(stakingPools, "Staked")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        tokenA.address, // token
        expandTo18Decimals(1) // amount
      );

    // Alice is not able to stake right after the new end block (poolAEndBlock + 10 blocks)
    await setNextBlockNumber(ethers.provider, poolAEndBlock + 10);
    await expect(
      stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1))
    ).to.be.revertedWith("StakingPools: pool not active");
  });

  it("unable to extend end block after pool's end block", async function () {
    // Extend the end block by 1 blocks after end block
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await expect(
      stakingPools.connect(deployer).extendEndBlock(poolAId, poolAEndBlock + 1)
    ).to.be.revertedWith("StakingPools: pool ended");
  });

  it("unable to set end block to a smaller block number", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 10);
    await expect(
      stakingPools.connect(deployer).extendEndBlock(poolAId, poolAEndBlock - 1)
    ).to.be.revertedWith("StakingPools: end block not extended");
  });

  it("only owner can extend end block", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await expect(
      stakingPools.connect(alice).extendEndBlock(poolAId, poolAEndBlock + 10)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("able to migrate pool after pool's migration block", async function () {
    // Propose a migrator
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools
      .connect(deployer)
      .proposeMigratorChange(migrator.address);
    const currentBlockDateTime = await getBlockDateTime(ethers.provider);
    await mineBlock(
      ethers.provider,
      currentBlockDateTime.plus(migratorSetterDelay)
    );
    await stakingPools.connect(deployer).executeMigratorChange();

    // Execute a pool migration
    await setNextBlockNumber(ethers.provider, poolAMigrationBlock);
    const oldTokenAddr = (await stakingPools.poolInfos(poolAId)).poolToken;
    await expect(stakingPools.connect(deployer).migratePool(poolAId)).to.emit(
      stakingPools,
      "PoolMigrated"
    );
    expect((await stakingPools.poolInfos(poolAId)).poolToken).to.be
      .properAddress;
    expect((await stakingPools.poolInfos(poolAId)).poolToken).to.not.equal(
      oldTokenAddr
    );
  });

  it("unable to migrate pool before pool's migration block", async function () {
    // Propose a migrator
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools
      .connect(deployer)
      .proposeMigratorChange(migrator.address);
    const currentBlockDateTime = await getBlockDateTime(ethers.provider);
    await mineBlock(
      ethers.provider,
      currentBlockDateTime.plus(migratorSetterDelay)
    );
    await stakingPools.connect(deployer).executeMigratorChange();

    // Execute a pool migration
    await setNextBlockNumber(ethers.provider, poolAMigrationBlock - 1);
    await expect(
      stakingPools.connect(deployer).migratePool(poolAId)
    ).to.be.revertedWith("StakingPools: migration block not reached");
  });

  it("unable to migrate pool without a migrator", async function () {
    await setNextBlockNumber(ethers.provider, poolAMigrationBlock);
    await mineBlock(ethers.provider);
    await expect(
      stakingPools.connect(deployer).migratePool(poolAId)
    ).to.be.revertedWith("StakingPools: migrator not set");
  });

  it("unable to execute a migrator change before the set migrator delay", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools
      .connect(deployer)
      .proposeMigratorChange(migrator.address);
    await expect(
      stakingPools.connect(deployer).executeMigratorChange()
    ).to.be.revertedWith("StakingPools: migrator setter delay not passed");
  });

  it("unable to execute a migrator change without a new migrator", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    const currentBlockDateTime = await getBlockDateTime(ethers.provider);
    await mineBlock(
      ethers.provider,
      currentBlockDateTime.plus(migratorSetterDelay)
    );
    await expect(
      stakingPools.connect(deployer).executeMigratorChange()
    ).to.be.revertedWith("StakingPools: migrator change proposal not found");
  });

  it("able to extend migration block before pool's end block", async function () {
    // Extend the migration block by 5 blocks
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await stakingPools
      .connect(deployer)
      .extendMigrationBlock(poolAId, poolAMigrationBlock + 5);

    // Propose a migrator
    await stakingPools
      .connect(deployer)
      .proposeMigratorChange(migrator.address);
    const currentBlockDateTime = await getBlockDateTime(ethers.provider);
    await mineBlock(
      ethers.provider,
      currentBlockDateTime.plus(migratorSetterDelay)
    );
    await stakingPools.connect(deployer).executeMigratorChange();

    // Execute a pool migration but fail because the migration block is extended
    await setNextBlockNumber(ethers.provider, poolAMigrationBlock + 4);
    await expect(
      stakingPools.connect(deployer).migratePool(poolAId)
    ).to.be.revertedWith("StakingPools: migration block not reached");

    // Execute a pool migration after 5 more block
    await setNextBlockNumber(ethers.provider, poolAMigrationBlock + 5);
    await mineBlock(ethers.provider);
    await expect(stakingPools.connect(deployer).migratePool(poolAId)).to.emit(
      stakingPools,
      "PoolMigrated"
    );
  });

  it("unable to set the migration block to a smaller block value", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await expect(
      stakingPools
        .connect(deployer)
        .extendMigrationBlock(poolAId, poolAMigrationBlock - 1)
    ).to.be.revertedWith("StakingPools: migration block not extended");
  });

  it("unable to extend migration block after pool has ended", async function () {
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await expect(
      stakingPools
        .connect(deployer)
        .extendMigrationBlock(poolAId, poolAEndBlock + 5)
    ).to.be.revertedWith("StakingPools: pool ended");
  });

  it("only owner is able to extend a migration block", async function () {
    await setNextBlockNumber(ethers.provider, poolAStartBlock);
    await expect(
      stakingPools
        .connect(alice)
        .extendMigrationBlock(poolAId, poolAMigrationBlock + 5)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("no rewards if user has no acc reward", async function () {
    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // Alice emergency unstake after 1 block
    await mineBlock(ethers.provider);
    await stakingPools.connect(alice).emergencyUnstake(poolAId);

    // The immediate reward amount is zero
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
    // She cannot claim any reward because she does not have any acc reward
    await expect(
      stakingPools.connect(alice).redeemRewards(poolAId)
    ).to.be.revertedWith("StakingPools: no reward to redeem");
  });

  it("user can redeem reward if user has acc reward", async function () {
    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // The immediate reward amount is zero
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
    // After 5 block, Alice should have 500 reward
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 10);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(500)
    );

    // Alice can claim 600 reward bcos an additional block is minned
    await expect(stakingPools.connect(alice).redeemRewards(poolAId))
      .to.emit(stakingPools, "RewardRedeemed")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        rewarder.address, // rewarder address
        expandTo18Decimals(600) // amount
      )
      .to.emit(rewarder, "OnRewardRedeemded")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        expandTo18Decimals(600) // amount
      );
    // No acc reward after claiming reward
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
  });

  it("cannot help user redeem reward if user has no acc reward", async function () {
    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // Alice emergency unstake after 1 block
    await mineBlock(ethers.provider);
    await stakingPools.connect(alice).emergencyUnstake(poolAId);

    // The immediate reward amount is zero
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
    // She cannot claim any reward because she does not have any acc reward
    await expect(
      stakingPools.connect(bob).redeemRewardsByAddress(poolAId, alice.address)
    ).to.be.revertedWith("StakingPools: no reward to redeem");
  });

  it("help user redeem reward if user has acc reward", async function () {
    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // The immediate reward amount is zero
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
    // After 5 block, Alice should have 500 reward
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 10);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(500)
    );

    // Alice can claim 600 reward bcos an additional block is minned
    await expect(
      stakingPools.connect(bob).redeemRewardsByAddress(poolAId, alice.address)
    )
      .to.emit(stakingPools, "RewardRedeemed")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        rewarder.address, // rewarder address
        expandTo18Decimals(600) // amount
      )
      .to.emit(rewarder, "OnRewardRedeemded")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        expandTo18Decimals(600) // amount
      );
    // No acc reward after claiming reward
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
  });

  it("owner can update reward rate", async function () {
    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // Alice should have 100 reward after 1 block
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(100)
    );
    // Owner update reward rate to 30
    await expect(
      stakingPools
        .connect(deployer)
        .setPoolReward(poolAId, expandTo18Decimals(30))
    )
      .to.emit(stakingPools, "PoolRewardRateChanged")
      .withArgs(
        poolAId, // poolId
        expandTo18Decimals(100), // currentRewardPerBlock
        expandTo18Decimals(30) // newRewardPerBlock
      );
    // Alice should have additional 130 reward after next block
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(230)
    );
    // Previous reward is settled
    expect((await stakingPools.poolData(poolAId)).accuRewardPerShare).to.equal(
      expandTo18Decimals(20000)
    );
  });

  it("only owner can update reward rate", async function () {
    await expect(
      stakingPools.connect(alice).setPoolReward(poolAId, expandTo18Decimals(30))
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("owner can update reward rate before pool start", async function () {
    //Set pool reward before start
    await expect(
      stakingPools
        .connect(deployer)
        .setPoolReward(poolAId, expandTo18Decimals(30))
    )
      .to.emit(stakingPools, "PoolRewardRateChanged")
      .withArgs(poolAId, expandTo18Decimals(100), expandTo18Decimals(30));

    // Alice stakes 5 blocks after start
    await setNextBlockNumber(ethers.provider, poolAStartBlock + 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // Alice should have 30 reward after 1 block
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(30)
    );
    // Owner update reward rate to 100
    await expect(
      stakingPools
        .connect(deployer)
        .setPoolReward(poolAId, expandTo18Decimals(100))
    )
      .to.emit(stakingPools, "PoolRewardRateChanged")
      .withArgs(
        poolAId, // poolId
        expandTo18Decimals(30), // currentRewardPerBlock
        expandTo18Decimals(100) // newRewardPerBlock
      );
    // Alice should have additional 130 reward after next block
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(160)
    );
    // Previous reward is settled
    expect((await stakingPools.poolData(poolAId)).accuRewardPerShare).to.equal(
      expandTo18Decimals(6000)
    );
  });

  it("no more reward after the pool has ended", async function () {
    // Alice stakes 5 blocks after end
    await setNextBlockNumber(ethers.provider, poolAEndBlock - 5);
    await stakingPools.connect(alice).stake(poolAId, expandTo18Decimals(1));

    // The immediate reward amount is zero
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));

    // After 5 block, Alice should have 500 reward
    await setNextBlockNumber(ethers.provider, poolAEndBlock);
    await mineBlock(ethers.provider);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(500)
    );

    // No additional rewards even more block is processed
    await setNextBlockNumber(ethers.provider, poolAEndBlock + 5);
    await assertStakerRewardEqual(
      poolAId,
      alice.address,
      expandTo18Decimals(500)
    );

    // Alice can claim 500 reward bcos an additional block is minned
    await expect(stakingPools.connect(alice).redeemRewards(poolAId))
      .to.emit(stakingPools, "RewardRedeemed")
      .withArgs(
        poolAId, // poolId
        alice.address, // staker
        rewarder.address, // rewarder address
        expandTo18Decimals(500) // amount
      );
    // No acc reward after claiming reward
    await assertStakerRewardEqual(poolAId, alice.address, BigNumber.from(0));
  });
});
