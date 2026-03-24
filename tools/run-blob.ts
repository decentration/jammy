import fs from "node:fs";
import { loadBlob } from "../src/risc-pvm/loader/loadBlob";
import { runWithTrace } from "../src/risc-pvm/runner/runWithTrace";

const [, , blobPath, outTrace] = process.argv;
const buf = fs.readFileSync(blobPath);
const { image, hashHex } = loadBlob(new Uint8Array(buf));

const stream = fs.createWriteStream(outTrace, { flags: "w" });
const write = (o: any) => stream.write(JSON.stringify(o) + "\n");

await runWithTrace(image, {
  maxSteps: 10_000_000,
  watch: {
    hostCalls: [],
    pcs: [],
    memRanges: [{ start: 0x10000, end: 0x20000 }],
  },
  filters: {
    regs: [],
    memWrites: true,
    cf: true,
  },
  onEvent: write,
});
stream.end();
console.log(`TRACE OK for ${hashHex}`);
