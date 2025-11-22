// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./IntelPool.sol";

/// @title IntelPoolFactory - deploys IntelPool instances for investigators
contract IntelPoolFactory {
    address[] public allPools;

    event PoolCreated(address indexed investigator, address pool, uint256 threshold, uint256 minContributionForDecrypt);

    function createPool(uint256 threshold, uint256 minContributionForDecrypt) external returns (address pool) {
        pool = address(new IntelPool(msg.sender, threshold, minContributionForDecrypt));
        allPools.push(pool);

        emit PoolCreated(msg.sender, pool, threshold, minContributionForDecrypt);
    }

    function poolsCount() external view returns (uint256) {
        return allPools.length;
    }
}
