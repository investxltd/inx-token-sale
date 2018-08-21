pragma solidity ^0.4.24;

import "./INXToken.sol";
import "./MintedKYCCrowdsale.sol";


/**
 * @title INXCrowdsale to be used in the Investx crowdsale event
 */
contract INXCrowdsale is MintedKYCCrowdsale {

  mapping(address => uint256) public contributions;

  // FIXME arbitrarily set to one minute until until we know when to open
  uint256 public openingTime = now.add(30 minutes);

  // FIXME arbitrarily set to until we know when to close
  uint256 public closingTime = openingTime.add(8 days);

  // minimum contribution in wei - this can change
  uint256 public minContribution = 0.2 ether;

  // if true, then we are in the pre-sale phase
  bool public inPreSale = true;

  // How many token units a buyer gets per wei (during pre-sale)
  uint256 public preSaleRate;

  constructor(address _wallet, INXToken _token, uint256 _rate, uint256 _preSaleRate) public Crowdsale(_rate, _wallet, _token) {
    require(_preSaleRate > 0);

    preSaleRate = _preSaleRate;
  }

  /**
   * @dev Owner can set rate during the crowdsale
   * @param _rate rate used to calculate tokens per wei
   */
  function setRate(uint256 _rate) onlyOwner public {
    require(_rate > 0);

    rate = _rate;
  }

  /**
   * @dev Owner can set pre-sale rate during the crowdsale
   * @param _preSaleRate rate used to calculate tokens per wei in pre-sale
   */
  function setPreSaleRate(uint256 _preSaleRate) onlyOwner public {
    require(_preSaleRate > 0);

    preSaleRate = _preSaleRate;
  }

  /**
   * @dev Owner can set the closing time for the crowdsale
   * @param _closingTime timestamp for the close
   */
  function setClosingTime(uint256 _closingTime) onlyOwner public {
    require(_closingTime > openingTime);

    closingTime = _closingTime;
  }

  /**
   * @dev Owner can set the minimum contribution. This will change from pre-sale to public.
   * @param _minContribution amount of min contribution
   */
  function setMinContribution(uint256 _minContribution) onlyOwner public {
    require(_minContribution > 0);

    minContribution = _minContribution;
  }

  /**
   * @dev Owner can trigger public sale (moves from pre-sale to public)
   */
  function publicSale() onlyOwner public {
    require(inPreSale);

    inPreSale = false;
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
   * @dev Checks whether the period in which the crowdsale is open has elapsed.
   * @return Whether crowdsale period is open
   */
  function isCrowdsaleOpen() public view returns (bool) {
    return now >= openingTime && now <= closingTime;
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
}
