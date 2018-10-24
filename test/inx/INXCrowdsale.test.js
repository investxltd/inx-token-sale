const etherToWei = require('../helpers/etherToWei');
const assertRevert = require('../helpers/assertRevert');

const advanceBlock = require('../helpers/advanceToBlock');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');
const EVMRevert = require('../helpers/EVMRevert');

const BigNumber = web3.utils.BN;
const BN = web3.utils.BN;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const INXCrowdsale = artifacts.require('INXCrowdsale');
const INXToken = artifacts.require('INXToken');

contract('INXCrowdsale', function ([owner, investor, wallet, purchaser, authorized, unauthorized, anotherAuthorized, authorizedTwo, authorizedThree, authorizedFour, authorizedFive]) {


    const assertZero = (bn) => bn.toString(10).should.be.equal('0');
    const assertBN = (result, expected) => result.toString(10).should.be.equal(expected.toString(10));


    before(async function () {
        // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    beforeEach(async function () {
        this.token = await INXToken.new({from: owner});

        // setup INX contract!!
        this.crowdsale = await INXCrowdsale.new(wallet, this.token.address, 1, 2, {from: owner});

        this.rate = await this.crowdsale.rate();
        this.preSaleRate = await this.crowdsale.preSaleRate();
        this.openingTime = (await this.crowdsale.openingTime()).toNumber(10);
        this.closingTime = (await this.crowdsale.closingTime()).toNumber(10);
        this.afterClosingTime = this.closingTime + duration.seconds(5);

        this.minContribution = await this.crowdsale.minContribution(); // 0.2 ETH

        this.value = this.minContribution;
        this.standardExpectedTokenAmount = this.rate.mul(this.value);
        this.standardExpectedPreSaleRateTokenAmount = this.preSaleRate.mul(this.value);

        // approve so they can invest in crowdsale
        await this.crowdsale.addToKyc(owner);
        await this.crowdsale.addToKyc(investor);
        await this.crowdsale.addToKyc(purchaser);

        // ensure the crowdsale can transfer tokens - whitelist in token
        await this.token.addAddressToWhitelist(this.crowdsale.address);
    });

    after(async function () {
        console.log('Crowdsale Owner', await this.crowdsale.owner());
        console.log('test owner', owner);
        console.log('test investor', investor);
        console.log('test wallet', wallet);
        console.log('test purchaser', purchaser);
        console.log('isCrowdsaleOpen', await this.crowdsale.isCrowdsaleOpen());
        console.log('min contribution', this.minContribution.toString(10));
        console.log('paused', await this.crowdsale.paused());
        console.log('openingTime', this.openingTime.toString(10));
        console.log('closingTime', this.closingTime.toString(10));
        console.log('rate', this.rate.toString(10));
        console.log('preSaleRate', this.preSaleRate.toString(10));
    });

    describe('Crowdsale', function () {

        beforeEach(async function () {
            await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening
        });

        describe('construction', function () {
            it('should ensure rate is non-zero', async function () {
                await assertRevert(INXCrowdsale.new(wallet, this.token.address, 0, 2, {from: owner}));
            });

            it('should ensure pre-sale rate is non-zero', async function () {
                await assertRevert(INXCrowdsale.new(wallet, this.token.address, 1, 0, {from: owner}));
            });
        });

        describe('accepting payments', function () {
            it('should accept payments', async function () {
                await this.crowdsale.send(this.value).should.be.fulfilled;
                await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser}).should.be.fulfilled;
            });
        });

        describe('high-level purchase (pre-sale phase)', function () {
            beforeEach(async function () {
                // in pre-sale by default
            });

            it('should log purchase', async function () {
                const {logs} = await this.crowdsale.sendTransaction({value: this.value, from: investor});
                const event = logs.find(e => e.event === 'TokenPurchase');
                should.exist(event);
                event.args.purchaser.should.equal(investor);
                event.args.beneficiary.should.equal(investor);
                event.args.value.should.be.bignumber.equal(this.value);
                event.args.amount.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);
            });

            it('should assign tokens to sender', async function () {
                await this.crowdsale.sendTransaction({value: this.value, from: investor});
                let balance = await this.token.balanceOf(investor);
                balance.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);
            });

            it('should forward funds to wallet', async function () {
                const pre = web3.eth.getBalance(wallet);
                await this.crowdsale.sendTransaction({value: this.value, from: investor});

                const post = web3.eth.getBalance(wallet);
                post.minus(pre).should.be.bignumber.equal(this.value);
            });
        });

        describe('high-level purchase (public phase)', function () {
            beforeEach(async function () {
                await this.crowdsale.publicSale({from: owner});
            });

            it('should log purchase', async function () {
                const {logs} = await this.crowdsale.sendTransaction({value: this.value, from: investor});
                const event = logs.find(e => e.event === 'TokenPurchase');
                should.exist(event);
                event.args.purchaser.should.equal(investor);
                event.args.beneficiary.should.equal(investor);
                event.args.value.should.be.bignumber.equal(this.value);
                event.args.amount.should.be.bignumber.equal(this.standardExpectedTokenAmount);
            });

            it('should assign tokens to sender', async function () {
                await this.crowdsale.sendTransaction({value: this.value, from: investor});
                let balance = await this.token.balanceOf(investor);
                balance.should.be.bignumber.equal(this.standardExpectedTokenAmount);
            });

            it('should forward funds to wallet', async function () {
                const pre = web3.eth.getBalance(wallet);
                await this.crowdsale.sendTransaction({value: this.value, from: investor});

                const post = web3.eth.getBalance(wallet);
                post.minus(pre).should.be.bignumber.equal(this.value);
            });
        });

        describe('low-level purchase (pre-sale phase)', function () {
            beforeEach(async function () {
                // in pre-sale by default
            });

            it('should log purchase', async function () {
                const {logs} = await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser});
                const event = logs.find(e => e.event === 'TokenPurchase');
                should.exist(event);
                event.args.purchaser.should.equal(purchaser);
                event.args.beneficiary.should.equal(investor);
                event.args.value.should.be.bignumber.equal(this.value);
                event.args.amount.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);
            });

            it('should assign tokens to beneficiary', async function () {
                await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser});
                const balance = await this.token.balanceOf(investor);
                balance.should.be.bignumber.equal(this.standardExpectedPreSaleRateTokenAmount);
            });

            it('should forward funds to wallet', async function () {
                const pre = web3.eth.getBalance(wallet);
                await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser});

                const post = web3.eth.getBalance(wallet);
                post.minus(pre).should.be.bignumber.equal(this.value);
            });
        });

        describe('low-level purchase (public phase)', function () {
            beforeEach(async function () {
                await this.crowdsale.publicSale({from: owner});
            });

            it('should log purchase', async function () {
                const {logs} = await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser});
                const event = logs.find(e => e.event === 'TokenPurchase');
                should.exist(event);
                event.args.purchaser.should.equal(purchaser);
                event.args.beneficiary.should.equal(investor);
                event.args.value.should.be.bignumber.equal(this.value);
                event.args.amount.should.be.bignumber.equal(this.standardExpectedTokenAmount);
            });

            it('should assign tokens to beneficiary', async function () {
                await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser});
                const balance = await this.token.balanceOf(investor);
                balance.should.be.bignumber.equal(this.standardExpectedTokenAmount);
            });

            it('should forward funds to wallet', async function () {
                const pre = web3.eth.getBalance(wallet);
                await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser});

                const post = web3.eth.getBalance(wallet);
                post.minus(pre).should.be.bignumber.equal(this.value);
            });
        });
    });

    describe('TimedCrowdsale with timed open/close', function () {

        it('should open within start and end', async function () {
            let isCrowdsaleOpen = await this.crowdsale.isCrowdsaleOpen();
            isCrowdsaleOpen.should.equal(false);

            await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening
            let open = await this.crowdsale.isCrowdsaleOpen();
            open.should.equal(true);

            await increaseTimeTo(this.afterClosingTime);
            let ended = await this.crowdsale.isCrowdsaleOpen();
            ended.should.equal(false);
        });

        describe('accepting payments', function () {

            it('should reject payments before start', async function () {
                let isCrowdsaleOpen = await this.crowdsale.isCrowdsaleOpen();
                isCrowdsaleOpen.should.equal(false);

                await this.crowdsale.send(this.minContribution).should.be.rejectedWith(EVMRevert);
                await this.crowdsale.buyTokens(investor, {from: purchaser, value: this.minContribution})
                    .should.be.rejectedWith(EVMRevert);
            });

            it('should accept payments after start', async function () {
                await increaseTimeTo(this.openingTime);
                await this.crowdsale.send(this.minContribution).should.be.fulfilled;
                await this.crowdsale.buyTokens(investor, {
                    value: this.minContribution,
                    from: purchaser
                }).should.be.fulfilled;
            });

            it('should reject payments after end', async function () {
                await increaseTimeTo(this.afterClosingTime + duration.seconds(1));
                await this.crowdsale.send(this.minContribution).should.be.rejectedWith(EVMRevert);
                await this.crowdsale.buyTokens(investor, {value: this.minContribution, from: purchaser})
                    .should.be.rejectedWith(EVMRevert);
            });
        });
    });

    describe('Ownable', function () {

        it('should have an owner', async function () {
            let owner = await this.crowdsale.owner();
            assert.isTrue(owner !== 0);
        });

        it('changes owner after transfer', async function () {
            await this.crowdsale.transferOwnership(investor);
            let newOwner = await this.crowdsale.owner();

            assert.isTrue(newOwner === investor);
        });

        it('should prevent non-owners from transfering', async function () {
            const other = purchaser;
            const owner = await this.crowdsale.owner.call();
            assert.isTrue(owner !== other);
            await assertRevert(this.crowdsale.transferOwnership(other, {from: other}));
        });

        it('should guard ownership against stuck state', async function () {
            let originalOwner = await this.crowdsale.owner();
            await assertRevert(this.crowdsale.transferOwnership(null, {from: originalOwner}));
        });
    });

    describe('Whitelisting', function () {

        beforeEach(async function () {
            await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening

            // ensure whitelisted
            await this.crowdsale.addManyToKyc([authorized, anotherAuthorized]);
        });

        describe('accepting payments', function () {
            it('should accept payments to whitelisted from whitelisted', async function () {
                await this.crowdsale.buyTokens(authorized, {value: this.value, from: authorized}).should.be.fulfilled;
            });

            it('should not accept payments to whitelisted from not-whitelisted', async function () {
                await this.crowdsale.buyTokens(authorized, {value: this.value, from: unauthorized}).should.be.rejected;
            });

            it('should reject payments to not whitelisted (from whichever buyers)', async function () {
                await this.crowdsale.send({value: this.value, from: unauthorized}).should.be.rejected;

                await this.crowdsale.buyTokens(unauthorized, {
                    value: this.value,
                    from: unauthorized
                }).should.be.rejected;
                await this.crowdsale.buyTokens(unauthorized, {value: this.value, from: authorized}).should.be.rejected;
            });

            it('should reject payments to addresses removed from whitelist', async function () {
                await this.crowdsale.removeFromKyc(authorized);
                await this.crowdsale.buyTokens(authorized, {value: this.value, from: authorized}).should.be.rejected;
            });
        });

        describe('reporting whitelisted', function () {
            it('should correctly report whitelisted addresses', async function () {
                let isAuthorized = await this.crowdsale.kyc(authorized);
                isAuthorized.should.equal(true);

                let isntAuthorized = await this.crowdsale.kyc(unauthorized);
                isntAuthorized.should.equal(false);
            });
        });

        describe('accepting payments', function () {
            it('should accept payments to whitelisted from whitelisted', async function () {
                await this.crowdsale.buyTokens(authorized, {value: this.value, from: authorized}).should.be.fulfilled;
                await this.crowdsale.buyTokens(anotherAuthorized, {
                    value: this.value,
                    from: authorized
                }).should.be.fulfilled;
            });

            it('should not accept payments to whitelisted from un-whitelisted', async function () {
                await this.crowdsale.buyTokens(authorized, {value: this.value, from: unauthorized}).should.be.rejected;
                await this.crowdsale.buyTokens(anotherAuthorized, {
                    value: this.value,
                    from: unauthorized
                }).should.be.rejected;
            });

            it('should reject payments to not whitelisted (with whichever buyers)', async function () {

                await this.crowdsale.send({value: this.value, from: unauthorized}).should.be.rejected;

                await this.crowdsale.buyTokens(unauthorized, {
                    value: this.value,
                    from: unauthorized
                }).should.be.rejected;
                await this.crowdsale.buyTokens(unauthorized, {value: this.value, from: authorized}).should.be.rejected;
            });

            it('should reject payments to addresses removed from whitelist', async function () {
                await this.crowdsale.removeFromKyc(anotherAuthorized);
                await this.crowdsale.buyTokens(authorized, {value: this.value, from: authorized}).should.be.fulfilled;
                await this.crowdsale.buyTokens(anotherAuthorized, {
                    value: this.value,
                    from: authorized
                }).should.be.rejected;
            });
        });

        describe('reporting whitelisted', function () {
            it('should correctly report whitelisted addresses', async function () {
                let isAuthorized = await this.crowdsale.kyc(authorized);
                isAuthorized.should.equal(true);

                let isAnotherAuthorized = await this.crowdsale.kyc(anotherAuthorized);
                isAnotherAuthorized.should.equal(true);

                let isntAuthorized = await this.crowdsale.kyc(unauthorized);
                isntAuthorized.should.equal(false);
            });
        });
    });

    describe('Pausable', function () {
        beforeEach(async function () {
            await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening
        });

        it('should not allow transfer when paused', async function () {
            await this.crowdsale.pause();
            let contractPaused = await this.crowdsale.paused.call();
            contractPaused.should.equal(true);

            await assertRevert(this.crowdsale.buyTokens(investor, {value: this.minContribution, from: investor}));
            await this.crowdsale.unpause();

            contractPaused = await this.crowdsale.paused.call();
            contractPaused.should.equal(false);
        });

        it('should allow transfer when unpaused', async function () {
            await this.crowdsale.pause();
            await this.crowdsale.unpause();

            let contractPaused = await this.crowdsale.paused.call();
            contractPaused.should.equal(false);

            await this.crowdsale.buyTokens(investor, {value: this.minContribution, from: investor}).should.be.fulfilled;
        });

        it('should not allow send when paused', async function () {
            await this.crowdsale.pause();
            let contractPaused = await this.crowdsale.paused.call();
            contractPaused.should.equal(true);

            await assertRevert(this.crowdsale.send(this.minContribution));
        });

        describe('pause', function () {
            describe('when the sender is the token owner', function () {
                const from = owner;

                describe('when the token is unpaused', function () {
                    it('pauses the token', async function () {
                        await this.crowdsale.pause({from});

                        const paused = await this.crowdsale.paused();
                        assert.equal(paused, true);
                    });

                    it('emits a paused event', async function () {
                        const {logs} = await this.crowdsale.pause({from});

                        assert.equal(logs.length, 1);
                        assert.equal(logs[0].event, 'Pause');
                    });
                });

                describe('when the token is paused', function () {
                    beforeEach(async function () {
                        await this.crowdsale.pause({from});
                    });

                    it('reverts', async function () {
                        await assertRevert(this.crowdsale.pause({from}));
                    });
                });
            });

            describe('when the sender is not the token owner', function () {
                const from = anotherAuthorized;

                it('reverts', async function () {
                    await assertRevert(this.crowdsale.pause({from}));
                });
            });
        });

        describe('unpause', function () {
            describe('when the sender is the token owner', function () {
                const from = owner;

                describe('when the token is paused', function () {
                    beforeEach(async function () {
                        await this.crowdsale.pause({from});
                    });

                    it('unpauses the token', async function () {
                        await this.crowdsale.unpause({from});

                        const paused = await this.crowdsale.paused();
                        assert.equal(paused, false);
                    });

                    it('emits an unpaused event', async function () {
                        const {logs} = await this.crowdsale.unpause({from});

                        assert.equal(logs.length, 1);
                        assert.equal(logs[0].event, 'Unpause');
                    });
                });

                describe('when the token is unpaused', function () {
                    it('reverts', async function () {
                        await assertRevert(this.crowdsale.unpause({from}));
                    });
                });
            });

            describe('when the sender is not the token owner', function () {
                const from = investor;

                it('reverts', async function () {
                    await assertRevert(this.crowdsale.unpause({from}));
                });
            });
        });
    });

    describe('IndividualLimitsCrowdsale - min contributions', function () {
        beforeEach(async function () {
            await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening
        });

        describe('sending minimum', function () {
            it('should fail if below limit', async function () {
                await assertRevert(this.crowdsale.send(1));
                await assertRevert(this.crowdsale.send(this.minContribution.minus(1)));
            });

            it('should allow if exactly min limit', async function () {
                await this.crowdsale.send(this.minContribution).should.be.fulfilled;
                await this.crowdsale.buyTokens(investor, {
                    value: this.minContribution,
                    from: purchaser
                }).should.be.fulfilled;
            });
        });

        describe('tracks contributions', function () {
            it('should report amount of wei contributed via default function', async function () {
                const preContribution = await this.crowdsale.contributions(owner);
                preContribution.should.be.bignumber.equal(0);

                await this.crowdsale.send(this.minContribution).should.be.fulfilled;

                const postContribution = await this.crowdsale.contributions(owner);
                postContribution.should.be.bignumber.equal(this.minContribution);

                await this.crowdsale.send(this.minContribution).should.be.fulfilled;

                const secondPostContribution = await this.crowdsale.contributions(owner);
                secondPostContribution.should.be.bignumber.equal(this.minContribution.times(2));
            });

            it('should report amount of wei contributed via buyTokens', async function () {
                const preContribution = await this.crowdsale.contributions(purchaser);
                preContribution.should.be.bignumber.equal(0);

                await this.crowdsale.buyTokens(purchaser, {
                    value: this.minContribution,
                    from: purchaser
                }).should.be.fulfilled;

                const postContribution = await this.crowdsale.contributions(purchaser);
                postContribution.should.be.bignumber.equal(this.minContribution);

                await this.crowdsale.buyTokens(purchaser, {
                    value: this.minContribution,
                    from: purchaser
                }).should.be.fulfilled;

                const secondPostContribution = await this.crowdsale.contributions(purchaser);
                secondPostContribution.should.be.bignumber.equal(this.minContribution.times(2));
            });

            it('should allow multiple contributions', async function () {

                await this.crowdsale.send(this.minContribution).should.be.fulfilled;
                await this.crowdsale.send(this.minContribution).should.be.fulfilled;
                await this.crowdsale.send(this.minContribution).should.be.fulfilled;
                await this.crowdsale.send(this.minContribution).should.be.fulfilled;
                await this.crowdsale.send(this.minContribution).should.be.fulfilled;

                const postContribution = await this.crowdsale.contributions(owner);
                postContribution.should.be.bignumber.equal(this.minContribution.times(5));
            });
        });
    });

    describe('MintedCrowdsale using MintableToken', function () {

        beforeEach(async function () {
            await increaseTimeTo(this.openingTime + duration.seconds(5)); // force time to move on to just after opening
        });

        it('should be whitelisted on token', async function () {
            const whitelisted = await this.token.whitelist(this.crowdsale.address);
            assert.isTrue(whitelisted);
        });

        describe('as a minted crowdsale', function () {
            describe('accepting payments', function () {
                it('should accept payments', async function () {
                    await this.crowdsale.send(this.value).should.be.fulfilled;
                    await this.crowdsale.buyTokens(investor, {value: this.value, from: purchaser}).should.be.fulfilled;
                });
            });

            describe('high-level purchase (public phase)', function () {
                beforeEach(async function () {
                    await this.crowdsale.publicSale({from: owner});
                });

                it('should log purchase', async function () {
                    const {logs} = await this.crowdsale.sendTransaction({value: this.value, from: investor});
                    const event = logs.find(e => e.event === 'TokenPurchase');

                    event.args.purchaser.should.equal(investor);
                    event.args.beneficiary.should.equal(investor);
                    event.args.value.should.be.bignumber.equal(this.value);
                    event.args.amount.should.be.bignumber.equal(this.standardExpectedTokenAmount);
                });

                it('should assign tokens to sender', async function () {
                    await this.crowdsale.sendTransaction({value: this.value, from: investor});
                    let balance = await this.token.balanceOf(investor);
                    balance.should.be.bignumber.equal(this.standardExpectedTokenAmount);
                });

                it('should forward funds to the wallet', async function () {
                    const pre = web3.eth.getBalance(wallet);
                    await this.crowdsale.sendTransaction({value: this.value, from: investor});

                    const post = web3.eth.getBalance(wallet);
                    post.minus(pre).should.be.bignumber.equal(this.value);
                });
            });
        });
    });

    describe('Allow rate setting', function () {

        it('should allow owner to set rate', async function () {
            let oldRate = await this.crowdsale.rate();
            oldRate.should.be.bignumber.equal(1);

            await this.crowdsale.setRate(2, {from: owner});

            let newRate = await this.crowdsale.rate();
            newRate.should.be.bignumber.equal(2);
        });

        it('should only allow owner to set rate', async function () {
            await this.crowdsale.setRate(2, {from: owner}).should.be.fulfilled;

            await assertRevert(this.crowdsale.setRate(2, {from: investor}));
        });

        it('should not allow owner to set zero', async function () {
            await assertRevert(this.crowdsale.setRate(0, {from: owner}));
        });
    });

    describe('Allow pre-sale rate setting', function () {

        it('should allow owner to set rate', async function () {
            let oldPreSaleRate = await this.crowdsale.preSaleRate();
            oldPreSaleRate.should.be.bignumber.equal(2);

            await this.crowdsale.setPreSaleRate(4, {from: owner});

            let newPreSaleRate = await this.crowdsale.preSaleRate();
            newPreSaleRate.should.be.bignumber.equal(4);
        });

        it('should only allow owner to set rate', async function () {
            await this.crowdsale.setPreSaleRate(55, {from: owner}).should.be.fulfilled;

            await assertRevert(this.crowdsale.setPreSaleRate(66, {from: investor}));
        });

        it('should not allow owner to set zero', async function () {
            await assertRevert(this.crowdsale.setPreSaleRate(0, {from: owner}));
        });
    });

    describe('Allow closing timestamp setting', function () {

        it('should allow owner to set closing time', async function () {

            await this.crowdsale.setClosingTime(this.openingTime + 1, {from: owner});

            let newClosingTime = await this.crowdsale.closingTime();
            newClosingTime.should.be.bignumber.equal(this.openingTime + 1);
        });

        it('should only allow owner to set closing time', async function () {
            await this.crowdsale.setClosingTime(this.openingTime + 1, {from: owner}).should.be.fulfilled;

            await assertRevert(this.crowdsale.setClosingTime(this.openingTime + 1, {from: investor}));
        });

        it('should not allow owner to set closing time before opening time', async function () {
            await assertRevert(this.crowdsale.setClosingTime(this.openingTime - 1, {from: owner}));
            await assertRevert(this.crowdsale.setClosingTime(this.openingTime, {from: owner}));
        });
    });

    describe('Allow min contribution setting', function () {

        it('should allow owner to set min contribution', async function () {

            await this.crowdsale.setMinContribution(1, {from: owner});

            let newMinContribution = await this.crowdsale.minContribution();
            newMinContribution.should.be.bignumber.equal(1);
        });

        it('should only allow owner to set min contribution', async function () {
            await this.crowdsale.setMinContribution(1, {from: owner}).should.be.fulfilled;

            await assertRevert(this.crowdsale.setMinContribution(1, {from: investor}));
        });

        it('should not allow owner to set zero', async function () {
            await assertRevert(this.crowdsale.setMinContribution(0, {from: owner}));
        });
    });

    describe('Allow turning on public sale', function () {

        beforeEach(async function () {
            let preSaleState = await this.crowdsale.inPreSale();
            assert.isTrue(preSaleState);
        });

        it('should allow owner to trigger public sale', async function () {
            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;
            const inPreSale = await this.crowdsale.inPreSale();
            assert.isFalse(inPreSale);
        });

        it('should only allow owner to trigger public sale', async function () {
            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;

            await assertRevert(this.crowdsale.publicSale({from: investor}));
        });

        it('should be only be allowed to called when in pre-sale', async function () {
            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;
            await assertRevert(this.crowdsale.publicSale({from: owner}));
        });
    });

    describe('INX whitelisting and KYC', function () {

        describe('KYC whitelisting', function () {

            beforeEach(async function () {
                await this.crowdsale.addToInxWhitelist(anotherAuthorized, {from: owner});
            });

            it('should be able to add to kyc when in inx whitelist', async function () {
                let isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(false);

                await this.crowdsale.addToKyc(unauthorized, {from: anotherAuthorized});

                isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(true);
            });

            it('should not be able to add to kyc when not in inx whitelist', async function () {
                let isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(false);

                await assertRevert(this.crowdsale.addToKyc([unauthorized], {from: purchaser}));

                isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(false);
            });

            it('should be able to add many to kyc when in inx whitelist', async function () {
                let isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(false);

                await this.crowdsale.addManyToKyc([unauthorized], {from: anotherAuthorized});

                isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(true);
            });

            it('should not be able to add many to kyc when not in inx whitelist', async function () {
                let isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(false);

                await assertRevert(this.crowdsale.addManyToKyc([unauthorized], {from: purchaser}));

                isAuthorized = await this.crowdsale.kyc(unauthorized);
                isAuthorized.should.equal(false);
            });

            it('should be able to remove from kyc if caller is part of the inx whitelist', async function () {
                // Add them
                let isKycAuthorized = await this.crowdsale.kyc(unauthorized);
                isKycAuthorized.should.equal(false);

                await this.crowdsale.addToKyc(unauthorized, {from: anotherAuthorized});

                isKycAuthorized = await this.crowdsale.kyc(unauthorized);
                isKycAuthorized.should.equal(true);

                // Remove them
                await this.crowdsale.removeFromKyc(unauthorized, {from: anotherAuthorized});

                isKycAuthorized = await this.crowdsale.kyc(unauthorized);
                isKycAuthorized.should.equal(false);
            });

            it('should not be able to remove from kyc if caller is not part of the inx whitelist', async function () {
                await assertRevert(this.crowdsale.removeFromKyc(unauthorized, {from: unauthorized}));
            });
        });

        describe('adding to INX whitelist', function () {
            it('should be able to add to inx whitelist when owner', async function () {
                let isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(false);

                await this.crowdsale.addToInxWhitelist(authorizedFour, {from: owner});

                isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(true);
            });

            it('should not be able to add many to inx whitelist when not owner', async function () {
                await assertRevert(this.crowdsale.addToInxWhitelist(unauthorized, {from: purchaser}));
            });

            it('should be able to remove from to inx whitelist when owner', async function () {
                let isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(false);

                await this.crowdsale.addToInxWhitelist(authorizedFour, {from: owner});

                isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(true);

                await this.crowdsale.removeFromInxWhitelist(authorizedFour, {from: owner});

                isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(false);
            });

            it('should not be able to remove from to inx whitelist when not owner', async function () {
                let isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(false);

                await this.crowdsale.addToInxWhitelist(authorizedFour, {from: owner});

                isAuthorized = await this.crowdsale.inxWhitelist(authorizedFour);
                isAuthorized.should.equal(true);

                await assertRevert(this.crowdsale.removeFromInxWhitelist(authorizedFour, {from: purchaser}));
            });
        });
    });

    describe('Current rate', function () {
        it('should return presale rate as current rate when in presale', async function () {
            let preSaleRate = await this.crowdsale.preSaleRate();
            assertBN(preSaleRate, new BN('2'));

            const inPreSale = await this.crowdsale.inPreSale();
            assert.isTrue(inPreSale);

            // current rate should be pre-sale rate
            const currentRate = await this.crowdsale.getCurrentRate().should.be.fulfilled;
            assertBN(currentRate, preSaleRate);
        });

        it('should return rate as current rate when in main sale', async function () {

            await this.crowdsale.publicSale({from: owner}).should.be.fulfilled;

            let rate = await this.crowdsale.rate();
            assertBN(rate, new BN('1'));

            const inPreSale = await this.crowdsale.inPreSale();
            assert.isFalse(inPreSale);

            // current rate should be pre-sale rate
            const currentRate = await this.crowdsale.getCurrentRate().should.be.fulfilled;
            assertBN(currentRate, rate);
        });
    });
});
