const etherToWei = require('../helpers/etherToWei');
const assertRevert = require('../helpers/assertRevert');

const advanceBlock = require('../helpers/advanceToBlock');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');
const EVMRevert = require('../helpers/EVMRevert');

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXToken = artifacts.require('INXToken');
const INXCommitment = artifacts.require('INXCommitment');

contract.only('INXCommitment', function ([owner, investor, wallet, unauthorized]) {

    beforeEach(async function () {
        this.token = await INXToken.new({from: owner});

        this.crowdsale = await INXCrowdsale.new(wallet, this.token.address, 1, 2, {from: owner});

        this.commitment = await INXCommitment.new(investor, this.crowdsale.address, this.token.address, {from: owner});

        this.rate = await this.crowdsale.rate();
        this.preSaleRate = await this.crowdsale.preSaleRate();
        this.minContribution = await this.crowdsale.minContribution(); // 0.2 ETH

        // this.standardExpectedTokenAmount = this.rate.mul(this.value);
        // this.standardExpectedPreSaleRateTokenAmount = this.preSaleRate.mul(this.value);

        // ensure the crowdsale can transfer tokens - whitelist in token
        await this.token.addAddressToWhitelist(this.crowdsale.address);
    });

    after(async function () {});

    describe('construction', function () {

        it('should setup sender', async function () {
            const sender = await this.commitment.senderAddress();
            sender.should.equal(investor);
        });

        it('should have zero token balance', async function () {
            const senderTokenBalance = await this.commitment.senderTokenBalance();
            senderTokenBalance.should.be.bignumber.equal('0');
        });

        it('should have zero wei balance', async function () {
            const senderWeiBalance = await this.commitment.senderWeiBalance();
            senderWeiBalance.should.be.bignumber.equal('0');
        });

        it('should have a refunding state of false', async function () {
            const refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(false);
        });
    });

    describe('refuding can be toggled by owner', function () {

        it('should revert if not owner', async function () {
            await assertRevert(this.commitment.toggleRefunding({from: unauthorized}));
        });

        it('should fulfill if owner', async function () {
            await this.commitment.toggleRefunding({from: owner});

            let refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(true);

            await this.commitment.toggleRefunding({from: owner});

            refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(false);
        });
    });
});
