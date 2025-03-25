import { Codec } from "scale-ts";
import { Result, ServiceIdCodec } from "../types/types";
import { decodeWithBytesUsed } from "./utils/decodeWithBytesUsed";
import { ResultValueCodec } from "./ResultValueCodec";
import { u32, u64, Bytes } from "scale-ts";
import { RefineLoadCodec } from "./RefineLoadCodec";
import { encodeProtocolInt } from "./IntegerCodec";

export const ResultCodec: Codec<Result> = [
  // ENCODER
  (r: Result): Uint8Array => {
    // 1) encode service_id (u32 -> 4 bytes LE)
    const encServiceId = ServiceIdCodec.enc(r.service_id);

    // 2) encode code_hash (32 bytes)
    const encCodeHash = Bytes(32).enc(r.code_hash);

    // 3) encode payload_hash (32 bytes)
    const encPayloadHash = Bytes(32).enc(r.payload_hash);

    // 4) encode accumulate_gas (u64 -> 8 bytes LE)
    const encAccumulateGas = u64.enc(BigInt(r.accumulate_gas)); 
    // const encAccumulateGas = u64.(r.accumulate_gas);


    // 5) encode result (ResultValueCodec)
    const encResult = ResultValueCodec.enc(r.result);

    const encRefineLoad = RefineLoadCodec.enc(r.refine_load);

    // 6) concatenate all
    const totalLen =
      encServiceId.length +
      encCodeHash.length +
      encPayloadHash.length +
      encAccumulateGas.length +
      encResult.length +
      encRefineLoad.length;

    const out = new Uint8Array(totalLen);
    let offset = 0;

    out.set(encServiceId, offset);       offset += encServiceId.length;
    out.set(encCodeHash, offset);        offset += encCodeHash.length;
    out.set(encPayloadHash, offset);     offset += encPayloadHash.length;
    out.set(encAccumulateGas, offset);   offset += encAccumulateGas.length;
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

    // 1) decode service_id (u32 -> 4 bytes LE)
    const { value: service_id, bytesUsed: sidUsed } = decodeWithBytesUsed(u32, uint8.slice(offset));
    offset += sidUsed;

    // 2) decode code_hash (32 bytes)
    const { value: code_hash, bytesUsed: hashUsed } = decodeWithBytesUsed(Bytes(32), uint8.slice(offset));
    offset += hashUsed;

    // 3) decode payload_hash (32 bytes)
    const { value: payload_hash, bytesUsed: payloadUsed } = decodeWithBytesUsed(Bytes(32), uint8.slice(offset));
    offset += payloadUsed;

    // 4) decode accumulate_gas (u64 -> 8 bytes LE)
    const { value: accumulate_gas, bytesUsed: gasUsed } = decodeWithBytesUsed(u64, uint8.slice(offset));
    offset += gasUsed;

    // 5) decode result
    const { value: result, bytesUsed: resultUsed } = decodeWithBytesUsed(ResultValueCodec, uint8.slice(offset));
    offset += resultUsed;

    const { value: refine_load, bytesUsed: refineLoadUsed } = decodeWithBytesUsed(RefineLoadCodec, uint8.slice(offset));
    offset += refineLoadUsed;

    return { service_id, code_hash, payload_hash, accumulate_gas: Number(accumulate_gas), result, refine_load };
  },
] as unknown as Codec<Result>;

ResultCodec.enc = ResultCodec[0];
ResultCodec.dec = ResultCodec[1];
