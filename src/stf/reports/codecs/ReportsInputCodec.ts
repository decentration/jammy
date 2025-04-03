import { Codec } from "scale-ts";
import { decodeWithBytesUsed, DiscriminatorCodec, GuaranteeCodec } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs"; 
import { ReportsInput } from "../types"; 
import { convertToReadableFormat } from "../../../utils";

export const ReportsInputCodec: Codec<ReportsInput> = [
  // --- ENCODER ---
  (input: ReportsInput): Uint8Array => {
    // 1) encode guarantees as a DiscriminatorCodec of GuaranteeCodec
    const encGuarantees = DiscriminatorCodec(GuaranteeCodec).enc(input.guarantees);

    // 2) encode slot as 4 byte LE
    const slotBuf = new Uint8Array(4);
    new DataView(slotBuf.buffer).setUint32(0, input.slot, true);

    const result = concatAll(encGuarantees, slotBuf);
    console.log("ReportsInputCodec: enc", convertToReadableFormat(result));
    // 3) concat
    return concatAll(encGuarantees, slotBuf);
  },

  // --- DECODER ---
  (data: ArrayBuffer | Uint8Array | string): ReportsInput => {
    const uint8 = toUint8Array(data);

    let offset = 0;

    // a) decode the guarantees (DiscriminatorCodec)
    const { value: guarantees, bytesUsed: usedGuarantees } = decodeWithBytesUsed(
      DiscriminatorCodec(GuaranteeCodec),
      uint8.slice(offset)
    );
    offset += usedGuarantees;

    // b) decode slot 4 bytes
    if (offset + 4 > uint8.length) {
      throw new Error("ReportsInputCodec: not enough data for slot (need 4 bytes)");
    }
    const slot = new DataView(uint8.buffer, uint8.byteOffset + offset, 4).getUint32(0, true);
    offset += 4;

    return { guarantees, slot };
  },
] as unknown as Codec<ReportsInput>;

ReportsInputCodec.enc = ReportsInputCodec[0];
ReportsInputCodec.dec = ReportsInputCodec[1];
