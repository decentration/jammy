import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Assurance, AssuranceCodec } from '../block/types';
import { DiscriminatorCodec } from './DiscriminatorCodec';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [AssuranceSequenceEnc, AssuranceSequenceDec] = DiscriminatorCodec(AssuranceCodec);

const assurancesJsonPath = path.resolve(__dirname, '../data/assurances_extrinsic.json');
const assurancesJson = JSON.parse(readFileSync(assurancesJsonPath, 'utf-8'));

const assurances: Assurance[] = assurancesJson.map((a: any) => ({
  anchor: Uint8Array.from(Buffer.from(a.anchor.slice(2), 'hex')),
  bitfield: Uint8Array.from(Buffer.from(a.bitfield.slice(2), 'hex')),
  validator_index: a.validator_index,
  signature: Uint8Array.from(Buffer.from(a.signature.slice(2), 'hex')),
}));

const encoded = AssuranceSequenceEnc(assurances);
writeFileSync('assurances_extrinsic2.bin', Buffer.from(encoded));

console.log('Encoded assurances_extrinsic.bin successfully.');
