# INX-TOKEN-SALE

## Installation

1. Install [Truffle](http://truffleframework.com) and [NodeJs](https://nodejs.org/en/) (version 8 upwards)
```bash
npm install -g truffle
```
	
2. Install dependencies.
```bash
npm install
```

3. Run tests. *Tests start their own instance of `ganache-cli`*
```bash
npm run test
```

### Code Coverage

* Code coverage performed by [solidity-coverage](https://github.com/sc-forks/solidity-coverage)

* To run code coverage `npm run coverage` - this will produce the following:
 * HTML output in `/coverage`
 * JSON output in `/.coverage.json`
 * Terminal output
 
### Code Linting
 
* Linting performed by [Solium](https://www.npmjs.com/package/solium)

1. Install once with
```bash
npm install -g solium
```

2. Run linter
```bash
npm run lint
```
 
## Token Sale Properties

### INX Token

* Is ERC20 compliant
* Responsible for holding all tokens balances on the INX platform

* The **token** has the following properties
  * Defines a token `name` - `INX Token`
  * Defines a token `symbol` - `INX`
  * Defines the number of `decimals` the token is divisible by - `18`
  * Defines the total supply of tokens - tokens are minted when contributions are made

### INX Crowdsale

* Responsible for managing ICO token sales

* The **crowdsale** has the following properties
  * Ability to specify **min** contributions per address
  * Ability to define a **open and close date** for the full ICO - tokens cannot be bought until the ICO opens (or after close)
  * Ability to transfer ETH **immeadiately** 
  * Ability to define **whitelisted** address for people who are permitted to participate in the crowdsale
    * If not whitelisted the transaction is rejected
    * A third party solution for performing KYC/AML is required, the contract simply stores a map of approved addresses
  * The crowdsale is **pausable** which can stop any more contributors from participating in case of error, fault etc

### Deployment Order

_see `migrations` folder for a more details_

* Deploy `INXToken`

* Deploy `INXCrowdsale`
  * Whitelist the crowdsale account so they can receive tokens e.g. `token.addAddressToWhitelist(INXCrowdsale.address)`
 


