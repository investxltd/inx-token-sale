/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXTokenEscrow = artifacts.require('INXTokenEscrow');

module.exports = function (deployer, network, accounts) {

    INXToken.deployed().then((inxToken) => {
        return inxToken.addAddressToWhitelist(INXTokenEscrow.address);
    });
};
