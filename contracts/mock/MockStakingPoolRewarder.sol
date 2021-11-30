// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../interfaces/IStakingPoolRewarder.sol";

/**
 * @title MockStakingPoolRewarder
 *
 * @dev A mock rewarder contract for testing the redeem reward function for the staking
 * contract.
 */
contract MockStakingPoolRewarder is IStakingPoolRewarder {
    event OnRewardRedeemded(uint256 indexed poolId, address user, uint256 amount);

    function onReward(
        uint256 poolId,
        address user,
        uint256 amount
    ) external override {
        // For test only
        emit OnRewardRedeemded(poolId, user, amount);
    }
}
