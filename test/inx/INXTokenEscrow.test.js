/* eslint-disable camelcase */
const assertRevert = require('../helpers/assertRevert');
const expectEvent = require('../helpers/expectEvent');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');
const etherToWei = require('../helpers/etherToWei');

const INXTokenEscrow = artifacts.require('INXTokenEscrow');
const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXToken = artifacts.require('INXToken');

const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract.only('INXTokenEscrow', function ([_, owner, recipient, anotherAccount, extraAccount]) {

    let rate;
    const value = 100;

    beforeEach(async function () {
        this.token = await INXToken.new({from: owner});
        this.crowdsale = await INXCrowdsale.new(owner, this.token.address, 100, 200, {from: owner});

        this.tokenEscrow = await INXTokenEscrow.new(this.crowdsale.address, {from: owner});

        rate = (await this.crowdsale.rate()).toNumber();
        rate.should.be.equal(100);
    });

    describe('contract setup', function () {
        it('should have wei commitment value', async function () {
            let contractWeiCommitted = await this.tokenEscrow.weiCommitted();
            contractWeiCommitted.should.be.bignumber.equal(0);
        });

        it('should have a min contribution', async function () {
            let contractMinContribution = await this.tokenEscrow.minContribution();
            contractMinContribution.should.be.bignumber.equal(etherToWei(0.2));
        });

        describe('when the requested account has no token balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.tokenBalanceOf(anotherAccount);

                balance.should.be.bignumber.equal(0);
            });
        });

        describe('when the requested account has no wei balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.weiBalanceOf(anotherAccount);

                balance.should.be.bignumber.equal(0);
            });
        });
    });

    describe('ownable', function () {
        it('should have an owner', async function () {
            let owner = await this.tokenEscrow.owner();
            assert.isTrue(owner !== 0);
        });

        it('changes owner after transfer', async function () {
            await this.tokenEscrow.transferOwnership(recipient, {from: owner});
            let newOwner = await this.tokenEscrow.owner();

            assert.isTrue(newOwner === recipient);
        });

        it('should prevent non-owners from transfering', async function () {
            const owner = await this.tokenEscrow.owner.call();
            assert.isTrue(owner !== anotherAccount);
            await assertRevert(this.tokenEscrow.transferOwnership(anotherAccount, {from: anotherAccount}));
        });

        it('should guard ownership against stuck state', async function () {
            let originalOwner = await this.tokenEscrow.owner();
            await assertRevert(this.tokenEscrow.transferOwnership(null, {from: originalOwner}));
        });
    });

    describe('commitment via commitToBuyTokens', function () {

        it('should log commitment', async function () {
            const {logs} = await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const event = logs.find(e => e.event === 'TokenCommitment');
            should.exist(event);
            event.args.sender.should.equal(recipient);
            event.args.value.should.be.bignumber.equal(value);
            event.args.rate.should.be.bignumber.equal(rate);
            event.args.amount.should.be.bignumber.equal(rate * value);
        });

        it('should assign tokens to beneficiary', async function () {
            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            tokenBalance.should.be.bignumber.equal(rate * value);

            const weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            weiBalance.should.be.bignumber.equal(value);
        });
    });

    describe('commitment via default function', function () {

        it('should log commitment', async function () {
            const {logs} = await this.tokenEscrow.sendTransaction({value: value, from: recipient});
            const event = logs.find(e => e.event === 'TokenCommitment');
            should.exist(event);
            event.args.sender.should.equal(recipient);
            event.args.value.should.be.bignumber.equal(value);
            event.args.rate.should.be.bignumber.equal(rate);
            event.args.amount.should.be.bignumber.equal(rate * value);
        });

        it('should assign tokens to beneficiary', async function () {
            await this.tokenEscrow.sendTransaction({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            tokenBalance.should.be.bignumber.equal(rate * value);

            const weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            weiBalance.should.be.bignumber.equal(value);
        });
    });
});
