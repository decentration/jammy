import { Codec } from 'scale-ts';
import { WorkPackage } from '../../types';
import { DiscriminatorCodec } from '../../../codecs/DiscriminatorCodec';

export const WorkPackageCodec: Codec<WorkPackage> = [
  // ENCODER
  (wp: WorkPackage): Uint8Array => {
    if (!wp.hash || wp.hash.length !== 32)
      throw new Error(`WorkPackageCodec: "hash" must be 32 bytes.`);
    if (!wp.exports_root || wp.exports_root.length !== 32)
      throw new Error(`WorkPackageCodec: "exports_root" must be 32 bytes.`);

    const out = new Uint8Array(64);
    out.set(wp.hash, 0);
    out.set(wp.exports_root, 32);
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): WorkPackage => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 64)
      throw new Error(`WorkPackageCodec: not enough data (need 64 bytes).`);

    return {
      hash: uint8.slice(0, 32),
      exports_root: uint8.slice(32, 64),
    };
  },
] as unknown as Codec<WorkPackage>;

WorkPackageCodec.enc = WorkPackageCodec[0];
WorkPackageCodec.dec = WorkPackageCodec[1];

export const WorkPackagesCodec: Codec<WorkPackage[]> = DiscriminatorCodec(WorkPackageCodec);
