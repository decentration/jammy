import fs from "fs";
import path from "path";
import { hexStringToBytes } from "../../codecs/utils";
import { getPermutation } from "../../shuffle"; 
describe("Shuffle test vectors from shuffle-tests.json", () => {
    const filePath = path.join(__dirname, "../../data/shuffle/shuffle-tests.json");

    let testVectors: Array<{ input: number; entropy: string; output: number[] }> = [];

    const raw = fs.readFileSync(filePath, "utf-8");
        testVectors = JSON.parse(raw);
        console.log("Loaded test vectors:", testVectors.length);


    testVectors.forEach((tc, idx) => {
        it(`should match shuffle output for test #${idx} (n=${tc.input})`, () => {
            console.log(`Running test #${idx} with input=${tc.input}, entropy=${tc.entropy}`);

            const seedBytes = hexStringToBytes(tc.entropy);

            console.log("seedBytes", seedBytes, tc, idx);

            const finalPermutation = getPermutation(seedBytes, tc.input );
            expect(finalPermutation).toEqual(tc.output);
        });
    });
});
