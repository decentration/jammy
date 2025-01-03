import { Codec } from 'scale-ts';
import { BetaItem, MMR } from '../../types'; // Update paths as necessary
import { MMRCodec, WorkPackagesCodec } from './'; 
import { decodeWithBytesUsed } from '../../../codecs';   

export const BetaItemCodec: Codec<BetaItem> = [
  // ENCODER
  (beta: BetaItem): Uint8Array => {
    const encHeaderHash = new Uint8Array(beta.header_hash);
    const encMMR = MMRCodec.enc(beta.mmr);
    const encStateRoot = new Uint8Array(beta.state_root);
    const encReported = WorkPackagesCodec.enc(beta.reported);

    const totalSize = 
      encHeaderHash.length +
      encMMR.length +
      encStateRoot.length +
      encReported.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encHeaderHash, offset);   offset += encHeaderHash.length;
    out.set(encMMR, offset);         offset += encMMR.length;
    out.set(encStateRoot, offset);   offset += encStateRoot.length;
    out.set(encReported, offset);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): BetaItem => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // a) Decode header_hash
    if (offset + 32 > uint8.length) {
      throw new Error("BetaItemCodec: not enough data for header_hash");
    }
    const header_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // b) Decode MMR
    const { value: mmr, bytesUsed: mmrBytesUsed } = decodeWithBytesUsed(
      MMRCodec,
      uint8.slice(offset)
    );
    offset += mmrBytesUsed;

    // c) Decode state_root
    if (offset + 32 > uint8.length) {
      throw new Error("BetaItemCodec: not enough data for state_root");
    }
    const state_root = uint8.slice(offset, offset + 32);
    offset += 32;

    // d) Decode reported (WorkPackages array)
    const { value: reported, bytesUsed: reportedBytesUsed } = decodeWithBytesUsed(
      WorkPackagesCodec,
      uint8.slice(offset)
    );
    offset += reportedBytesUsed;

    return {
      header_hash,
      mmr,
      state_root,
      reported,
    };
  },
] as unknown as Codec<BetaItem>;

BetaItemCodec.enc = BetaItemCodec[0];
BetaItemCodec.dec = BetaItemCodec[1];
