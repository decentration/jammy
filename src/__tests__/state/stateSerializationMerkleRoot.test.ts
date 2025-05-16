import fs from "fs";
import path from "path";
import {  toHexToggle } from "../../utils";
import { deepConvertHexToBytes } from "../../codecs";
import { computeMerkleRoot } from "../../state/commit";

describe("State Serialization and Merkle Root Conformance Tests", () => {

    const testFiles = [
        "empty_state_serialization-1",
    ];

    testFiles.forEach((fileName) => {
        it(`should correctly serialize state and compute Merkle root for ${fileName}`, () => {
            
            // 1) Read JSON test vector from file
            const filePath = path.join(__dirname, `../../data/state`, fileName.concat(".json"));
            const rawJson = fs.readFileSync(filePath, "utf8");
            const testVector = JSON.parse(rawJson);

            // 2) Convert 0x strings -> Uint8Array
            const preState = deepConvertHexToBytes(testVector.pre_state);
            const expectedMerkleRoot = testVector.expected_merkle_root.replace(/^0x/, "");

            // 4): Compute Merkle Root
            const {root: computedRoot} = computeMerkleRoot(preState);
            
            // 5) Verify Merkle Root
            expect(toHexToggle(computedRoot)).toEqual(expectedMerkleRoot);
        });
    });
});