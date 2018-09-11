/* eslint-disable camelcase */
const assertRevert = require('../helpers/assertRevert');
const expectEvent = require('../helpers/expectEvent');
const increaseTimeTo = require('../helpers/increaseTime').increaseTimeTo;
const duration = require('../helpers/increaseTime').duration;
const latestTime = require('../helpers/latestTime');

const INXToken = artifacts.require('INXToken');

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('INXToken', function ([_, owner, recipient, anotherAccount, extraAccount, founder, inxPlatform]) {

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';
  const DECIMALS = 18;
  const TOTAl_AMOUNT_OF_TOKENS = new BigNumber(0).times(new BigNumber(10).pow(DECIMALS));

  beforeEach(async function () {
    this.token = await INXToken.new({from: owner});
  });

  describe('total supply', function () {
    it('returns the total amount of tokens', async function () {
      const totalSupply = await this.token.totalSupply();

      totalSupply.should.be.bignumber.equal(TOTAl_AMOUNT_OF_TOKENS);
    });
  });

  describe('decimals', function () {
    it('returns the number of decimals', async function () {
      const decimals = await this.token.decimals();

      assert.equal(decimals, DECIMALS);
    });
  });

  describe('symbol', function () {
    it('returns the symbol', async function () {
      const symbol = await this.token.symbol();

      assert.equal(symbol, 'INX');
    });
  });

  describe('name', function () {
    it('returns the name', async function () {
      const name = await this.token.name();

      assert.equal(name, 'INX Token');
    });
  });

  describe('ownable', function () {
    it('should have an owner', async function () {
      let owner = await this.token.owner();
      assert.isTrue(owner !== 0);
    });

    it('changes owner after transfer', async function () {
      await this.token.transferOwnership(recipient, {from: owner});
      let newOwner = await this.token.owner();

      assert.isTrue(newOwner === recipient);
    });

    it('should prevent non-owners from transfering', async function () {
      const owner = await this.token.owner.call();
      assert.isTrue(owner !== anotherAccount);
      await assertRevert(this.token.transferOwnership(anotherAccount, {from: anotherAccount}));
    });

    it('should guard ownership against stuck state', async function () {
      let originalOwner = await this.token.owner();
      await assertRevert(this.token.transferOwnership(null, {from: originalOwner}));
    });
  });

  describe('whitelist', function () {

    beforeEach(async function () {
      await this.token.addAddressToWhitelist(recipient, {from: owner});
      assert.isTrue(await this.token.whitelist(recipient));
    });

    context('in normal conditions', function () {
      it('should add address to the whitelist', async function () {
        await expectEvent.inTransaction(
          this.token.addAddressToWhitelist(anotherAccount, {from: owner}),
          'RoleAdded'
        );
        const isWhitelisted = await this.token.whitelist(anotherAccount);
        isWhitelisted.should.be.equal(true);
      });

      it('should add addresses to the whitelist', async function () {
        const whitelistedAddresses = [anotherAccount, extraAccount];
        await expectEvent.inTransaction(
          this.token.addAddressesToWhitelist(whitelistedAddresses, {from: owner}),
          'RoleAdded'
        );
        for (let addr of whitelistedAddresses) {
          const isWhitelisted = await this.token.whitelist(addr);
          isWhitelisted.should.be.equal(true);
        }
      });

      it('should remove address from the whitelist', async function () {
        await expectEvent.inTransaction(
          this.token.removeAddressFromWhitelist(recipient, {from: owner}),
          'RoleRemoved'
        );
        let isWhitelisted = await this.token.whitelist(recipient);
        isWhitelisted.should.be.equal(false);
      });

      it('should remove addresses from the the whitelist', async function () {
        await expectEvent.inTransaction(
          this.token.addAddressToWhitelist(anotherAccount, {from: owner}),
          'RoleAdded'
        );

        const whitelistedAddresses = [recipient, anotherAccount];
        await expectEvent.inTransaction(
          this.token.removeAddressesFromWhitelist(whitelistedAddresses, {from: owner}),
          'RoleRemoved'
        );
        for (let addr of whitelistedAddresses) {
          const isWhitelisted = await this.token.whitelist(addr);
          isWhitelisted.should.be.equal(false);
        }
      });

      it('should allow whitelisted address to call transfer within ICO', async function () {
        // ensure owner has 1 token
        await this.token.mint(owner, 1, {from: owner});

        await this.token.transfer(recipient, 1, {from: owner}).should.be.fulfilled;

        await this.token.addAddressToWhitelist(recipient, {from: owner});
        await this.token.transfer(anotherAccount, 1, {from: recipient}).should.be.fulfilled;
      });

      it('should allow whitelisted address to call transferFrom within ICO', async function () {
        // ensure owner has 1 token
        await this.token.mint(owner, 1, {from: owner});
        await this.token.transfer(recipient, 1, {from: owner}).should.be.fulfilled;

        await this.token.approve(anotherAccount, 1, {from: recipient});

        await this.token.addAddressToWhitelist(recipient, {from: owner});
        await this.token.transferFrom(recipient, anotherAccount, 1, {from: anotherAccount}).should.be.fulfilled;
      });
    });

    context('in adversarial conditions', function () {
      it('should not allow "anyone" to add to the whitelist', async function () {
        await assertRevert(this.token.addAddressToWhitelist(recipient, {from: recipient}));
      });

      it('should not allow "anyone" to remove from the whitelist', async function () {
        await assertRevert(this.token.removeAddressFromWhitelist(owner, {from: recipient}));
      });

      it('should not allow "anyone" to call transfer within ICOs', async function () {
        await assertRevert(this.token.transfer(anotherAccount, 1, ({from: recipient})));
      });
    });

    context('minting conditions', function () {
      it('should allow owner to mint as automatically whitelisted', async function () {
        let totalBalance = await this.token.totalSupply();
        await this.token.mint(anotherAccount, 1, {from: owner});
        let newTotalBalance = await this.token.totalSupply();
        newTotalBalance.should.be.bignumber.equal(totalBalance.plus(1));
      });

      it('should allow owner to whitelist to allow minting', async function () {
        let totalBalance = await this.token.totalSupply();

        await assertRevert(this.token.mint(anotherAccount, 1, {from: extraAccount}));

        await this.token.addAddressToWhitelist(extraAccount, {from: owner});

        await this.token.mint(anotherAccount, 1, {from: extraAccount});

        let newTotalBalance = await this.token.totalSupply();
        newTotalBalance.should.be.bignumber.equal(totalBalance.plus(1));
      });
    });
  });

  describe('locks transfers', function () {
    it('should not allow unwhitelisted transfer if not enabled', async function () {
      const enabled = await this.token.transfersEnabled();
      assert.isFalse(enabled);

      await this.token.mint(anotherAccount, 1, {from: owner});
      await assertRevert(this.token.transfer(owner, 1, ({from: anotherAccount})));
    });

    it('should allow unwhitelisted transfer if enabled', async function () {
      let enabled = await this.token.transfersEnabled();
      assert.isFalse(enabled);

      await this.token.enableTransfers({from: owner});
      enabled = await this.token.transfersEnabled();
      assert.isTrue(enabled);

      await this.token.mint(anotherAccount, 1, {from: owner});
      await this.token.transfer(owner, 1, ({from: anotherAccount})).should.be.fulfilled;
    });

    it('should not allow unwhitelisted transferFrom if not enabled', async function () {
      const enabled = await this.token.transfersEnabled();
      assert.isFalse(enabled);

      await this.token.mint(anotherAccount, 1, {from: owner});
      await this.token.approve(recipient, 1, {from: anotherAccount});

      await assertRevert(this.token.transferFrom(anotherAccount, recipient, 1, ({from: recipient})));
    });

    it('should allow unwhitelisted transferFrom if enabled', async function () {
      let enabled = await this.token.transfersEnabled();
      assert.isFalse(enabled);

      await this.token.enableTransfers({from: owner});
      enabled = await this.token.transfersEnabled();
      assert.isTrue(enabled);

      await this.token.mint(anotherAccount, 1, {from: owner});
      await this.token.approve(recipient, 1, {from: anotherAccount});

      await this.token.transferFrom(anotherAccount, recipient, 1, ({from: recipient})).should.be.fulfilled;
    });

    it('should allow unwhitelisted transfer before unlocked time', async function () {

      // whitelist recipient
      await this.token.addAddressToWhitelist(recipient, {from: owner});
      assert.isTrue(await this.token.whitelist(recipient));

      await this.token.mint(owner, 1, {from: owner});
      await this.token.transfer(recipient, 1, {from: owner}).should.be.fulfilled;
      await this.token.transfer(anotherAccount, 1, ({from: recipient})).should.be.fulfilled;
    });

    describe('only owner can enable / disable transfers', function () {
      it('should allow owner to enable', async function () {
        let enabled = await this.token.transfersEnabled();
        assert.isFalse(enabled);

        await this.token.enableTransfers({from: owner});

        enabled = await this.token.transfersEnabled();
        assert.isTrue(enabled);
      });

      it('should fail if not called by owner', async function () {
        await assertRevert(this.token.enableTransfers({from: anotherAccount}));
      });

      it('should fail if called a seconf time once enabled by owner', async function () {
        await this.token.enableTransfers({from: owner}).should.be.fulfilled;
        let enabled = await this.token.transfersEnabled();
        assert.isTrue(enabled);

        await assertRevert(this.token.enableTransfers({from: owner}));
      });
    });
  });

  describe('balanceOf', function () {
    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        const balance = await this.token.balanceOf(anotherAccount);

        balance.should.be.bignumber.equal(0);
      });
    });

    describe('when the requested account has some tokens', function () {
      it('returns the total amount of tokens', async function () {
        const balance = await this.token.balanceOf(owner);

        balance.should.be.bignumber.equal(TOTAl_AMOUNT_OF_TOKENS);
      });
    });
  });

  describe('transfer', function () {
    describe('when the recipient is not the zero address', function () {
      const to = recipient;

      describe('when the sender does not have enough balance', function () {
        const amount = TOTAl_AMOUNT_OF_TOKENS.plus(1);

        it('reverts', async function () {
          await assertRevert(this.token.transfer(to, amount, {from: owner}));
        });
      });

      describe('when the sender has enough balance', function () {
        it('transfers the requested amount', async function () {
          await this.token.mint(owner, 1, {from: owner});
          await this.token.transfer(to, 1, {from: owner});

          const senderBalance = await this.token.balanceOf(owner);
          senderBalance.should.be.bignumber.equal(0);

          const recipientBalance = await this.token.balanceOf(to);
          recipientBalance.should.be.bignumber.equal(1);
        });

        it('emits a transfer event', async function () {
          const {logs} = await this.token.transfer(to, TOTAl_AMOUNT_OF_TOKENS, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Transfer');
          assert.equal(logs[0].args.from, owner);
          assert.equal(logs[0].args.to, to);
          assert(logs[0].args.value.eq(TOTAl_AMOUNT_OF_TOKENS));
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      const to = ZERO_ADDRESS;

      it('reverts', async function () {
        await assertRevert(this.token.transfer(to, 100, {from: owner}));
      });
    });
  });

  describe('approve', function () {
    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        const amount = TOTAl_AMOUNT_OF_TOKENS;

        it('emits an approval event', async function () {
          const {logs} = await this.token.approve(spender, amount, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.approve(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, {from: owner});
          });

          it('approves the requested amount and replaces the previous one', async function () {
            await this.token.approve(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount);
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = TOTAl_AMOUNT_OF_TOKENS.plus(1);

        it('emits an approval event', async function () {
          const {logs} = await this.token.approve(spender, amount, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.approve(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, {from: owner});
          });

          it('approves the requested amount and replaces the previous one', async function () {
            await this.token.approve(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount);
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const amount = TOTAl_AMOUNT_OF_TOKENS;
      const spender = ZERO_ADDRESS;

      it('approves the requested amount', async function () {
        await this.token.approve(spender, amount, {from: owner});

        const allowance = await this.token.allowance(owner, spender);
        allowance.should.be.bignumber.equal(amount);
      });

      it('emits an approval event', async function () {
        const {logs} = await this.token.approve(spender, amount, {from: owner});

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Approval');
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(logs[0].args.value.eq(amount));
      });
    });
  });

  describe('transfer from', function () {
    const spender = recipient;

    beforeEach(async function () {
      await this.token.addAddressToWhitelist(recipient, {from: owner});
      assert.isTrue(await this.token.whitelist(recipient));
    });

    describe('when the recipient is not the zero address', function () {
      const to = anotherAccount;

      describe('when the spender has enough approved balance', function () {
        beforeEach(async function () {
          await this.token.mint(owner, 1, {from: owner});
          await this.token.approve(spender, 1, {from: owner});
        });

        describe('when the owner has enough balance', function () {
          const amount = 1;

          it('transfers the requested amount', async function () {
            await this.token.transferFrom(owner, to, amount, {from: spender});

            const senderBalance = await this.token.balanceOf(owner);
            senderBalance.should.be.bignumber.equal(0);

            const recipientBalance = await this.token.balanceOf(to);
            recipientBalance.should.be.bignumber.equal(amount);
          });

          it('decreases the spender allowance', async function () {
            await this.token.transferFrom(owner, to, amount, {from: spender});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(0);
          });

          it('emits a transfer event', async function () {
            const {logs} = await this.token.transferFrom(owner, to, amount, {from: spender});

            assert.equal(logs.length, 1);
            assert.equal(logs[0].event, 'Transfer');
            assert.equal(logs[0].args.from, owner);
            assert.equal(logs[0].args.to, to);
            assert(logs[0].args.value.eq(amount));
          });
        });

        describe('when the owner does not have enough balance', function () {
          const amount = 2; // 1 balance (from minting)

          it('reverts', async function () {
            await assertRevert(this.token.transferFrom(owner, to, amount, {from: spender}));
          });
        });
      });

      describe('when the spender does not have enough approved balance', function () {
        beforeEach(async function () {
          await this.token.approve(spender, 99, {from: owner});
        });

        describe('when the owner has enough balance', function () {
          const amount = 100; // 1 more than 99 approved

          it('reverts', async function () {
            await assertRevert(this.token.transferFrom(owner, to, amount, {from: spender}));
          });
        });

        describe('when the owner does not have enough balance', function () {
          const amount = 2; // 1 balance (from minting)

          it('reverts', async function () {
            await assertRevert(this.token.transferFrom(owner, to, amount, {from: spender}));
          });
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      const amount = TOTAl_AMOUNT_OF_TOKENS;
      const to = ZERO_ADDRESS;

      beforeEach(async function () {
        await this.token.approve(spender, amount, {from: owner});
      });

      it('reverts', async function () {
        await assertRevert(this.token.transferFrom(owner, to, amount, {from: spender}));
      });
    });
  });

  describe('decrease approval', function () {
    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        const amount = TOTAl_AMOUNT_OF_TOKENS;

        it('emits an approval event', async function () {
          const {logs} = await this.token.decreaseApproval(spender, amount, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(0));
        });

        describe('when there was no approved amount before', function () {
          it('keeps the allowance to zero', async function () {
            await this.token.decreaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(0);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, amount.plus(1), {from: owner});
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await this.token.decreaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(1);
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = TOTAl_AMOUNT_OF_TOKENS.plus(1);

        it('emits an approval event', async function () {
          const {logs} = await this.token.decreaseApproval(spender, amount, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(0));
        });

        describe('when there was no approved amount before', function () {
          it('keeps the allowance to zero', async function () {
            await this.token.decreaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            assert.equal(allowance, 0);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, amount.plus(1), {from: owner});
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await this.token.decreaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(1);
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const amount = TOTAl_AMOUNT_OF_TOKENS;
      const spender = ZERO_ADDRESS;

      it('decreases the requested amount', async function () {
        await this.token.decreaseApproval(spender, amount, {from: owner});

        const allowance = await this.token.allowance(owner, spender);
        allowance.should.be.bignumber.equal(0);
      });

      it('emits an approval event', async function () {
        const {logs} = await this.token.decreaseApproval(spender, amount, {from: owner});

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Approval');
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(logs[0].args.value.eq(0));
      });
    });
  });

  describe('increase approval', function () {
    const amount = TOTAl_AMOUNT_OF_TOKENS;

    describe('when the spender is not the zero address', function () {
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        it('emits an approval event', async function () {
          const {logs} = await this.token.increaseApproval(spender, amount, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, {from: owner});
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount.plus(1));
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = TOTAl_AMOUNT_OF_TOKENS.plus(1);

        it('emits an approval event', async function () {
          const {logs} = await this.token.increaseApproval(spender, amount, {from: owner});

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, owner);
          assert.equal(logs[0].args.spender, spender);
          assert(logs[0].args.value.eq(amount));
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, 1, {from: owner});
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await this.token.increaseApproval(spender, amount, {from: owner});

            const allowance = await this.token.allowance(owner, spender);
            allowance.should.be.bignumber.equal(amount.plus(1));
          });
        });
      });
    });

    describe('when the spender is the zero address', function () {
      const spender = ZERO_ADDRESS;

      it('approves the requested amount', async function () {
        await this.token.increaseApproval(spender, amount, {from: owner});

        const allowance = await this.token.allowance(owner, spender);
        allowance.should.be.bignumber.equal(amount);
      });

      it('emits an approval event', async function () {
        const {logs} = await this.token.increaseApproval(spender, amount, {from: owner});

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Approval');
        assert.equal(logs[0].args.owner, owner);
        assert.equal(logs[0].args.spender, spender);
        assert(logs[0].args.value.eq(amount));
      });
    });

    describe('as a basic mintable token', function () {
      describe('after token creation', function () {
        it('sender should be token owner', async function () {
          const tokenOwner = await this.token.owner({from: owner});
          tokenOwner.should.equal(owner);
        });
      });

      describe('mint', function () {
        const amount = 100;

        describe('when the sender has the minting permission', function () {
          const from = owner;

          describe('when the token minting is not finished', function () {
            it('mints the requested amount', async function () {
              await this.token.mint(owner, amount, {from});

              const balance = await this.token.balanceOf(owner);
              balance.should.be.bignumber.equal(amount);
            });

            it('emits a mint and a transfer event', async function () {
              const {logs} = await this.token.mint(owner, amount, {from});

              assert.equal(logs.length, 2);
              assert.equal(logs[0].event, 'Mint');
              assert.equal(logs[0].args.to, owner);
              assert.equal(logs[0].args.amount, amount);
              assert.equal(logs[1].event, 'Transfer');
            });
          });
        });

        describe('when the sender has not the minting permission', function () {
          const from = anotherAccount;

          describe('when the token minting is not finished', function () {
            it('reverts', async function () {
              await assertRevert(this.token.mint(owner, amount, {from}));
            });
          });
        });
      });

      describe('burn', function () {

        const initialBalance = 1000;

        beforeEach(async function () {
          await this.token.mint(owner, initialBalance, {from: owner});
        });

        describe('when the given amount is not greater than balance of the sender', function () {

          const amount = 100;

          beforeEach(async function () {
            ({logs: this.logs} = await this.token.burn(amount, {from: owner}));
          });

          it('burns the requested amount', async function () {
            const balance = await this.token.balanceOf(owner);
            balance.should.be.bignumber.equal(initialBalance - amount);
          });

          it('emits a burn event', async function () {
            const event = this.logs.find(e => e.event === 'Burn');
            event.args.burner.should.eq(owner);
            event.args.value.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
            const event = this.logs.find(e => e.event === 'Transfer');
            event.args.from.should.eq(owner);
            event.args.to.should.eq(ZERO_ADDRESS);
            event.args.value.should.be.bignumber.equal(amount);
          });
        });

        describe('when the given amount is greater than the balance of the sender', function () {
          const amount = initialBalance + 1;

          it('reverts', async function () {
            await assertRevert(this.token.burn(amount, {from: owner}));
          });
        });
      });

      describe('burnFrom', function () {

        const initialBalance = 1000;

        beforeEach(async function () {
          await this.token.mint(owner, initialBalance, {from: owner});
        });

        describe('on success', function () {
          const amount = 100;

          beforeEach(async function () {
            await this.token.approve(recipient, 300, {from: owner});
            const {logs} = await this.token.burnFrom(owner, amount, {from: recipient});
            this.logs = logs;
          });

          it('burns the requested amount', async function () {
            const balance = await this.token.balanceOf(owner);
            balance.should.be.bignumber.equal(initialBalance - amount);
          });

          it('decrements allowance', async function () {
            const allowance = await this.token.allowance(owner, recipient);
            allowance.should.be.bignumber.equal(200);
          });

          it('emits a burn event', async function () {
            const event = this.logs.find(e => e.event === 'Burn');
            event.args.burner.should.eq(owner);
            event.args.value.should.be.bignumber.equal(amount);
          });

          it('emits a transfer event', async function () {
            const event = this.logs.find(e => e.event === 'Transfer');
            event.args.from.should.eq(owner);
            event.args.to.should.eq(ZERO_ADDRESS);
            event.args.value.should.be.bignumber.equal(amount);
          });
        });

        describe('when the given amount is greater than the balance of the sender', function () {
          const amount = initialBalance + 1;
          it('reverts', async function () {
            await this.token.approve(recipient, amount, {from: owner});
            await assertRevert(this.token.burnFrom(owner, amount, {from: recipient}));
          });
        });

        describe('when the given amount is greater than the allowance', function () {
          const amount = 100;
          it('reverts', async function () {
            await this.token.approve(recipient, amount - 1, {from: owner});
            await assertRevert(this.token.burnFrom(owner, amount, {from: recipient}));
          });
        });
      });

      describe('founders', function () {

        const initialBalance = 1000;

        beforeEach(async function () {
          // must be added to founder list
          await this.token.addAddressToFounders(founder, {from: owner});
          let isFounder = await this.token.founders(founder, {from: owner});
          assert.isTrue(isFounder);

          await this.token.mint(founder, initialBalance, {from: owner});
          await this.token.approve(extraAccount, initialBalance, {from: founder});

          await this.token.mint(anotherAccount, initialBalance, {from: owner});

          await this.token.enableTransfers({from: owner});
          enabled = await this.token.transfersEnabled();
          assert.isTrue(enabled);
        });

        describe('have tokens locked for x years after ICO closing date', function () {
          beforeEach(async function () {});

          it('can not transfer as before founderTokensLockedUntil timestamp', async function () {
            await assertRevert(this.token.transfer(owner, initialBalance, {from: founder}));
          });

          it('can not transferFrom as before founderTokensLockedUntil timestamp', async function () {
            await assertRevert(this.token.transferFrom(founder, extraAccount, initialBalance, {from: extraAccount}));
          });

          it('can transfer as before founderTokensLockedUntil timestamp BUT to investx platform', async function () {
            await assertRevert(this.token.transfer(owner, initialBalance, {from: founder}));

            await this.token.setInvestxPlatform(ONE_ADDRESS, {from: owner});
            const investxPlatform = await this.token.investxPlatform();

            await this.token.transfer(investxPlatform, initialBalance, {from: founder}).should.be.fulfilled;
          });

          it('can transferFrom as before founderTokensLockedUntil timestamp BUT to investx platform', async function () {
            await assertRevert(this.token.transferFrom(founder, owner, initialBalance, {from: extraAccount}));

            await this.token.setInvestxPlatform(ONE_ADDRESS, {from: owner});
            const investxPlatform = await this.token.investxPlatform();

            await this.token.transferFrom(founder, investxPlatform, initialBalance, {from: extraAccount}).should.be.fulfilled;
          });

          it('can not transfer as before founderTokensLockedUntil timestamp and transfer to is still zero address', async function () {
            await assertRevert(this.token.transfer(owner, initialBalance, {from: founder}));

            const investxPlatform = await this.token.investxPlatform();
            await assertRevert(this.token.transfer(investxPlatform, initialBalance, {from: founder}));
          });

          it('can not transferFrom as before founderTokensLockedUntil timestamp and transfer to is still zero address', async function () {
            await assertRevert(this.token.transferFrom(founder, owner, initialBalance, {from: extraAccount}));

            const investxPlatform = await this.token.investxPlatform();
            await assertRevert(this.token.transferFrom(founder, investxPlatform, initialBalance, {from: extraAccount}));
          });

          it('can transfer as not founder', async function () {
            await this.token.transfer(owner, initialBalance, {from: anotherAccount}).should.be.fulfilled;
          });

          it('can transferFrom as not founder', async function () {
            await this.token.approve(extraAccount, initialBalance, {from: anotherAccount});
            await this.token.transferFrom(anotherAccount, owner, initialBalance, {from: extraAccount}).should.be.fulfilled;
          });

          it('can not set investx platform to zero address', async function () {
            await assertRevert(this.token.setInvestxPlatform(ZERO_ADDRESS, {from: owner}));
          });

          it('can not add founder as zero address', async function () {
            await assertRevert(this.token.addAddressToFounders(ZERO_ADDRESS, {from: owner}));
          });

          it('can transfer as after founderTokensLockedUntil timestamp', async function () {
            const lockedUntil = await this.token.founderTokensLockedUntil();

            // force time to move on to just after locked time - after 29th Feb 2020
            await increaseTimeTo(lockedUntil + duration.seconds(300));

            await this.token.transfer(owner, initialBalance, {from: founder}).should.be.fulfilled;
          });

          it('can transferFrom as after founderTokensLockedUntil timestamp', async function () {
            const lockedUntil = await this.token.founderTokensLockedUntil();

            // force time to move on to just after locked time - after 29th Feb 2020
            await increaseTimeTo(lockedUntil + duration.seconds(300));

            await this.token.transferFrom(founder, owner, initialBalance, {from: extraAccount}).should.be.fulfilled;
          });
        });
      });
    });
  });
});
