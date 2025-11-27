// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./IntelPool.sol";

/// @title IntelPoolFactory - deploys IntelPool instances for investigators
contract IntelPoolFactory {
    address[] public allPools;

    event PoolCreated(
        address indexed investigator,
        address pool,
        uint256 threshold,
        uint256 minContributionForDecrypt,
        uint256 deadline,
        bytes ciphertext
    );

    function createPool(
        uint256 threshold,
        uint256 minContributionForDecrypt,
        uint256 deadline,
        bytes calldata ciphertext
    ) external returns (address pool) {
        pool = address(new IntelPool(msg.sender, threshold, minContributionForDecrypt, deadline, ciphertext));
        allPools.push(pool);

        emit PoolCreated(msg.sender, pool, threshold, minContributionForDecrypt, deadline, ciphertext);
    }

    function poolsCount() external view returns (uint256) {
        return allPools.length;
    }
}
