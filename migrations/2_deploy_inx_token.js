/* global web3:true */
const INXToken = artifacts.require('INXToken');

module.exports = function (deployer, network, accounts) {

  console.log(`Running within network = ${network}`);

  deployer.deploy(INXToken)
};
