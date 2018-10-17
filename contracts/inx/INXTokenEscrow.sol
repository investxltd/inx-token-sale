pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

/**
 * @title INXEscrow to be used to take contributions an lock in rates to be redeemed in the crowdsale
 */
contract INXTokenEscrow is Pausable {
    using SafeMath for uint256;

    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal weiBalances;

    // How many token units a buyer gets per wei.
    // The rate is the conversion between wei and the smallest and indivisible token unit.
    uint256 public rate;

    // Amount of wei raised
    uint256 public weiRaised;

    // minimum contribution in wei - this can change
    uint256 public minContribution = 0.2 ether;

    /**
     * Event for token commitment logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokenCommitment(
        address indexed purchaser,
        address indexed beneficiary,
        uint256 value,
        uint256 rate,
        uint256 amount
    );

    constructor(uint256 _rate) public  {
        rate = _rate;
        require(_rate > 0, "Rate must not be zero");
    }

    /**
     * @dev fallback function ***DO NOT OVERRIDE***
     */
    function() external payable {
        commitToBuyTokens(msg.sender);
    }

    /**
     * @dev captures a commitment to buy tokens at a fixed rate
     * @param _beneficiary Address performing the token purchase
     */
    function commitToBuyTokens(address _beneficiary) public payable whenNotPaused {

        uint256 weiAmount = msg.value;

        // calculate token amount to be created
        uint256 tokens = _getTokenAmount(weiAmount);

        // update state
        weiRaised = weiRaised.add(weiAmount);

        tokenBalances[_beneficiary] = tokenBalances[_beneficiary].add(tokens);
        weiBalances[_beneficiary] = weiBalances[_beneficiary].add(weiAmount);

        emit TokenCommitment(
            msg.sender,
            _beneficiary,
            weiAmount,
            rate,
            tokens
        );
    }

    /**
     * @param _weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
        return _weiAmount.mul(rate);
    }

    /**
     * @dev Owner can set rate during the crowdsale
     * @param _rate rate used to calculate tokens per wei
     */
    function setRate(uint256 _rate) external onlyOwner {
        require(_rate > 0, "Rate must not be zero");

        rate = _rate;
    }

    /**
     * @dev Owner can set the minimum contribution. This will change from pre-sale to public.
     * @param _minContribution amount of min contribution
     */
    function setMinContribution(uint256 _minContribution) external onlyOwner {
        require(_minContribution > 0, "Minimum contribution must not be zero");

        minContribution = _minContribution;
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
