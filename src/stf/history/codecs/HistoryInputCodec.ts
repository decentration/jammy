import { Codec } from 'scale-ts';
import { WorkPackageCodec, WorkPackagesCodec } from './index'; 
import { HistoryInput } from '../../types'; 
import { decodeWithBytesUsed, DiscriminatorCodec } from '../../../codecs';

export const HistoryInputCodec: Codec<HistoryInput> = [
  // ENCODER
  (input: HistoryInput): Uint8Array => {
    const encHeaderHash = new Uint8Array(input.header_hash);
    const encParentStateRoot = new Uint8Array(input.parent_state_root);
    const encAccumulateRoot = new Uint8Array(input.accumulate_root);
    const encWorkPackages = DiscriminatorCodec(WorkPackageCodec).enc(input.work_packages);

    const totalSize =
      encHeaderHash.length +
      encParentStateRoot.length +
      encAccumulateRoot.length +
      encWorkPackages.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encHeaderHash, offset);          offset += encHeaderHash.length;
    out.set(encParentStateRoot, offset);    offset += encParentStateRoot.length;
    out.set(encAccumulateRoot, offset);     offset += encAccumulateRoot.length;
    out.set(encWorkPackages, offset);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): HistoryInput => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    if (offset + 32 > uint8.length) {
      throw new Error("InputCodec: not enough data for header_hash");
    }
    const header_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    if (offset + 32 > uint8.length) {
      throw new Error("InputCodec: not enough data for parent_state_root");
    }
    const parent_state_root = uint8.slice(offset, offset + 32);
    offset += 32;

    if (offset + 32 > uint8.length) {
      throw new Error("InputCodec: not enough data for accumulate_root");
    }
    const accumulate_root = uint8.slice(offset, offset + 32);
    offset += 32;

    const { value: work_packages, bytesUsed } = decodeWithBytesUsed(
      WorkPackagesCodec,
      uint8.slice(offset)
    );
    offset += bytesUsed;

    return {
      header_hash,
      parent_state_root,
      accumulate_root,
      work_packages,
    };
  },
] as unknown as Codec<HistoryInput>;

HistoryInputCodec.enc = HistoryInputCodec[0];
HistoryInputCodec.dec = HistoryInputCodec[1];
