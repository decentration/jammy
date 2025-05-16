import fs from "fs";
import path from "path";
import { toHex, toHexToggle } from "../../utils";
import { hexStringToBytes, toUint8Array } from "../../codecs";
import { ArrayOfTuples, buildTrieRoot } from "../../state/trie/builder";
import { createMemTrieDB, MemTrieDB } from "../../state/trie/mem_store";
import { JAM_TEST_VECTORS } from "../../consts";


describe("Patriciia Merkle trie vectors", () => {

  it("conforms to trie vector", () => {
      const vec = JSON.parse(fs.readFileSync(path.join(__dirname, `../../../${JAM_TEST_VECTORS}/trie`, "trie.json"), "utf8"));
      
      // deconstruct input and output from vec and go through each test 
      for (const {input, output} of vec) {

        // teh key value pairs object are entries mapped to ArrayOfTuples
        const kvs = Object.entries(input).map(([k, v]) => [
          hexStringToBytes(k),
          hexStringToBytes(v as string),
        ]) as ArrayOfTuples;
      

        const db   = createMemTrieDB();

        // build the trie root
        const root = buildTrieRoot(db, kvs);
        expect(toHexToggle(root)).toBe(output);
        console.log("root", toHex(root));
        console.log("db", db);
          
      }
  });
});
