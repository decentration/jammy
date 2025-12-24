import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function hexToBin(inputHexPath: string, outputBinPath: string) {
  const hex = readFileSync(inputHexPath, "utf8")
    .replace(/[^0-9a-fA-F]/g, "") // strip newlines / spaces
    .trim();

  if (hex.length % 2 !== 0) {
    throw new Error(`Hex length must be even, got ${hex.length}`);
  }

  const buf = Buffer.from(hex, "hex");
  writeFileSync(outputBinPath, new Uint8Array(buf));
  console.log(`Wrote ${buf.length} bytes to ${outputBinPath}`);
}

// usage: ts-node scripts/hex2bin.ts
const inPath  = resolve(__dirname, "../external/jam-test-vectors/stf/accumulate/tiny/blob-a.hex");
const outPath = resolve(__dirname, "../external/jam-test-vectors/stf/accumulate/tiny/blob-a.bin");
hexToBin(inPath, outPath);