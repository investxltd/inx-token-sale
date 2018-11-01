/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCrowdsale = artifacts.require('INXCrowdsale');

module.exports = function (deployer, network, accounts) {
    INXToken.deployed().then((inxToken) => {
        return inxToken.addAddressToWhitelist(INXCrowdsale.address);
    });
};
