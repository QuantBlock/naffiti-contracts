// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title NAOToken
 *
 * @dev A minimal ERC20 token contract for the NAO token.
 */
contract NAOToken is ERC20("NFTDAO", "NAO") {
    uint256 private constant TOTAL_SUPPLY = 100000000000000e18;

    constructor(address genesis_holder) {
        require(genesis_holder != address(0), "NAOToken: zero address");
        _mint(genesis_holder, TOTAL_SUPPLY);
    }
}
