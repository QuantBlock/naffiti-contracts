// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title NaffitiToken
 *
 * @dev A minimal ERC20 token contract for the Naffiti token.
 */
contract NaffitiToken is ERC20("Naffiti", "NAFF") {
    uint256 private constant TOTAL_SUPPLY = 1000000000e18;

    constructor(address genesis_holder) {
        require(genesis_holder != address(0), "NaffitiToken: zero address");
        _mint(genesis_holder, TOTAL_SUPPLY);
    }
}
