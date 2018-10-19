pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

import "./INXCrowdsale.sol";

/**
 * @title INXEscrow to be used to take contributions an lock in rates to be redeemed in the crowdsale
 */
contract INXTokenEscrow is Pausable {
    using SafeMath for uint256;

    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal weiBalances;

    INXCrowdsale crowdsale;

    // Amount of wei committed
    uint256 public weiCommitted;

    /**
     * Event for token commitment logging
     * @param sender who paid for the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokenCommitment(
        address indexed sender,
        uint256 value,
        uint256 rate,
        uint256 amount
    );

    constructor(INXCrowdsale _crowdsale) public  {
        crowdsale = _crowdsale;
    }

    /**
     * @dev fallback function ***DO NOT OVERRIDE***
     */
    function() external payable {
        commitToBuyTokens();
    }

    /**
     * @dev captures a commitment to buy tokens at a fixed rate
     */
    function commitToBuyTokens() public payable whenNotPaused {

        uint256 weiAmount = msg.value;
        uint256 minContribution = crowdsale.minContribution();
        require(weiAmount >= minContribution, "Commitment value below minimum");

        // pull the current rate from the crowdsale
        uint256 rate = crowdsale.rate();

        // calculate token amount to be committed
        uint256 tokens = weiAmount.mul(rate);

        // update weiCommitted total
        weiCommitted = weiCommitted.add(weiAmount);

        tokenBalances[msg.sender] = tokenBalances[msg.sender].add(tokens);
        weiBalances[msg.sender] = weiBalances[msg.sender].add(weiAmount);

        emit TokenCommitment(
            msg.sender,
            weiAmount,
            rate,
            tokens
        );
    }

    /**
    * @dev Gets the token balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function tokenBalanceOf(address _owner) public view returns (uint256) {
        return tokenBalances[_owner];
    }

    /**
    * @dev Gets the wei balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function weiBalanceOf(address _owner) public view returns (uint256) {
        return weiBalances[_owner];
    }
}
