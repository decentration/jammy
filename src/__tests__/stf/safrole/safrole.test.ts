import path from "path";
import { SafroleStf } from "../../../stf/safrole/types";
import { SafroleStfCodec } from "../../../stf/safrole/codecs/SafroleStfCodec";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

const testFiles = [
"enact-epoch-change-with-no-tickets-1",
"enact-epoch-change-with-no-tickets-2",
"enact-epoch-change-with-no-tickets-3",
"enact-epoch-change-with-no-tickets-4",
"enact-epoch-change-with-padding-1",
"publish-tickets-no-mark-1",
"publish-tickets-no-mark-2",
"publish-tickets-no-mark-3",
"publish-tickets-no-mark-4",
"publish-tickets-no-mark-5",
"publish-tickets-no-mark-6",
"publish-tickets-no-mark-7",
"publish-tickets-no-mark-8",
"publish-tickets-no-mark-9",
"publish-tickets-with-mark-1",
"publish-tickets-with-mark-2",
"publish-tickets-with-mark-3",
"publish-tickets-with-mark-4",
"publish-tickets-with-mark-5",
"skip-epoch-tail-1",
"skip-epochs-1"
];

const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/safrole", CHAIN_TYPE);
const outDir = path.resolve(__dirname, "../../output/stf/safrole");

createCodecTestSuite<SafroleStf>(
  SafroleStfCodec,         // codec
  "Safrole",               // friendly name
  testVectorsDir,          // directory containing /.bin
  outDir,                  // debug output dir
  testFiles,               // basenames (without extension)
);