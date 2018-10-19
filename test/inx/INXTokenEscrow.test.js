/* eslint-disable camelcase */
const assertRevert = require('../helpers/assertRevert');
const expectEvent = require('../helpers/expectEvent');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');
const etherToWei = require('../helpers/etherToWei');
const weiToEther = require('../helpers/weiToEther');

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
    let value;

    beforeEach(async function () {
        this.token = await INXToken.new({from: owner});
        this.crowdsale = await INXCrowdsale.new(owner, this.token.address, 100, 200, {from: owner});

        this.tokenEscrow = await INXTokenEscrow.new(this.crowdsale.address, {from: owner});

        rate = (await this.crowdsale.rate()).toNumber();
        rate.should.be.equal(100);

        value = (await this.crowdsale.minContribution()).toNumber();
    });

    describe('contract setup', function () {
        it('should have wei commitment value', async function () {
            const contractWeiCommitted = await this.tokenEscrow.weiCommitted();
            contractWeiCommitted.should.be.bignumber.equal(0);
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

    describe('Pausable', function () {

        it('should not allow commitment when paused', async function () {
            await this.tokenEscrow.pause({from: owner});
            let contractPaused = await this.tokenEscrow.paused.call();
            contractPaused.should.equal(true);

            await assertRevert(this.tokenEscrow.commitToBuyTokens({value: value, from: recipient}));
        });

        it('should allow transfer when unpaused', async function () {
            await this.tokenEscrow.pause({from: owner});
            await this.tokenEscrow.unpause({from: owner});

            let contractPaused = await this.tokenEscrow.paused.call();
            contractPaused.should.equal(false);

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient}).should.be.fulfilled;
        });


        describe('pause', function () {
            describe('when the sender is the token owner', function () {
                const from = owner;

                describe('when the token is unpaused', function () {
                    it('pauses the token', async function () {
                        await this.tokenEscrow.pause({from});

                        const paused = await this.tokenEscrow.paused();
                        assert.equal(paused, true);
                    });

                    it('emits a paused event', async function () {
                        const {logs} = await this.tokenEscrow.pause({from});

                        assert.equal(logs.length, 1);
                        assert.equal(logs[0].event, 'Pause');
                    });
                });

                describe('when the token is paused', function () {
                    beforeEach(async function () {
                        await this.tokenEscrow.pause({from});
                    });

                    it('reverts', async function () {
                        await assertRevert(this.tokenEscrow.pause({from}));
                    });
                });
            });

            describe('when the sender is not the token owner', function () {
                const from = recipient;

                it('reverts', async function () {
                    await assertRevert(this.tokenEscrow.pause({from}));
                });
            });
        });

        describe('unpause', function () {
            describe('when the sender is the token owner', function () {
                const from = owner;

                describe('when the token is paused', function () {
                    beforeEach(async function () {
                        await this.tokenEscrow.pause({from});
                    });

                    it('unpauses the token', async function () {
                        await this.tokenEscrow.unpause({from});

                        const paused = await this.tokenEscrow.paused();
                        assert.equal(paused, false);
                    });

                    it('emits an unpaused event', async function () {
                        const {logs} = await this.tokenEscrow.unpause({from});

                        assert.equal(logs.length, 1);
                        assert.equal(logs[0].event, 'Unpause');
                    });
                });

                describe('when the token is unpaused', function () {
                    it('reverts', async function () {
                        await assertRevert(this.tokenEscrow.unpause({from}));
                    });
                });
            });

            describe('when the sender is not the token owner', function () {
                const from = recipient;

                it('reverts', async function () {
                    await assertRevert(this.tokenEscrow.unpause({from}));
                });
            });
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

            const contractWeiCommitted = await this.tokenEscrow.weiCommitted();
            contractWeiCommitted.should.be.bignumber.equal(value);
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

            const contractWeiCommitted = await this.tokenEscrow.weiCommitted();
            contractWeiCommitted.should.be.bignumber.equal(value);
        });
    });

    describe('sending minimum commitment', function () {
        it('should fail if below limit', async function () {
            await assertRevert(this.tokenEscrow.sendTransaction({value: 1, from: recipient}));
            await assertRevert(this.tokenEscrow.commitToBuyTokens({value: 1, from: recipient}));
        });

        it('should allow if exactly min limit', async function () {
            await this.tokenEscrow.sendTransaction({value: value, from: recipient}).should.be.fulfilled;
            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient}).should.be.fulfilled;
        });
    });

    describe.only('refund from owner', function () {
        it('should return all wei', async function () {

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});

            let tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            tokenBalance.should.be.bignumber.equal(rate * value);

            let weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            weiBalance.should.be.bignumber.equal(value);

            const post = web3.eth.getBalance(recipient);

            await this.tokenEscrow.sendRefund(recipient, {from: owner});

            tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            tokenBalance.should.be.bignumber.equal(0);

            weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            weiBalance.should.be.bignumber.equal(0);

            const postRefund = web3.eth.getBalance(recipient);

            // you have the exact amount back you put in
            postRefund.minus(post).should.be.bignumber.equal(value);
        });
    });
});
