/* global web3:true */
const INXToken = artifacts.require('INXToken');

module.exports = function (deployer, network, accounts) {

  console.log(`Running within network = ${network}`);

  let _owner = accounts[0];
  console.log(`_owner - [${_owner}]`);

  deployer.deploy(INXToken)
};
