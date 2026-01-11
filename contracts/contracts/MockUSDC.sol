// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @title MockUSDC - lightweight ERC20 token for testnet usage
/// @notice Mints 1,000,000 tokens (6 decimals) to the deployer for Amoy testing
contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor() {
        uint256 supply = 1_000_000 * (10 ** decimals);
        totalSupply = supply;
        _balances[msg.sender] = supply;
        emit Transfer(address(0), msg.sender, supply);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "allowance exceeded");

        _allowances[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);

        emit Approval(from, msg.sender, _allowances[from][msg.sender]);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero address");
        uint256 balance = _balances[from];
        require(balance >= amount, "insufficient balance");

        _balances[from] = balance - amount;
        _balances[to] += amount;

        emit Transfer(from, to, amount);
    }
}
