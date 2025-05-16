import { Codec, u32 } from "scale-ts";
import { decodeWithBytesUsed, DiscriminatorCodec, ReportCodec } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs"; 
import { AccumulateInput } from "../types"; 
import { toHex } from "../../../utils";

export const AccumulateInputCodec: Codec<AccumulateInput> = [
  // --- ENCODER ---
  (input: AccumulateInput): Uint8Array => {
   
    const encSlot = u32.enc(input.slot);
    console.log("AccumulateInputCodec: enc", input.slot, encSlot, toHex(encSlot));
    const encReports = DiscriminatorCodec(ReportCodec).enc(input.reports);

    // 3) concat
    return concatAll(encSlot, encReports);
  },

  // --- DECODER ---
  (data: ArrayBuffer | Uint8Array | string): AccumulateInput => {
    const uint8 = toUint8Array(data);

    let offset = 0;

    // a) decode slot 4 bytes
    const slot = u32.dec(uint8.slice(offset));
    offset += 4;


    // b) decode the reports (DiscriminatorCodec)
    const { value: reports, bytesUsed } = decodeWithBytesUsed(
      DiscriminatorCodec(ReportCodec),
      uint8.slice(offset)
    );
    
    return { slot, reports };
  },
] as unknown as Codec<AccumulateInput>;

AccumulateInputCodec.enc = AccumulateInputCodec[0];
AccumulateInputCodec.dec = AccumulateInputCodec[1];
