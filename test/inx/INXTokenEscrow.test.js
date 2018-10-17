/* eslint-disable camelcase */
const assertRevert = require('../helpers/assertRevert');
const expectEvent = require('../helpers/expectEvent');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');

const INXTokenEscrow = artifacts.require('INXTokenEscrow');

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract.only('INXTokenEscrow', function ([_, owner, recipient, anotherAccount, extraAccount]) {

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';
    const DECIMALS = 18;

    const rate = 1;

    beforeEach(async function () {
        this.tokenEscrow = await INXTokenEscrow.new(rate, {from: owner});
    });

    describe('contract setup', function () {
        it('should have an rate', async function () {
            let contractRate = await this.tokenEscrow.rate();
            contractRate.should.be.bignumber.equal(rate);
        });

        it('should have wei commitment value', async function () {
            let contractWeiRaised = await this.tokenEscrow.weiRaised();
            contractWeiRaised.should.be.bignumber.equal(0);
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

    describe('tokenBalanceOf', function () {
        describe('when the requested account has no token balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.tokenBalanceOf(anotherAccount);

                balance.should.be.bignumber.equal(0);
            });
        });

        // describe('when the requested account has some tokens', function () {
        //   it('returns the total amount of tokens', async function () {
        //     const balance = await this.token.balanceOf(owner);
        //
        //     balance.should.be.bignumber.equal(TOTAl_AMOUNT_OF_TOKENS);
        //   });
        // });
    });
});
