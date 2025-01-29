import { Codec } from "scale-ts";
import { OkData } from "../../../types";
import { ReportCodec } from "../../../../codecs";
import { decodeWithBytesUsed } from "../../../../codecs";

export const OkDataCodec: Codec<OkData> = [
  // ENCODER
  (okData: OkData): Uint8Array => {
    const length = okData.reported.length;

    if (length > 0xff) {
      throw new Error(`OkDataCodec.enc: too many Report items (${length})`);
    }

    const lengthBuf = new Uint8Array([length]);

    const encodedReports = okData.reported.map(ReportCodec.enc);
    const totalReportsSize = encodedReports.reduce((acc, buf) => acc + buf.length, 0);
    const reportsBuf = new Uint8Array(totalReportsSize);
    let offset = 0;

    for (const buf of encodedReports) {
      reportsBuf.set(buf, offset);
      offset += buf.length;
    }

    const out = new Uint8Array(lengthBuf.length + reportsBuf.length);
    out.set(lengthBuf, 0);
    out.set(reportsBuf, lengthBuf.length);
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): OkData => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 1) {
      throw new Error("OkDataCodec.dec: insufficient data for length prefix");
    }

    const length = uint8[0];
    let offset = 1;
    const reported = [];

    for (let i = 0; i < length; i++) {
      const { value: report, bytesUsed } = decodeWithBytesUsed(
        ReportCodec,
        uint8.slice(offset)
      );                                  
      reported.push(report);
      offset += bytesUsed;
    }

    return { reported };
  },
] as Codec<OkData>;

OkDataCodec.enc = OkDataCodec[0];
OkDataCodec.dec = OkDataCodec[1];
