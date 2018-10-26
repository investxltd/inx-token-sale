pragma solidity 0.4.24;

import "../inx/WhitelistedMintableToken.sol";


contract MockWhitelistedMintableToken is WhitelistedMintableToken {

    // used for false testing
    function mint(address _to, uint256 _amount) public returns (bool) {
        return false;
    }
}
