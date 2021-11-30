// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20("Mock", "MOCK") {
    constructor(address genesis_holder, uint256 supply) {
        _mint(genesis_holder, supply);
    }
}
