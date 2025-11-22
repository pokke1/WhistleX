// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @title IntelPool - escrow contract for funding encrypted intelligence releases
/// @notice Investigators create pools with a funding threshold. Contributors send
/// ether until the pool is unlocked; then investigators can withdraw while
/// eligible contributors can decrypt via TACo.
contract IntelPool {
    address public immutable investigator;
    uint256 public immutable threshold;
    uint256 public immutable minContributionForDecrypt;

    uint256 public totalContributions;
    bool public unlocked;

    mapping(address => uint256) private _contributions;

    event Contributed(address indexed contributor, uint256 amount, uint256 newTotal);
    event Unlocked(uint256 totalRaised);
    event Withdrawn(address indexed investigator, uint256 amount);

    constructor(
        address _investigator,
        uint256 _threshold,
        uint256 _minContributionForDecrypt
    ) {
        require(_investigator != address(0), "investigator required");
        require(_minContributionForDecrypt > 0, "min contribution required");

        investigator = _investigator;
        threshold = _threshold;
        minContributionForDecrypt = _minContributionForDecrypt;
    }

    /// @notice Contribute ETH towards unlocking the intel pool
    function contribute() external payable {
        require(!unlocked, "pool unlocked");
        require(msg.value > 0, "no value");

        _contributions[msg.sender] += msg.value;
        totalContributions += msg.value;

        emit Contributed(msg.sender, msg.value, totalContributions);

        if (!unlocked && totalContributions >= threshold) {
            unlocked = true;
            emit Unlocked(totalContributions);
        }
    }

    /// @notice Investigator withdraws funds once the pool is unlocked
    function withdraw() external {
        require(msg.sender == investigator, "only investigator");
        require(unlocked, "not unlocked");

        uint256 amount = address(this).balance;
        require(amount > 0, "nothing to withdraw");

        (bool success, ) = investigator.call{value: amount}("");
        require(success, "withdraw failed");

        emit Withdrawn(investigator, amount);
    }

    /// @return Returns the contribution amount for an address
    function contributionOf(address contributor) external view returns (uint256) {
        return _contributions[contributor];
    }

    /// @notice TACo helper: whether the pool is unlocked and caller meets contribution floor
    function canDecrypt(address contributor) external view returns (bool) {
        return unlocked && _contributions[contributor] >= minContributionForDecrypt;
    }
}
