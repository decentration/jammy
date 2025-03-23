# jammy
An implementation of the JAM protocol

# M1
1. Block/header data structures and serialization
2. State data structures and serialization
3. In-memory DB and Merklization
4. Non-PVM block execution/state-transition
5. PVM instancing, execution and host-functions
6. Block-import tests


To run script in the command line, use: 

``` 
npx tsx ./src/... 
```


After cloning this repo you need to make sure the submodules are accessible:

## After cloning the main repo
```
git submodule update --init --recursive
```

# To update later on:

```
## ring-vrf FFI
cd ring-vrf
git pull origin main 
cd ..
git commit -am "Update ring-vrf to latest"
```

```
## Jam Test Vectors
cd external/jam-test-vectors
git pull origin main
cd ../..
git commit -am "Update jam-test-vectors to latest"
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



