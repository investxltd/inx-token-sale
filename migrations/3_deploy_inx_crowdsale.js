/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCrowdsale = artifacts.require('INXCrowdsale');

module.exports = function (deployer, network, accounts) {

  console.log(`Running within network = ${network}`);

  return deployer.deploy(INXCrowdsale, accounts[0], INXToken.address, 355, 400);
};
