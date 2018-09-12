/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCrowdsale = artifacts.require('INXCrowdsale');

module.exports = function (deployer, network, accounts) {

  console.log(`Running within network = ${network}`);

  let _owner = accounts[0];
  console.log(`_owner - [${_owner}]`);

  return deployer.deploy(INXCrowdsale, _owner, INXToken.address, 355, 400, {from: _owner});
};
