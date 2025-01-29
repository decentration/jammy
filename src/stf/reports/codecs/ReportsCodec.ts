import { Codec } from "scale-ts";
import { Reports } from "../types"; 
import { ReportsInputCodec } from "./ReportsInputCodec";
import { ReportsStateCodec } from "./ReportsStateCodec";
import { OutputCodec } from "./OutputCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { toUint8Array } from "../../../codecs";

export const ReportsCodec: Codec<Reports> = [
  // ------------------
  // 1) ENCODER
  // ------------------
  (reports: Reports): Uint8Array => {
    // a) encode input
    const encInput = ReportsInputCodec.enc(reports.input);

    // b) encode pre_state
    const encPreState = ReportsStateCodec.enc(reports.pre_state);

    // c) encode output
    const encOutput = OutputCodec.enc(reports.output);

    // d) encode post_state
    const encPostState = ReportsStateCodec.enc(reports.post_state);

    // e) concat
    const totalSize =
      encInput.length +
      encPreState.length +
      encOutput.length +
      encPostState.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encInput, offset);
    offset += encInput.length;

    out.set(encPreState, offset);
    offset += encPreState.length;

    out.set(encOutput, offset);
    offset += encOutput.length;

    out.set(encPostState, offset);
    offset += encPostState.length;

    return out;
  },

  // ------------------
  // 2) DECODER
  // ------------------
  (data: ArrayBuffer | Uint8Array | string): Reports => {
    const uint8 = toUint8Array(data);

    let offset = 0;

    // a) decode input
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(ReportsInputCodec, slice);
      offset += bytesUsed;
      var input = value;
    }

    // b) decode pre_state
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(ReportsStateCodec, slice);
      offset += bytesUsed;
      var pre_state = value;
    }

    // c) decode output
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(OutputCodec, slice);
      offset += bytesUsed;
      var output = value;
    }

    // d) decode post_state
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(ReportsStateCodec, slice);
      offset += bytesUsed;
      var post_state = value;
    }

    //  leftovers
    if (offset < uint8.length) {
      console.warn(
        `ReportsCodec.dec: leftover bytes after decoding (offset=${offset}, total=${uint8.length})`
      );
    }

    return { input, pre_state, output, post_state };
  },
] as unknown as Codec<Reports>;

ReportsCodec.enc = ReportsCodec[0];
ReportsCodec.dec = ReportsCodec[1];
