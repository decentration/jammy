# jammy
An implementation of the JAM protocol

# M1
1. Block/header data structures and serialization
2. State data structures and serialization
3. In-memory DB and Merklization
4. Non-PVM block execution/state-transition
5. PVM instancing, execution and host-functions
6. Block-import tests


After cloning this repo you need to make sure the submodules are accessible:

## Test suite

To connect to the conformance test vectors (in other repositories) we need to connect git submodules.

run: 

`git submodule sync --recursive` 
`git submodule update --init --recursive`

But if that does not populate the external directory with the all the required submodules then you can do it like this:


```bash
git submodule add https://github.com/jam-duna/jamtestnet.git external/jam-duna-testnet

git submodule add https://github.com/davxy/jam-test-vectors.git external/jam-test-vectors

git commit -m "Add jam-test-vectors and jam-duna-testnet submodule"

git submodule update --init --recursive
```



# To update later on:



```bash
## Jam Test Vectors
cd external/jam-test-vectors
git fetch origin 
git pull origin polkajam-vectors
cd ../..
git commit -am "Update jam-test-vectors to latest"
```


```bash
## Jam Duna jamtestnet
cd external/jam-duna-jamtestnet
git fetch origin 
git pull origin main
cd ../..
git commit -am "Update jam duna to latest"
```


# Install FFIs

```bash
git submodule add https://github.com/decentration/ring-vrf.git /ring-vrf

git commit -m "Add ring-vrf FFI submodule"

```

To update later:

```bash
## ring-vrf FFI
cd ring-vrf
git pull origin main 
cd ..
git commit -am "Update ring-vrf to latest"
```



## Install

```bash

// if you dont have bun already installed.
curl -fsSL https://bun.sh/install | bash

// if the paths are not already added
BUN_INSTALL=/root/.bun
PATH=$BUN_INSTALL/bin:$PATH

// upgrade bun
bun upgrade

// install the package.json packages.
bun install
```

## Run

To run script in the command line, use: 

``` bash
bun ./src/... 
```

## Run tests

- Switch between chain types
To switch from `tiny` to `full`, go to `./src/consts/chainType` and change the `CHAIN_TYPE`.

- **To run all tests run:**
```
bun test
```

- **To run specific tests:**
```bash
bun test ./{PATH TO FILE NAME}
```

Conformance Tests

To run STF tests at the same time:

```bash
bun test ./src/__tests__/stf/conformance/safroleConformance.test.ts ./src/__tests__/stf/conformance/reportsConformance.test.ts ./src/__tests__/stf/conformance/disputesConformance.test.ts ./src/__tests__/stf/conformance/assurancesConformance.test.ts ./src/__tests__/stf/conformance/authorizationsConformance.test.ts ./src/__tests__/stf/conformance/historyConformance.test.ts ./src/__tests__/stf/conformance/statisticsConformance.test.ts
```







