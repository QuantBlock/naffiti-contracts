// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStakingPoolMigrator.sol";
import "./MockERC20.sol";

/**
 * @title MockStakingPoolMigrator
 *
 * @dev A mock migrator contract for testing the migration functionality for the staking
 * contract.
 */
contract MockStakingPoolMigrator is IStakingPoolMigrator {
    function migrate(
        uint256 poolId,
        address oldToken,
        uint256 amount
    ) external override returns (address) {
        // Take old tokens from staking contract
        IERC20(oldToken).transferFrom(msg.sender, address(this), amount);

        // Create a fake token and mint to the staking contract
        MockERC20 fakeToken = new MockERC20(msg.sender, amount);

        return address(fakeToken);
    }
}
