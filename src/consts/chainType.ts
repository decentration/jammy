import * as tiny from "./tiny";
import * as full from "./full";

// USER/REVIEWER: Please change this constant to switch between "tiny" or "full"
export const CHAIN_TYPE = "tiny";

const chains = { tiny, full };

const chainExports = chains[CHAIN_TYPE];

if (!chainExports) {
  throw new Error(`Unsupported CHAIN_TYPE: ${CHAIN_TYPE}`);
}

export default chainExports;