const assertRevert = require('../helpers/assertRevert');

const advanceBlock = require('../helpers/advanceToBlock');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const INXCrowdsale = artifacts.require('INXCrowdsale');
const MockWhitelistedMintableToken = artifacts.require('MockWhitelistedMintableToken');

contract('INXCrowdsale with MockWhitelistedMintableToken', function ([owner, investor, wallet, purchaser]) {

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.token = await MockWhitelistedMintableToken.new({from: owner});

    // setup INX contract!!
    this.crowdsale = await INXCrowdsale.new(wallet, this.token.address, 1, 2, {from: owner});

    this.openingTime = (await this.crowdsale.openingTime()).toNumber(10);
    this.minContribution = await this.crowdsale.minContribution(); // 0.2 ETH

    // approve so they can invest in crowdsale
    await this.crowdsale.addToKyc(purchaser);

    // ensure the crowdsale can transfer tokens - whitelist in token
    await this.token.addAddressToWhitelist(this.crowdsale.address);
  });

  describe('BuyTokens', function () {

    beforeEach(async function () {
      await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening
    });

    it('should revert as token will never deliver (and returns false)', async function () {
      await assertRevert(this.crowdsale.buyTokens(purchaser, {value: this.minContribution, from: purchaser}));
    });
  });
});
