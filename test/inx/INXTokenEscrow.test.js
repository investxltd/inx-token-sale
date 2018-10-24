/* eslint-disable camelcase */
const assertRevert = require('../helpers/assertRevert');
const assertRevertMessage = require('../helpers/assertRevertMessage');
const expectEvent = require('../helpers/expectEvent');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');
const etherToWei = require('../helpers/etherToWei');
const weiToEther = require('../helpers/weiToEther');

const INXTokenEscrow = artifacts.require('INXTokenEscrow');
const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXToken = artifacts.require('INXToken');

const BN = web3.utils.BN;

const should = require('chai')
    .use(require('chai-as-promised'))
    .should();

contract.only('INXTokenEscrow', function ([_, owner, recipient, anotherAccount, extraAccount]) {

    let rate;
    let value;

    const assertZero = (bn) => bn.toString(10).should.be.equal('0');
    const assertBN = (result, expected) => result.toString(10).should.be.equal(expected.toString(10));

    beforeEach(async function () {
        this.token = await INXToken.new({from: owner});

        this.crowdsale = await INXCrowdsale.new(owner, this.token.address, 100, 200, {from: owner});

        this.tokenEscrow = await INXTokenEscrow.new(this.crowdsale.address, this.token.address, {from: owner});

        rate = await this.crowdsale.getCurrentRate();
        assertBN(rate, new BN('200'));

        value = await this.crowdsale.minContribution();
    });

    describe('contract setup', function () {
        it('should have wei commitment value', async function () {
            const contractWeiCommitted = await this.tokenEscrow.totalWeiCommitted();
            assertZero(contractWeiCommitted);
        });

        describe('when the requested account has no token balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.tokenBalanceOf(anotherAccount);

                assertZero(balance);
            });
        });

        describe('when the requested account has no wei balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.weiBalanceOf(anotherAccount);

                assertZero(balance);
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
            assertBN(event.args.value, value);
            assertBN(event.args.rate, rate);
            assertBN(event.args.amount, rate.mul(value));
        });

        it('should assign tokens to beneficiary', async function () {
            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(tokenBalance, rate.mul(value));

            const weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertBN(weiBalance, value);

            const contractWeiCommitted = await this.tokenEscrow.totalWeiCommitted();
            assertBN(contractWeiCommitted, value);
        });
    });

    describe('commitment via default function', function () {

        it('should log commitment', async function () {
            const {logs} = await this.tokenEscrow.sendTransaction({value: value, from: recipient});
            const event = logs.find(e => e.event === 'TokenCommitment');
            should.exist(event);
            event.args.sender.should.equal(recipient);
            assertBN(event.args.value, value);
            assertBN(event.args.rate, rate);
            assertBN(event.args.amount, rate.mul(value));
        });

        it('should assign tokens to beneficiary', async function () {
            await this.tokenEscrow.sendTransaction({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(tokenBalance, rate.mul(value));

            const weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertBN(weiBalance, value);

            const contractWeiCommitted = await this.tokenEscrow.totalWeiCommitted();
            assertBN(contractWeiCommitted, value);
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

    describe('refund from owner', function () {
        it('should return all wei', async function () {

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});

            let tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(tokenBalance, rate.mul(value));

            let weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertBN(weiBalance, value);

            let post = new BN(await web3.eth.getBalance(recipient));

            const {logs} = await this.tokenEscrow.sendRefund(recipient, {from: owner});

            tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertZero(tokenBalance);

            weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertZero(weiBalance);

            let postRefund = new BN(await web3.eth.getBalance(recipient));

            // you have the exact amount back you put in
            assertBN(postRefund.sub(post), value);

            const event = logs.find(e => e.event === 'CommitmentRefund');
            should.exist(event);
            event.args.sender.should.equal(recipient);
            assertBN(event.args.value, value);
            assertBN(event.args.amount, rate.mul(value));
        });
    });

    describe('redeem commitment for INX token', function () {
        it('revert if non-positive token balances', async function () {
            await assertRevertMessage(
                this.tokenEscrow.redeem(recipient, {from: recipient}),
                'Balances must be positive'
            );
        });

        it('revert if not KYC passed', async function () {

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});

            await assertRevertMessage(
                this.tokenEscrow.redeem(recipient, {from: recipient}),
                'Sender must have passed KYC'
            );
        });

        it('revert if escrow is not whitelisted to mint tokens', async function () {

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});

            await this.crowdsale.addToKyc(recipient, {from: owner});

            await assertRevert(
                this.tokenEscrow.redeem(recipient, {from: recipient}),
            );
        });

        it('redeem for INX tokens', async function () {

            // ensure the escrow contract can mint INX
            await this.token.addAddressToWhitelist(this.tokenEscrow.address, {from: owner});

            await this.crowdsale.addToKyc(recipient, {from: owner});

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});

            let escrowTokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(escrowTokenBalance, rate.mul(value));

            let inxBalance = await this.token.balanceOf(recipient, {from: recipient});
            assertZero(inxBalance);

            let walletBalancePreRedeem = new BN(await web3.eth.getBalance(owner));

            const {logs} = await this.tokenEscrow.redeem(recipient, {from: recipient});

            let walletBalancePostRedeem = new BN(await web3.eth.getBalance(owner));

            // Investx's wallet of eth should have the value
            assertBN(walletBalancePostRedeem.sub(walletBalancePreRedeem), value);

            escrowTokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertZero(escrowTokenBalance);

            inxBalance = await this.token.balanceOf(recipient, {from: recipient});
            assertBN(inxBalance, rate.mul(value));

            const event = logs.find(e => e.event === 'CommitmentRedeem');
            should.exist(event);
            event.args.sender.should.equal(recipient);
            assertBN(event.args.value, value);
            assertBN(event.args.amount, rate.mul(value));
        });
    });
});
