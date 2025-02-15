import { Codec } from "scale-ts";
import { WorkItem } from "../../types/types";
import { VarLenBytesCodec, decodeWithBytesUsed } from "../index";
import { Bytes } from "scale-ts";
import { DiscriminatorCodec } from "../DiscriminatorCodec";
import { ImportSpecCodec } from "./ImportSpecCodec";
import { ExtrinsicSpecCodec } from "./ExtrinsicSpecCodec";

/**
 * WorkItem encoding steps:
 * 1) service (u32, little-endian)
 * 2) code_hash (32 bytes)
 * 3) payload (VarLenBytesCodec)
 * 4) refine_gas_limit (u64, little-endian)
 * 5) accumulate_gas_limit (u64, little-endian)
 * 6) import_segments => DiscriminatorCodec(ImportSpecCodec)
 * 7) extrinsic => DiscriminatorCodec(ExtrinsicSpecCodec)
 * 8) export_count (u16)
 */
export const WorkItemCodec: Codec<WorkItem> = [
  // ENCODER
  (wi: WorkItem): Uint8Array => {
    // 1) service => 4 bytes (u32)
    const serviceBuf = new Uint8Array(4);
    new DataView(serviceBuf.buffer).setUint32(0, wi.service, true);

    // 2) code_hash => 32 bytes
    const codeHashBuf = Bytes(32).enc(wi.code_hash);

    // 3) payload => SingleByteLen
    const payloadBuf = VarLenBytesCodec.enc(wi.payload);

    // 4) refine_gas_limit => 8 bytes
    const refineBuf = new Uint8Array(8);
    new DataView(refineBuf.buffer).setBigUint64(0, BigInt(wi.refine_gas_limit), true);

    // 5) accumulate_gas_limit => 8 bytes
    const accumBuf = new Uint8Array(8);
    new DataView(accumBuf.buffer).setBigUint64(0, BigInt(wi.accumulate_gas_limit), true);

    // 6) import_segments => DiscriminatorCodec(ImportSpecCodec)
    const encImport = DiscriminatorCodec(ImportSpecCodec).enc(wi.import_segments);

    // 7) extrinsic => DiscriminatorCodec(ExtrinsicSpecCodec)
    const encExtrinsic = DiscriminatorCodec(ExtrinsicSpecCodec).enc(wi.extrinsic);

    // 8) export_count => u16
    const exportCountBuf = new Uint8Array(2);
    new DataView(exportCountBuf.buffer).setUint16(0, wi.export_count, true);

    // Concatenate
    const totalSize =
      serviceBuf.length +
      codeHashBuf.length +
      payloadBuf.length +
      refineBuf.length +
      accumBuf.length +
      encImport.length +
      encExtrinsic.length +
      exportCountBuf.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;
    out.set(serviceBuf, offset);           offset += serviceBuf.length;
    out.set(codeHashBuf, offset);          offset += codeHashBuf.length;
    out.set(payloadBuf, offset);           offset += payloadBuf.length;
    out.set(refineBuf, offset);            offset += refineBuf.length;
    out.set(accumBuf, offset);            offset += accumBuf.length;
    out.set(encImport, offset);           offset += encImport.length;
    out.set(encExtrinsic, offset);        offset += encExtrinsic.length;
    out.set(exportCountBuf, offset);      offset += exportCountBuf.length;

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): WorkItem => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // 1) service => 4 bytes
    if (offset + 4 > uint8.length) {
      throw new Error("WorkItemCodec: not enough bytes for service (u32)");
    }
    const service = new DataView(
      uint8.buffer,
      uint8.byteOffset + offset,
      4
    ).getUint32(0, true);
    offset += 4;

    // 2) code_hash => 32 bytes
    if (offset + 32 > uint8.length) {
      throw new Error("WorkItemCodec: not enough bytes for code_hash (32)");
    }
    const code_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // 3) payload => VarLenBytesCodec
    {
      const slice = uint8.slice(offset);
      const { value: payload, bytesUsed } = decodeWithBytesUsed(
        VarLenBytesCodec,
        slice
      );
      offset += bytesUsed;
      var pl = payload;
    }

    // 4) refine_gas_limit => 8 bytes
    if (offset + 8 > uint8.length) {
      throw new Error("WorkItemCodec: not enough bytes for refine_gas_limit");
    }
    const refine_gas_limit = Number(
      new DataView(uint8.buffer, uint8.byteOffset + offset, 8).getBigUint64(0, true)
    );
    offset += 8;

    // 5) accumulate_gas_limit => 8 bytes
    if (offset + 8 > uint8.length) {
      throw new Error("WorkItemCodec: not enough bytes for accumulate_gas_limit");
    }
    const accumulate_gas_limit = Number(
      new DataView(uint8.buffer, uint8.byteOffset + offset, 8).getBigUint64(0, true)
    );
    offset += 8;

    // 6) import_segments => DiscriminatorCodec(ImportSpecCodec)
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(ImportSpecCodec),
        slice
      );
      offset += bytesUsed;
      var import_segments = value;
    }

    // 7) extrinsic => DiscriminatorCodec(ExtrinsicSpecCodec)
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(ExtrinsicSpecCodec),
        slice
      );
      offset += bytesUsed;
      var extrinsic = value;
    }

    // 8) export_count => u16
    if (offset + 2 > uint8.length) {
      throw new Error("WorkItemCodec: not enough bytes for export_count");
    }
    const export_count = new DataView(
      uint8.buffer,
      uint8.byteOffset + offset,
      2
    ).getUint16(0, true);
    offset += 2;

    return {
      service,
      code_hash,
      payload: pl,
      refine_gas_limit,
      accumulate_gas_limit,
      import_segments,
      extrinsic,
      export_count,
    };
  },
] as Codec<WorkItem>;

WorkItemCodec.enc = WorkItemCodec[0];
WorkItemCodec.dec = WorkItemCodec[1];
