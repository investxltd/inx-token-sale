/* global web3:true */
const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXTokenEscrow = artifacts.require('INXTokenEscrow');

module.exports = function (deployer, network, accounts) {

    console.log(`Running within network = ${network}`);

    deployer.deploy(INXTokenEscrow, INXCrowdsale.address)
};
