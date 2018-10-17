/* global web3:true */
const INXTokenEscrow = artifacts.require('INXTokenEscrow');

module.exports = function (deployer, network, accounts) {

    console.log(`Running within network = ${network}`);

    deployer.deploy(INXTokenEscrow, 400)
};
