// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @title IntelPool - escrow contract for funding encrypted intelligence releases
/// @notice Investigators create pools with a funding threshold denominated in an ERC20 currency.
contract IntelPool {
    IERC20 public immutable currency;
    uint8 public immutable currencyDecimals;
    address public immutable investigator;
    uint256 public immutable threshold;
    uint256 public immutable minContributionForDecrypt;
    uint256 public immutable deadline;

    bytes public ciphertext;

    uint256 public totalContributions;
    bool public unlocked;

    mapping(address => uint256) private _contributions;

    event Contributed(address indexed contributor, uint256 amount, uint256 newTotal);
    event Unlocked(uint256 totalRaised);
    event Withdrawn(address indexed investigator, uint256 amount);
    event Refunded(address indexed contributor, uint256 amount);

    constructor(
        address _currency,
        address _investigator,
        uint256 _threshold,
        uint256 _minContributionForDecrypt,
        uint256 _deadline,
        bytes memory _ciphertext
    ) {
        require(_currency != address(0), "currency required");
        require(_investigator != address(0), "investigator required");
        require(_minContributionForDecrypt > 0, "min contribution required");
        require(_deadline > block.timestamp, "deadline required");
        require(_ciphertext.length > 0, "ciphertext required");

        currency = IERC20(_currency);
        currencyDecimals = currency.decimals();
        investigator = _investigator;
        threshold = _threshold;
        minContributionForDecrypt = _minContributionForDecrypt;
        deadline = _deadline;
        ciphertext = _ciphertext;
    }

    /// @notice Contribute ERC20 currency towards unlocking the intel pool
    function contribute(uint256 amount) external {
        require(!unlocked, "pool unlocked");
        require(amount > 0, "no value");
        require(block.timestamp <= deadline, "past deadline");

        bool ok = currency.transferFrom(msg.sender, address(this), amount);
        require(ok, "transfer failed");

        _contributions[msg.sender] += amount;
        totalContributions += amount;

        emit Contributed(msg.sender, amount, totalContributions);

        if (!unlocked && totalContributions >= threshold) {
            unlocked = true;
            emit Unlocked(totalContributions);
        }
    }

    /// @notice Investigator withdraws funds once the pool is unlocked
    function withdraw() external {
        require(msg.sender == investigator, "only investigator");
        require(unlocked, "not unlocked");

        uint256 amount = currency.balanceOf(address(this));
        require(amount > 0, "nothing to withdraw");

        bool success = currency.transfer(investigator, amount);
        require(success, "withdraw failed");

        emit Withdrawn(investigator, amount);
    }

    /// @notice Contributors can reclaim funds if the threshold is not met after the deadline.
    function refund() external {
        require(!unlocked, "pool unlocked");
        require(block.timestamp > deadline, "deadline not met");

        uint256 amount = _contributions[msg.sender];
        require(amount > 0, "nothing to refund");

        _contributions[msg.sender] = 0;
        totalContributions -= amount;

        bool success = currency.transfer(msg.sender, amount);
        require(success, "refund failed");

        emit Refunded(msg.sender, amount);
    }

    /// @return Returns the contribution amount for an address
    function contributionOf(address contributor) external view returns (uint256) {
        return _contributions[contributor];
    }

    /// @notice TACo helper: whether the pool is unlocked and caller meets contribution floor
    function canDecrypt(address contributor) external view returns (bool) {
        return unlocked && _contributions[contributor] >= minContributionForDecrypt;
    }

    /// @notice Helper: whether a contributor can claim a refund.
    function canRefund(address contributor) external view returns (bool) {
        return !unlocked && block.timestamp > deadline && _contributions[contributor] > 0;
    }

    /// @notice TACo helper: whether the pool is unlocked
    function isUnlocked() external view returns (bool) {
        return unlocked;
    }
}
