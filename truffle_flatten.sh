#!/usr/bin/env bash

node ./node_modules/.bin/truffle-flattener ./contracts/inx/INXCrowdsale.sol > ./contracts-flat/FLAT-INXCrowdsale.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/inx/INXToken.sol > ./contracts-flat/FLAT-INXToken.sol;

node ./node_modules/.bin/truffle-flattener ./contracts/inx/INXCommitment.sol > ./contracts-flat/FLAT-INXCommitment.sol;

echo "flattened..."