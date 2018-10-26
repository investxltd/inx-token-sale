pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./MintedKYCCrowdsale.sol";


/**
 * @title INXTokenSale to be used in the Investx crowdsale event
 */
contract INXTokenSale is MintedKYCCrowdsale {

    mapping(address => uint256) public contributions;

    // FIXME arbitrarily set
    uint256 public openingTime = block.timestamp.add(60 minutes);

    // FIXME arbitrarily set
    uint256 public closingTime = openingTime.add(8 days);

    // minimum contribution in wei - this can change
    uint256 public minContribution = 0.2 ether;

    // if true, then we are in the pre-sale phase
    bool public inPreSale = true;

    // How many token units a buyer gets per wei (during pre-sale)
    uint256 public preSaleRate;

    // escrow
    mapping(address => uint256) internal tokenBalances;
    mapping(address => uint256) internal weiBalances;
    uint256 public totalWeiCommitted;

    /**
   * Event for token commitment logging
   * @param sender who paid for the tokens
   * @param value weis paid for purchase
   * @param rate of INX to wei
   * @param amount amount of tokens purchased
   */
    event TokenCommitment(
        address indexed sender,
        uint256 value,
        uint256 rate,
        uint256 amount
    );

    /**
     * Event for refund of a commitment
     * @param sender who paid for the tokens
     * @param value weis refunded
     * @param amount amount of token balance removed
     */
    event CommitmentRefund(
        address indexed sender,
        uint256 value,
        uint256 amount
    );

    /**
     * Event for successful redemption of a commitment
     * @param sender who paid for the tokens
     * @param value weis refunded
     * @param amount amount of token balance removed
     */
    event CommitmentRedeem(
        address indexed sender,
        uint256 value,
        uint256 amount
    );

    constructor(
        address _wallet,
        ERC20 _token,
        uint256 _rate,
        uint256 _preSaleRate
    ) public Crowdsale(_rate, _wallet, _token) {
        require(_preSaleRate > 0, "Pre-sale rate must not be zero");

        preSaleRate = _preSaleRate;
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
     * @dev Owner can set pre-sale rate during the crowdsale
     * @param _preSaleRate rate used to calculate tokens per wei in pre-sale
     */
    function setPreSaleRate(uint256 _preSaleRate) external onlyOwner {
        require(_preSaleRate > 0, "Pre-sale rate must not be zero");

        preSaleRate = _preSaleRate;
    }

    /**
     * @dev Owner can set the closing time for the crowdsale
     * @param _closingTime timestamp for the close
     */
    function setClosingTime(uint256 _closingTime) external onlyOwner {
        require(_closingTime > openingTime, "Closing time must be after opening time");

        closingTime = _closingTime;
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
     * @dev Owner can trigger public sale (moves from pre-sale to public)
     */
    function publicSale() external onlyOwner {
        require(inPreSale, "Must be in pre-sale to start public sale");

        inPreSale = false;
    }

    /**
     * @dev returns the current rate of the crowdsale
     */
    function getCurrentRate() public view returns (uint256) {
        if (inPreSale) {
            return preSaleRate;
        }

        return rate;
    }

    /**
     * @dev Checks whether the period in which the crowdsale is open has elapsed.
     * @return Whether crowdsale period is open
     */
    function isCrowdsaleOpen() public view returns (bool) {
        return block.timestamp >= openingTime && block.timestamp <= closingTime;
    }

    /**
     * @dev Override to extend the way in which ether is converted to tokens.
     * @param _weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
        if (inPreSale) {
            return _weiAmount.mul(preSaleRate);
        }

        return _weiAmount.mul(rate);
    }

    /**
     * @dev Extend parent behavior to update user contributions so far
     * @param _beneficiary Token purchaser
     * @param _weiAmount Amount of wei contributed
     */
    function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
        super._updatePurchasingState(_beneficiary, _weiAmount);
        contributions[_beneficiary] = contributions[_beneficiary].add(_weiAmount);
    }

    /**
    * @dev Extend parent behavior requiring contract to not be paused.
    * @param _beneficiary Token beneficiary
    * @param _weiAmount Amount of wei contributed
    */
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        super._preValidatePurchase(_beneficiary, _weiAmount);

        require(isCrowdsaleOpen(), "INXCrowdsale not Open");

        require(_weiAmount >= minContribution, "INXCrowdsale contribution below minimum");

        require(!paused, "INXCrowdsale is paused");
    }


    // escrow
    /**
    * @dev Sends a full refund of wei and reset committed tokens to zero
    * @param _sender The address to query the the balance of.
    */
    function sendRefund(address _sender) external onlyOwner returns (bool) {
        uint256 tokenBalance = tokenBalances[_sender];
        delete tokenBalances[_sender];

        uint256 weiCommitted = weiBalances[_sender];
        delete weiBalances[_sender];

        _sender.transfer(weiCommitted);

        emit CommitmentRefund(
            _sender,
            weiCommitted,
            tokenBalance
        );

        return true;
    }

    /**
    * @dev if the _sender has a balance and has been KYC then credits the account with balance
    * @param _sender The address to query the the balance of.
    */
    function redeem(address _sender) external returns (bool) {
        uint256 tokenBalance = tokenBalances[_sender];
        delete tokenBalances[_sender];

        uint256 weiCommitted = weiBalances[_sender];
        delete weiBalances[_sender];

        require(tokenBalance > 0 && weiCommitted > 0, "Balances must be positive");

        require(kyc[_sender], "Sender must have passed KYC");

        wallet.transfer(weiCommitted);

        require(WhitelistedMintableToken(token).mint(_sender, tokenBalance), "Unable to deliver tokens");

        emit CommitmentRedeem(
            _sender,
            weiCommitted,
            tokenBalance
        );

        return true;
    }

    /**
     * @dev captures a commitment to buy tokens at a fixed rate
     */
    function commitToBuyTokens() public payable whenNotPaused {

        uint256 weiAmount = msg.value;
        require(weiAmount >= minContribution, "Commitment value below minimum");

        // pull the current rate from the crowdsale
        uint256 rate = getCurrentRate();

        // calculate token amount to be committed
        uint256 tokens = weiAmount.mul(rate);

        // update weiCommitted total
        totalWeiCommitted = totalWeiCommitted.add(weiAmount);

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
