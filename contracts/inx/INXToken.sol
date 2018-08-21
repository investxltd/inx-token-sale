pragma solidity ^0.4.24;

import "./WhitelistedMintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/StandardBurnableToken.sol";


/**
 * @title INXToken ERC20 token for use with the Investx Platform
 */
contract INXToken is WhitelistedMintableToken, StandardBurnableToken {

  string public constant name = "INX Token";
  string public constant symbol = "INX";
  uint8 public constant decimals = 18;

  // flag to control "general" transfers (outside of whitelisted and founders)
  bool public transfersEnabled = false;

  // all the founders must be added to this mapping (with a true flag)
  mapping(address => bool) public founders;

  // FIXME arbitrarily set - will be 24 months
  // founders have a token lock-up that stops transfers (to non-investx addresses) upto this timestamp
  uint256 public founderTokensLockedUntil = block.timestamp.add(1 minutes).add(8 days);

  // address that the investx platform will use to receive INX tokens for investment
  address public investxPlatform;

  constructor() public Whitelist() {
    // owner is automatically whitelisted
    addAddressToWhitelist(msg.sender);
  }

  /**
   * @dev Owner turn on "general" account-to-account transfers (once and only once)
   */
  function enableTransfers() public onlyOwner {
    require(!transfersEnabled, "Transfers already enabled");

    transfersEnabled = true;
  }

  /**
   * @dev Adds single address to founders (who are locked for a period of time).
   * @param _founder Address to be added to the founder list
   */
  function addAddressToFounders(address _founder) external onlyOwner {
    require(_founder != address(0));

    founders[_founder] = true;
  }

  /**
   * @dev Owner can set the investx platform address once built
   * @param _investxPlatform address of the investx platform (where you send your tokens for investments)
   */
  function setInvestxPlatform(address _investxPlatform) public onlyOwner {
    require(_investxPlatform != address(0));

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
