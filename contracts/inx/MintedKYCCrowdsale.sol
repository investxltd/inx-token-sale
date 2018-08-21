pragma solidity ^0.4.24;

import "./WhitelistedMintableToken.sol";
import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

/**
 * @title MintedKYCCrowdsale (adjusted to use WhitelistedMintableToken to deliver tokens)
 * Based on open-zeppelin's WhitelistedCrowdsale adjusted so INX whitelisted addresses can add and remove from KYC list
 * @dev Extension of Crowdsale contract whose tokens are minted in each purchase with whitelisting ability (for purchase).
 * MintedKYCCrowdsale should be on the token's whitelist to enable minting.
 */
contract MintedKYCCrowdsale is Crowdsale, Pausable {

  mapping(address => bool) public kyc;

  mapping(address => bool) public inxWhitelist;

  /**
   * @dev Throws if called by any account other than the owner or the someone in the management list.
   */
  modifier onlyInx() {
    require(msg.sender == owner || inxWhitelist[msg.sender], "Must be owner or in INX whitelist");
    _;
  }

  /**
   * @dev Reverts if beneficiary and msg.sender is not KYC'd. Note: msg.sender and beneficiary can be different.
   */
  modifier isSenderAndBeneficiaryKyc(address _beneficiary) {
    require(kyc[_beneficiary] && kyc[msg.sender]);
    _;
  }

  /**
   * @dev Adds single address to kyc.
   * @param _beneficiary Address to be added to the kyc
   */
  function addToKyc(address _beneficiary) external onlyInx {
    kyc[_beneficiary] = true;
  }

  /**
   * @dev Adds list of addresses to kyc.
   * @param _beneficiaries Addresses to be added to the kyc
   */
  function addManyToKyc(address[] _beneficiaries) external onlyInx {
    for (uint256 i = 0; i < _beneficiaries.length; i++) {
      kyc[_beneficiaries[i]] = true;
    }
  }

  /**
   * @dev Removes single address from kyc.
   * @param _beneficiary Address to be removed to the kyc
   */
  function removeFromKyc(address _beneficiary) external onlyInx {
    kyc[_beneficiary] = false;
  }

  /**
 * @dev Adds single address to the INX whitelist.
 * @param _inx Address to be added to the INX whitelist
 */
  function addToInxWhitelist(address _inx) external onlyOwner {
    inxWhitelist[_inx] = true;
  }

  /**
   * @dev Removes single address from the INX whitelist.
   * @param _inx Address to be removed to the INX whitelist
   */
  function removeFromInxWhitelist(address _inx) external onlyOwner {
    inxWhitelist[_inx] = false;
  }

  /**
   * @dev Extend parent behavior requiring beneficiary to be in whitelist.
   * @param _beneficiary Token beneficiary
   * @param _weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal isSenderAndBeneficiaryKyc(_beneficiary) {
    super._preValidatePurchase(_beneficiary, _weiAmount);
  }

  /**
   * @dev Overrides delivery by minting tokens upon purchase.
   * @param _beneficiary Token purchaser
   * @param _tokenAmount Number of tokens to be minted
   */
  function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
    require(WhitelistedMintableToken(token).mint(_beneficiary, _tokenAmount));
  }
}
