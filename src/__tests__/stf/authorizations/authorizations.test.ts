import path from "path";
import { Authorizations } from "../../../stf/authorizations/types";
import { AuthorizationsCodec } from "../../../stf/authorizations/codecs/AuthorizationsCodec";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

const testFiles = [
  "progress_authorizations-1",
  "progress_authorizations-2",
  "progress_authorizations-3",
];

const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/authorizations", CHAIN_TYPE);
const outDir = path.resolve(__dirname, "../../output/stf/authorizations");

createCodecTestSuite<Authorizations>(
  AuthorizationsCodec,
  "Authorizations",
  testVectorsDir,
  outDir,
  testFiles,
);