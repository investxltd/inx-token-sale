const {expectThrow} = require('../helpers/expectThrow');
const {ethSendTransaction, ethGetBalance} = require('../helpers/web3');
const etherToWei = require('../helpers/etherToWei');

const INXToken = artifacts.require('INXToken');
const ForceEther = artifacts.require('ForceEther');

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('INXToken HasNoEther', function ([_, owner, anyone]) {
  const amount = etherToWei('1');

  beforeEach(async function () {
    this.hasNoEther = await INXToken.new({from: owner});
  });

  it('should not accept ether in constructor', async function () {
    await expectThrow(INXToken.new({value: amount}));
  });

  it('should not accept ether', async function () {
    await expectThrow(
      ethSendTransaction({
        from: owner,
        to: this.hasNoEther.address,
        value: amount,
      }),
    );
  });

  it('should allow owner to reclaim ether', async function () {
    const startBalance = await ethGetBalance(this.hasNoEther.address);
    assert.equal(startBalance, 0);

    // Force ether into it
    const forceEther = await ForceEther.new({value: amount});
    await forceEther.destroyAndSend(this.hasNoEther.address);
    const forcedBalance = await ethGetBalance(this.hasNoEther.address);
    assert.equal(forcedBalance.toString(), amount.toString());

    // Reclaim
    const ownerStartBalance = await ethGetBalance(owner);
    await this.hasNoEther.reclaimEther({from: owner});
    const ownerFinalBalance = await ethGetBalance(owner);
    const finalBalance = await ethGetBalance(this.hasNoEther.address);
    assert.equal(finalBalance, 0);

    ownerFinalBalance.should.be.bignumber.gt(ownerStartBalance);
  });

  it('should allow only owner to reclaim ether', async function () {
    // Force ether into it
    const forceEther = await ForceEther.new({value: amount});
    await forceEther.destroyAndSend(this.hasNoEther.address);
    const forcedBalance = await ethGetBalance(this.hasNoEther.address);
    assert.equal(forcedBalance.toString(), amount.toString());

    // Reclaim
    await expectThrow(this.hasNoEther.reclaimEther({from: anyone}));
  });
});
