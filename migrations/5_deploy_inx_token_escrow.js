/* global web3:true */
const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXToken = artifacts.require('INXToken');
const INXTokenEscrow = artifacts.require('INXTokenEscrow');

module.exports = function (deployer, network, accounts) {
    deployer.deploy(INXTokenEscrow, INXCrowdsale.address, INXToken.address)
};
