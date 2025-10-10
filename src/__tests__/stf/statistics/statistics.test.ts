import path from "path";
import { StatsStf } from "../../../stf/statistics/types";
import { StatsStfCodec } from "../../../stf/statistics/codecs/StatsStfCodec";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

const testFiles = [
  "stats_with_empty_extrinsic-1",
  "stats_with_epoch_change-1",
  "stats_with_some_extrinsic-1",
];


const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/statistics", CHAIN_TYPE);
const outDir = path.resolve(__dirname, "../../output/stf/statistics");

createCodecTestSuite<StatsStf>(
  StatsStfCodec,          // codec under test
  "StatsStf",             // friendly name
  testVectorsDir,         // vectors dir (no extension)
  outDir,                 // debug output dir
  testFiles,              // basenames
);
