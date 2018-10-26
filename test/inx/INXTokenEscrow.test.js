/* eslint-disable camelcase */
const assertRevert = require('../helpers/assertRevert');
const assertRevertMessage = require('../helpers/assertRevertMessage');
const assertBN = require('../helpers/assertBN');
const assertBNZero = require('../helpers/assertBNZero');

const INXTokenEscrow = artifacts.require('INXTokenEscrow');
const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXToken = artifacts.require('INXToken');

const BN = require('bn.js');

const should = require('chai')
    .use(require('chai-as-promised'))
    .should();

contract.only('INXTokenEscrow', function ([_, owner, recipient, anotherAccount]) {

    let rate;
    let value;

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
            assertBNZero(contractWeiCommitted);
        });

        describe('when the requested account has no token balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.tokenBalanceOf(anotherAccount);

                assertBNZero(balance);
            });
        });

        describe('when the requested account has no wei balance', function () {
            it('returns zero', async function () {
                const balance = await this.tokenEscrow.weiBalanceOf(anotherAccount);

                assertBNZero(balance);
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

        it('should assign tokens to beneficiary in public sale (with correct rate)', async function () {
            // move to public sale
            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;

            // reset the rate to public sale rate (setup using pre-sale by default)
            rate = await this.crowdsale.getCurrentRate();

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(tokenBalance, rate.mul(value));

            const weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertBN(weiBalance, value);

            const contractWeiCommitted = await this.tokenEscrow.totalWeiCommitted();
            assertBN(contractWeiCommitted, value);
        });

        it('should assign tokens to beneficiary in public sale (with correct rate)', async function () {
            // move to public sale
            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;

            // reset the rate to public sale rate (setup using pre-sale by default)
            rate = await this.crowdsale.getCurrentRate();

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(tokenBalance, rate.mul(value));

            const weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertBN(weiBalance, value);

            const contractWeiCommitted = await this.tokenEscrow.totalWeiCommitted();
            assertBN(contractWeiCommitted, value);
        });

        it('should assign tokens to beneficiary in public sale and pre-sale (with correct rate)', async function () {

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBN(tokenBalance, rate.mul(value));

            // move to public sale
            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;

            // reset the rate to public sale rate (setup using pre-sale by default)
            rate = await this.crowdsale.getCurrentRate();

            await this.tokenEscrow.commitToBuyTokens({value: value, from: recipient});
            const newTokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            const publicSaleTokens = rate.mul(value);
            assertBN(newTokenBalance, publicSaleTokens.add(tokenBalance));
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

            let post = new BN((await web3.eth.getBalance(recipient)).toString());

            const {logs} = await this.tokenEscrow.sendRefund(recipient, {from: owner});

            tokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBNZero(tokenBalance);

            weiBalance = await this.tokenEscrow.weiBalanceOf(recipient);
            assertBNZero(weiBalance);

            let postRefund = new BN((await web3.eth.getBalance(recipient)).toString());

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
            assertBNZero(inxBalance);

            let walletBalancePreRedeem = new BN((await web3.eth.getBalance(owner)).toString());

            const {logs} = await this.tokenEscrow.redeem(recipient, {from: recipient});

            let walletBalancePostRedeem = new BN((await web3.eth.getBalance(owner)).toString());

            // Investx's wallet of eth should have the value
            assertBN(walletBalancePostRedeem.sub(walletBalancePreRedeem), value);

            escrowTokenBalance = await this.tokenEscrow.tokenBalanceOf(recipient);
            assertBNZero(escrowTokenBalance);

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
