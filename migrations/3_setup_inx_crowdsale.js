/* global web3:true */
const INXToken = artifacts.require('INXToken');
const INXCrowdsale = artifacts.require('INXCrowdsale');

const HDWalletProvider = require('truffle-hdwallet-provider');
const infuraApikey = 'fkWxG7nrciMRrRD36yVj';
let mnemonic = require('../mnemonic');

module.exports = async function (deployer, network, accounts) {

  console.log(`Running within network = ${network}`);

  const deployedINXToken = await INXToken.deployed();
  const deployedINXCrowdsale = await INXCrowdsale.deployed();

  let _owner = accounts[0];

  if (network === 'ropsten' || network === 'rinkeby') {
    _owner = new HDWalletProvider(mnemonic, `https://${network}.infura.io/${infuraApikey}`, 0).getAddress();
  }

  if (network === 'live') {
    let mnemonicLive = require('../mnemonic_live');
    _owner = new HDWalletProvider(mnemonicLive, `https://mainnet.infura.io/${infuraApikey}`, 0).getAddress();
  }

  console.log(`_owner - [${_owner}]`);

  // Whitelist the crowdsale - so it can mint when contributions come in
  await deployedINXToken.addAddressToWhitelist(deployedINXCrowdsale.address, {from: _owner});
};
