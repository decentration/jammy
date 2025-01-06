import { Codec } from "scale-ts";
import { AssurancesInput,  } from "../../../types";
import { AssuranceCodec, Assurance } from "../../../../types/types";       
import { decodeWithBytesUsed, DiscriminatorCodec } from "../../../../codecs/";
import { u32, Bytes } from "scale-ts";
// import {AssuranceCodec } from "./AssuranceCodec"

const AssurancesSequenceCodec = DiscriminatorCodec(AssuranceCodec);

export const InputCodec: Codec<AssurancesInput> = [
  // ENCODER
  (input: AssurancesInput): Uint8Array => {
    // a) assurances
    const encAssurances = AssurancesSequenceCodec.enc(input.assurances);

    // b) slot --> 4 bytes LE
    const slotBuf = new Uint8Array(4);
    new DataView(slotBuf.buffer).setUint32(0, input.slot, true);

    // c) parent --> 32 bytes
    if (input.parent.length !== 32) {
      throw new Error(`InputCodec: parent must be 32 bytes`);
    }
    const encParent = input.parent;

    // d) Concatenate
    const totalSize = encAssurances.length + slotBuf.length + encParent.length;
    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encAssurances, offset); offset += encAssurances.length;
    out.set(slotBuf, offset);       offset += slotBuf.length;
    out.set(encParent, offset);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AssurancesInput => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // a) decode assurances
    if (uint8.length < 36) {
      throw new Error(`InputCodec: not enough data, need at least 36 bytes`);
    }
    const boundary = uint8.length - 36;
    const sliceForAssurances = uint8.slice(0, boundary);

    const { value: assurances, bytesUsed } = decodeWithBytesUsed(AssurancesSequenceCodec, sliceForAssurances);
    offset += bytesUsed;

    // b) decode slot --> next 4 bytes
    const slotView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const slot = slotView.getUint32(0, true);
    offset += 4;

    // c) decode parent --> next 32 bytes
    if (offset + 32 > uint8.length) {
      throw new Error(`InputCodec: not enough data for parent (32 bytes)`);
    }
    const parent = uint8.slice(offset, offset + 32);
    offset += 32;

    return { assurances, slot, parent };
  },
] as unknown as Codec<AssurancesInput>;

InputCodec.enc = InputCodec[0];
InputCodec.dec = InputCodec[1];
