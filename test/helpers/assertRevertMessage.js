
module.exports = async (promise, message) => {
  try {
    await promise;
    assert.fail('Expected revert not received');
  } catch (err) {
      if (err.reason) {
        err.reason.should.be.equal(message);
      } else {
          assert.fail(`Expected revert message not received: ${message}`);
      }
  }
};
