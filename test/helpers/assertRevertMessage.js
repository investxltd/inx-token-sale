const EVMRevert = 'revert';

module.exports = async (promise, message) => {
  try {
    await promise;
    assert.fail('Expected revert not received');
  } catch (err) {
      if (err.reason) {
        err.reason.should.be.equal(message);
      } else if (err.message) {
          const revertFound = err.message.search(EVMRevert) >= 0;
          assert(revertFound, `Expected "revert", got ${err} instead`);
      } else {
          assert.fail('Expected revert not received');
      }
  }
};
