import { Codec } from "scale-ts";
import { Result } from "../types";
import { decodeWithBytesUsed } from "../../codecs/utils/decodeWithBytesUsed";
import { ResultValueCodec } from "./ResultValueCodec"; // your custom variant
import { u32, Bytes } from "scale-ts";

/**
 * A manual codec for:
 *   service_id (u32),
 *   code_hash (32 bytes),
 *   payload_hash (32 bytes),
 *   accumulate_gas (u32),
 *   result (ResultValue)
 */
export const ResultCodec: Codec<Result> = [
  // ENCODER
  (r: Result): Uint8Array => {
    // 1) encode service_id (u32 -> 4 bytes LE)
    const sidBuf = new Uint8Array(4);
    new DataView(sidBuf.buffer).setUint32(0, r.service_id, true);

    // 2) encode code_hash (32 bytes)
    const encCodeHash = Bytes(32).enc(r.code_hash);

    // 3) encode payload_hash (32 bytes)
    const encPayloadHash = Bytes(32).enc(r.payload_hash);

    // 4) encode accumulate_gas (u32 -> 4 bytes LE)
    const gasBuf = new Uint8Array(4);
    new DataView(gasBuf.buffer).setUint32(0, r.accumulate_gas, true);

    // 5) encode result (ResultValueCodec)
    const encResult = ResultValueCodec.enc(r.result);

    // 6) concatenate all
    const totalLen =
      sidBuf.length +
      encCodeHash.length +
      encPayloadHash.length +
      gasBuf.length +
      encResult.length;

    const out = new Uint8Array(totalLen);
    let offset = 0;

    out.set(sidBuf, offset);
    offset += sidBuf.length;

    out.set(encCodeHash, offset);
    offset += encCodeHash.length;

    out.set(encPayloadHash, offset);
    offset += encPayloadHash.length;

    out.set(gasBuf, offset);
    offset += gasBuf.length;

    out.set(encResult, offset);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Result => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // 1) decode service_id (u32 -> 4 bytes)
    if (offset + 4 > uint8.length) {
      throw new Error("ResultCodec: not enough data for service_id");
    }
    const sidView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const service_id = sidView.getUint32(0, true);
    offset += 4;

    // 2) decode code_hash (32 bytes)
    if (offset + 32 > uint8.length) {
      throw new Error("ResultCodec: not enough data for code_hash");
    }
    const code_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // 3) decode payload_hash (32 bytes)
    if (offset + 32 > uint8.length) {
      throw new Error("ResultCodec: not enough data for payload_hash");
    }
    const payload_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // 4) decode accumulate_gas (u32 -> 4 bytes)
    if (offset + 4 > uint8.length) {
      throw new Error("ResultCodec: not enough data for accumulate_gas");
    }
    const gasView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const accumulate_gas = gasView.getUint32(0, true);
    offset += 4;

    // 5) decode result
    {
      const slice = uint8.slice(offset);
      const { value: resultVal, bytesUsed } = decodeWithBytesUsed(ResultValueCodec, slice);
      offset += bytesUsed;
      var result = resultVal;
    }

    return { service_id, code_hash, payload_hash, accumulate_gas, result };
  },
] as unknown as Codec<Result>;


ResultCodec.enc = ResultCodec[0];
ResultCodec.dec = ResultCodec[1];
