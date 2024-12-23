# jammy
An implementation of the JAM protocol


1. Block/header data structures and serialization
2. State data structures and serialization
3. In-memory DB and Merklization
4. Non-PVM block execution/state-transition
5. PVM instancing, execution and host-functions
6. Block-import tests

Reading for 1: 4.0, 5.0, 10.3, etc. 

From 4.1:

# The Block


(13) B≡(H,E)
(14) E≡(ET,ED,EP,EA,EG)


- **tickets:** Tickets, used for the mechanism which manages the selection of validators for the permissioning of block authoring. This component is denoted ET.
- **judgements:** Votes, by validators, on dispute(s) arising between them presently taking place. This is denoted ED. 
- **preimages:** Static data which is presently being requested to be available for workloads to be able to fetch on demand. This is denoted EP. 
- **availability:** Assurances by each validator concerning which of the input data of workloads they have correctly received and are storing locally. This is denoted EA. 
- **reports:** Reports of newly completed workloads whose accuracy is guaranteed by specific validators. This is denoted EG.


Notes 

use npx tsx ./src/... to run script in the command line. 