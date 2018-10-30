/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXTokenSale = artifacts.require('INXTokenSale');

module.exports = function (deployer, network, accounts) {
    INXToken.deployed().then((inxToken) => {
        return inxToken.addAddressToWhitelist(INXTokenSale.address);
    });
};
