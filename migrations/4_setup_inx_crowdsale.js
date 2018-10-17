/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCrowdsale = artifacts.require('INXCrowdsale');

module.exports = function (deployer, network, accounts) {

    console.log(`Running within network = ${network}`);

    INXToken.deployed().then((inxToken) => {
        return inxToken.addAddressToWhitelist(INXCrowdsale.address);
    });
};
