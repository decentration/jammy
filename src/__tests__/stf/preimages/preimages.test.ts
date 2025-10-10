import path from "path";
import { PreimagesStf } from "../../../stf/preimages/types";
import { PreimagesStfCodec } from "../../../stf/preimages/codecs/PreimagesStfCodec";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

const testFiles = [
  "preimage_needed-1",
  "preimage_needed-2",
  "preimage_not_needed-1",
  "preimage_not_needed-2",
  "preimages_order_check-1",
  "preimages_order_check-2",
  "preimages_order_check-3",
  "preimages_order_check-4",
];

const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/preimages", CHAIN_TYPE);

const outDir = path.resolve(__dirname, "../../output/stf/preimages");

createCodecTestSuite<PreimagesStf>(
  PreimagesStfCodec,     // codec
  "Preimages",           // friendly name in test output
  testVectorsDir,        // directory (no extension)
  outDir,                // debug out dir
  testFiles,             // basenames
);
