import * as tiny from "./tiny";
import * as full from "./full";

const chainType = process.env.CHAIN_TYPE || "tiny";

let chainExports: typeof tiny | typeof full; 

switch (chainType) {
  case "tiny":
    chainExports = tiny;
    break;
  case "full":
    chainExports = full;
    break;
  default:
    throw new Error(`Unsupported chain type: ${chainType}`);
}

export default chainExports;
