import { Codec, u32 } from "scale-ts"
import { SignatureCodec, Guarantee } from "../types"
import { ReportCodec } from "../codecs"
import { DiscriminatorCodec, decodeWithBytesUsed } from "../../codecs"

export const GuaranteeCodec: Codec<Guarantee> = [
    // ENCODER
    (guar: Guarantee) => {
      // 1) encode the `report`
      const encodedReport = ReportCodec.enc(guar.report);

    //   console.log('encodedReport:', encodedReport);
  
      // 2) encode the `slot` (4 bytes)
      const slotBuf = new Uint8Array(4);
      new DataView(slotBuf.buffer).setUint32(0, guar.slot, true);
  
      // 3) encode signatures array
      const encodedSigs = DiscriminatorCodec(SignatureCodec).enc(guar.signatures);
  
      // 4) concatenate all
      const out = new Uint8Array(
        encodedReport.length + slotBuf.length + encodedSigs.length
      );
      let offset = 0;
  
      out.set(encodedReport, offset);
      offset += encodedReport.length;
  
      out.set(slotBuf, offset);
      offset += slotBuf.length;
  
      out.set(encodedSigs, offset);
  
      return out;
    },
  
    // DECODER
    (data: ArrayBuffer | Uint8Array | string) => {
        // console.log('data decode guarantee:', data);
      const uint8 =
        data instanceof Uint8Array
          ? data
          : typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
  
      let offset = 0;
  
      // (A) decode report with decodeWithBytesUsed
      {
        const { value: reportVal, bytesUsed } = decodeWithBytesUsed(
          ReportCodec,
          uint8.slice(offset)
        );
        offset += bytesUsed;
        var report = reportVal;
      }
      // (B) decode slot (4 bytes)
      if (offset + 4 > uint8.length) {
        throw new Error("GuaranteeCodec: not enough data for slot");
      }
      const slotView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
      const slot = slotView.getUint32(0, true);
      offset += 4;
  
      // (C) decode signatures
      {
        const { value: sigsVal, bytesUsed } = decodeWithBytesUsed(
          DiscriminatorCodec(SignatureCodec),
          uint8.slice(offset)
        );
        offset += bytesUsed;
        var signatures = sigsVal;
      }
  
      return { report, slot, signatures };
    },
  ] as unknown as Codec<Guarantee>;
  
  GuaranteeCodec.enc = GuaranteeCodec[0];
  GuaranteeCodec.dec = GuaranteeCodec[1];
  