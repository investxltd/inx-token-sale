/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXCommitment = artifacts.require('INXCommitment');

module.exports = function (deployer, network, accounts) {
    return deployer.deploy(INXCommitment, accounts[0], INXCrowdsale.address, INXToken.address);
};
