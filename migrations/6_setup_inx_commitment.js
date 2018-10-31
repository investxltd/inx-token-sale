/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCommitment = artifacts.require('INXCommitment');

module.exports = function (deployer, network, accounts) {
    INXToken.deployed().then((inxToken) => {
        return inxToken.addAddressToWhitelist(INXCommitment.address);
    });
};
