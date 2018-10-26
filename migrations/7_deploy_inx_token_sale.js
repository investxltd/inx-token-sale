/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXTokenSale = artifacts.require('INXTokenSale');

module.exports = function (deployer, network, accounts) {
  return deployer.deploy(INXTokenSale, accounts[0], INXToken.address, 355, 400);
};
