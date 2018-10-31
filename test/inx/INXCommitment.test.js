const etherToWei = require('../helpers/etherToWei');
const assertRevert = require('../helpers/assertRevert');

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
        const token = await INXToken.new({from: owner});

        const crowdsale = await INXCrowdsale.new(wallet, token.address, 200, 400, {from: owner});

        this.commitment = await INXCommitment.new(investor, crowdsale.address, token.address, {from: owner});

        this.rate = await crowdsale.rate();
        this.preSaleRate = await crowdsale.preSaleRate();
        this.minContribution = await crowdsale.minContribution(); // 0.2 ETH

        this.standardExpectedTokenAmount = this.rate.mul(this.minContribution);
        this.standardExpectedPreSaleRateTokenAmount = this.preSaleRate.mul(this.minContribution);

        // ensure the crowdsale can transfer tokens - whitelist in token
        await token.addAddressToWhitelist(crowdsale.address);

        this.inxTokenSale = crowdsale;
        this.inxToken = token;
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

    describe('pause', function () {
        describe('when the contract is unpaused', function () {
            it('pauses the token', async function () {
                await this.commitment.pause({from: owner});

                const paused = await this.commitment.paused();
                paused.should.be.equal(true);
            });

            it('emits a paused event', async function () {
                const {logs} = await this.commitment.pause({from: owner});

                assert.equal(logs.length, 1);
                assert.equal(logs[0].event, 'Pause');
            });
        });

        describe('when the token is paused', function () {
            beforeEach(async function () {
                await this.commitment.pause({from: owner});
            });

            it('reverts', async function () {
                await assertRevert(this.commitment.pause({from: owner}));
            });
        });

        describe('when the sender is not the token owner', function () {
            it('reverts', async function () {
                await assertRevert(this.commitment.pause({from: unauthorized}));
            });
        });
    });

    describe('unpause', function () {
        describe('when the token is paused', function () {
            beforeEach(async function () {
                await this.commitment.pause({from: owner});
            });

            it('unpauses the token', async function () {
                await this.commitment.unpause({from: owner});

                const paused = await this.commitment.paused();
                paused.should.be.equal(false);
            });

            it('emits an unpaused event', async function () {
                const {logs} = await this.commitment.unpause({from: owner});

                assert.equal(logs.length, 1);
                assert.equal(logs[0].event, 'Unpause');
            });
        });

        describe('when the token is unpaused', function () {
            it('reverts', async function () {
                await assertRevert(this.commitment.unpause({from: owner}));
            });
        });

        describe('when the sender is not the token owner', function () {
            it('reverts', async function () {
                await assertRevert(this.commitment.unpause({from: unauthorized}));
            });
        });
    });

    describe('refunding state', function () {

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

    describe('commit', function () {

        it('should revert if paused', async function () {
            await this.commitment.pause({from: owner});

            const paused = await this.commitment.paused();
            paused.should.be.equal(true);

            await assertRevert(this.commitment.commit({value: this.minContribution, from: investor}));
        });

        it('should revert if not sender', async function () {
            await assertRevert(this.commitment.commit({value: this.minContribution, from: unauthorized}));
        });

        it('should revert if in refunding state', async function () {

            await this.commitment.toggleRefunding({from: owner});

            let refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(true);

            await assertRevert(this.commitment.commit({value: this.minContribution, from: investor}));
        });

        it('should revert if under min contribution', async function () {
            await assertRevert(this.commitment.commit({value: 1, from: investor}));
        });

        it('should make min contribution commitment', async function () {
            const {logs} = await this.commitment.commit({value: this.minContribution, from: investor});

            const senderWeiBalance = await this.commitment.senderWeiBalance();
            senderWeiBalance.should.be.bignumber.equal(this.minContribution);

            const senderTokenBalance = await this.commitment.senderTokenBalance();
            senderTokenBalance.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);

            const event = logs.find(e => e.event === 'Commit');
            should.exist(event);
            event.args.sender.should.equal(investor);
            event.args.value.should.be.bignumber.equal(this.minContribution);
            event.args.rate.should.be.bignumber.equal(this.preSaleRate);
            event.args.amount.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);
        });
    });

    describe('refund', function () {

        it('should revert if paused', async function () {
            await this.commitment.pause({from: owner});

            const paused = await this.commitment.paused();
            paused.should.be.equal(true);

            await assertRevert(this.commitment.refund({from: investor}));
        });

        it('should revert if not in refunding state', async function () {

            let refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(false);

            await assertRevert(this.commitment.refund({from: investor}));
        });

        it('should refund commitment', async function () {
            // commit min contribution
            await this.commitment.commit({value: this.minContribution, from: investor});

            await this.commitment.toggleRefunding({from: owner});

            let refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(true);

            const pre = web3.eth.getBalance(investor);

            // refund triggered by owner
            const {logs} = await this.commitment.refund({from: owner});

            const post = web3.eth.getBalance(investor);

            // should have a balance increased by original committed value
            // that is the min contribution
            post.minus(pre).should.be.bignumber.equal(this.minContribution);

            const senderTokenBalance = await this.commitment.senderTokenBalance();
            senderTokenBalance.should.be.bignumber.equal(0);

            const senderWeiBalance = await this.commitment.senderWeiBalance();
            senderWeiBalance.should.be.bignumber.equal('0');

            const event = logs.find(e => e.event === 'Refund');
            should.exist(event);
            event.args.sender.should.equal(investor);
            event.args.value.should.be.bignumber.equal(this.minContribution);
        });
    });

    describe('redeem', function () {

        it('should revert if paused', async function () {
            await this.commitment.pause({from: owner});

            const paused = await this.commitment.paused();
            paused.should.be.equal(true);

            await assertRevert(this.commitment.redeem({from: investor}));
        });

        it('should revert if in refunding state', async function () {

            await this.commitment.toggleRefunding({from: owner});

            let refunding = await this.commitment.isRefunding();
            refunding.should.be.equal(true);

            await assertRevert(this.commitment.redeem({from: investor}));
        });

        it('should revert if zero balances', async function () {

            const senderTokenBalance = await this.commitment.senderTokenBalance();
            senderTokenBalance.should.be.bignumber.equal('0');

            const senderWeiBalance = await this.commitment.senderWeiBalance();
            senderWeiBalance.should.be.bignumber.equal('0');

            await assertRevert(this.commitment.redeem({from: investor}));
        });

        it('should revert if no KYC', async function () {
            const {logs} = await this.commitment.commit({value: this.minContribution, from: investor});

            await assertRevert(this.commitment.redeem({from: investor}));
        });

        it('should redeem commitment', async function () {
            // ensure the commitment contract can mint INX
            await this.inxToken.addAddressToWhitelist(this.commitment.address, {from: owner});

            // commit min contribution
            await this.commitment.commit({value: this.minContribution, from: investor});

            // add investor to kyc in token sale
            await this.inxTokenSale.addToKyc(investor, {from: owner});

            let inxBalance = await this.inxToken.balanceOf(investor, {from: investor});
            inxBalance.should.be.bignumber.equal('0');

            const preWalletBalance = web3.eth.getBalance(wallet);

            // refund triggered by owner
            const {logs} = await this.commitment.redeem({from: investor});

            const postWalletBalance = web3.eth.getBalance(wallet);

            postWalletBalance.minus(preWalletBalance).should.be.bignumber.equal(this.minContribution);

            const senderTokenBalance = await this.commitment.senderTokenBalance();
            senderTokenBalance.should.be.bignumber.equal(0);

            const senderWeiBalance = await this.commitment.senderWeiBalance();
            senderWeiBalance.should.be.bignumber.equal('0');

            inxBalance = await this.inxToken.balanceOf(investor, {from: investor});
            inxBalance.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);

            const event = logs.find(e => e.event === 'Redeem');
            should.exist(event);
            event.args.sender.should.equal(investor);
            // FIXME add extra args
        });
    });
});
