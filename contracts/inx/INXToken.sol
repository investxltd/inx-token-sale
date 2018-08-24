pragma solidity ^0.4.24;

import "./WhitelistedMintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/StandardBurnableToken.sol";
import "openzeppelin-solidity/contracts/ownership/HasNoEther.sol";


/**
 * @title INXToken ERC20 token for use with the Investx Platform
 */
contract INXToken is WhitelistedMintableToken, StandardBurnableToken, HasNoEther {

  string public constant name = "INX Token";
  string public constant symbol = "INX";
  uint8 public constant decimals = 18;

  // flag to control "general" transfers (outside of whitelisted and founders)
  bool public transfersEnabled = false;

  // all the founders must be added to this mapping (with a true flag)
  mapping(address => bool) public founders;

  // founders have a token lock-up that stops transfers (to non-investx addresses) upto this timestamp
  // locked until after the 29th Feb 2020
  uint256 constant public founderTokensLockedUntil = 1583020799;

  // address that the investx platform will use to receive INX tokens for investment (when developed)
  address public investxPlatform;

  constructor() public payable {
    // contract creator is automatically whitelisted
    addAddressToWhitelist(msg.sender);
  }

  /**
   * @dev Adds single address to founders (who are locked for a period of time).
   * @param _founder Address to be added to the founder list
   */
  function addAddressToFounders(address _founder) external onlyOwner {
    require(_founder != address(0), "Can not be zero address");

    founders[_founder] = true;
  }

  /**
   * @dev Owner turn on "general" account-to-account transfers (once and only once)
   */
  function enableTransfers() external onlyOwner {
    require(!transfersEnabled, "Transfers already enabled");

    transfersEnabled = true;
  }

  /**
   * @dev Owner can set the investx platform address once built
   * @param _investxPlatform address of the investx platform (where you send your tokens for investments)
   */
  function setInvestxPlatform(address _investxPlatform) external onlyOwner {
    require(_investxPlatform != address(0), "Can not be zero address");

    investxPlatform = _investxPlatform;
  }

 /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) public returns (bool) {
    // transfers will be disabled during the crowdfunding phase - unless on the whitelist
    require(transfersEnabled || whitelist(msg.sender), "INXToken transfers disabled");

    require(
      !founders[msg.sender] || founderTokensLockedUntil < block.timestamp || _to == investxPlatform,
      "INXToken locked for founders for arbitrary time unless sending to investx platform"
    );

    return super.transfer(_to, _value);
  }

  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    // transfers will be disabled during the crowdfunding phase - unless on the whitelist
    require(transfersEnabled || whitelist(msg.sender), "INXToken transfers disabled");

    require(
      !founders[msg.sender] || founderTokensLockedUntil < block.timestamp || _to == investxPlatform,
        "INXToken locked for founders for arbitrary time unless sending to investx platform"
    );

    return super.transferFrom(_from, _to, _value);
  }
}
