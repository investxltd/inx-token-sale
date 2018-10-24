/* global web3:true */
const INXToken = artifacts.require('INXToken');

module.exports = function (deployer, network, accounts) {
  deployer.deploy(INXToken)
};
