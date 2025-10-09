import path from "path";
import { History } from "../../../stf/types";
import { HistoryCodec } from "../../../stf/history/codecs";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";
// import fs from "fs";

// const dir = path.join(JAM_TEST_VECTORS, "stf/history", CHAIN_TYPE);
// const testFiles = fs.readdirSync(dir)
//   .filter(f => f.endsWith(".json"))
//   .map(f => f.replace(/\.json$/, ""))
//   .sort();


const testFiles = [
  "progress_blocks_history-1",
  "progress_blocks_history-2",
  "progress_blocks_history-3",
  "progress_blocks_history-4",
 
];



const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/history", CHAIN_TYPE);
const outDir = path.resolve(__dirname, "../../output/stf/history");

createCodecTestSuite<History>(
  HistoryCodec,       // codec under test
  "History",          // friendly name
  testVectorsDir,     // vectors dir (no filename/ext)
  outDir,             // debug output dir
  testFiles,          // basenames without extension
);