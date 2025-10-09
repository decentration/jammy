import { Codec } from "scale-ts";
import { Report } from "../types/types";
import { PackageSpecCodec } from "../types/types";
import { ResultCodec } from "./ResultCodec";
import { DiscriminatorCodec } from "./DiscriminatorCodec";
import { SegmentItemCodec } from "./SegmentItemCodec";
import { ContextCodec } from "./ContextCodec";
import { VarLenBytesCodec, coerceU64, decodeWithBytesUsed } from "./index";
import { Bytes, Vector } from "scale-ts";
import { convertToReadableFormat } from "../utils";
import { decodeProtocolIntBig, decodeProtocolIntNumber, encodeProtocolInt } from "./IntegerCodec2";

export const SegmentArrayCodec = DiscriminatorCodec(SegmentItemCodec);

/**
 * `Report` has:
 *  - package_spec: PackageSpec
 *  - context: Context
 *  - core_index: number (u16)
 *  - authorizer_hash: Uint8Array (32 bytes)
 *  - auth_output: Uint8Array (variable length bytes) 
 *  - segment_root_lookup: Uint8Array[] (Vector of 32 bytes)
 *  - results: Result[] (DiscriminatorCodec(ResultCodec))
 */
export const ReportCodec: Codec<Report> = [
  // ENCODER
  (report: Report): Uint8Array => {
    // 1) encode package_spec
    const encPkg = PackageSpecCodec.enc(report.package_spec);

    // 2) encode context
    const encCtx = ContextCodec.enc(report.context);

    // 3) encode core_index (u16)
    const encCoreIndex = encodeProtocolInt(report.core_index);
    
    // 4) encode authorizer_hash (32 bytes)
    const encAuthHash = Bytes(32).enc(report.authorizer_hash);
    // console.log("encAuthHash", Buffer.from(encAuthHash).toString("hex"));

    // 5) newly added auth-gas-used (u64)
    const encAuthGasUsed = encodeProtocolInt(coerceU64(report.auth_gas_used));

    // 6) encode auth_output with VarLenBytesCodec
    const encAuthOutput = VarLenBytesCodec.enc(report.auth_output);

    // console.log("encAuthOutput", encAuthOutput);
    // 7) encode segment_root_lookup with Vector(Bytes(32))
    const encSegLookup = DiscriminatorCodec(SegmentItemCodec).enc(report.segment_root_lookup);
    // log string hex

    // 8) encode results with DiscriminatorCodec(ResultCodec)
    const encResults = DiscriminatorCodec(ResultCodec, { minSize: 1, maxSize: 16 }).enc(report.results);


    
    
    // new DataView(authGasUsedBuf.buffer).setBigUint64(0, report.auth_gas_used, true);

    // 8) Concatenate all
    const totalSize =
      encPkg.length +
      encCtx.length +
      encCoreIndex.length + // for core_index (u16)
      encAuthHash.length +
      encAuthGasUsed.length +
      encAuthOutput.length +
      encSegLookup.length +
      encResults.length 
     

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encPkg, offset);
    offset += encPkg.length;

    out.set(encCtx, offset);
    offset += encCtx.length;

    out.set(encCoreIndex, offset);
    offset += encCoreIndex.length;

    out.set(encAuthHash, offset);
    offset += encAuthHash.length;

    out.set(encAuthGasUsed, offset);     
    offset += encAuthGasUsed.length;

    // console.log("encAuthOutput", encAuthOutput);
    out.set(encAuthOutput, offset);
    offset += encAuthOutput.length;

    out.set(encSegLookup, offset);
    offset += encSegLookup.length;
    
    out.set(encResults, offset);
    
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Report => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    console.log("ReportCodec dec", convertToReadableFormat(uint8).length);

    // 1) decode package_spec
    {
      const { value: package_spec, bytesUsed } = decodeWithBytesUsed(
        PackageSpecCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var pkg = package_spec;
    }

    // 2) decode context
    {
      const { value: ctxVal, bytesUsed } = decodeWithBytesUsed(
        ContextCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var ctx = ctxVal;
    }

    // 3) decode core_index (u16)
    if (offset + 2 > uint8.length) {
      throw new Error("ReportCodec: not enough bytes for core_index");
    }
    {
      const { value: coreIndex, bytesRead } = decodeProtocolIntNumber(uint8.slice(offset));
      offset += bytesRead;
      var core_index = coreIndex;
      // use core_index
    }

    // 4) decode authorizer_hash (32 bytes)
    if (offset + 32 > uint8.length) {
      throw new Error("ReportCodec: not enough bytes for authorizer_hash");
    }
    const authorizer_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // log offset
    console.log("authorizer_hash", Buffer.from(authorizer_hash).toString("hex"));

    // 5) decode auth_gas_used (u64) in C.5/6 encoder
    if (offset + 8 > uint8.length) throw new Error("ReportCodec: not enough bytes for auth_gas_used");
    {
      const slice = uint8.slice(offset);
      const { value, bytesRead } = decodeProtocolIntBig(slice);
      offset += bytesRead;
      var auth_gas_used = value;
    }
     
      // log offset
    console.log("auth_gas_used", auth_gas_used);

    // 6) decode auth_output with VarLenBytesCodec  
    const { value: authOutputVal, bytesUsed } = decodeWithBytesUsed(
      VarLenBytesCodec,
      uint8.slice(offset)
    );
    offset += bytesUsed;
    var auth_output = authOutputVal;

    // log offset
    console.log("auth_output", convertToReadableFormat(auth_output), ' offset=', offset, ' total=', uint8.length);


    // 7) decode segment_root_lookup => SegmentArrayCodec
    const { value: segLookup, bytesUsed: segBytesUsed } = decodeWithBytesUsed(
      SegmentArrayCodec,
      uint8.slice(offset)
    );
    offset += segBytesUsed;
    var segment_root_lookup = segLookup;

    // 8) decode results with DiscriminatorCodec(ResultCodec)    
    const { value: resultsVal, bytesUsed: resultBytesUsed } = decodeWithBytesUsed(
      DiscriminatorCodec(ResultCodec),
      uint8.slice(offset)
    );
    offset += resultBytesUsed;
    var results = resultsVal;
  

    // 8) Return final object
    return {
      package_spec: pkg,
      context: ctx,
      core_index,
      authorizer_hash,
      auth_gas_used,
      auth_output,
      segment_root_lookup,
      results,
     
    };
  },
] as unknown as Codec<Report>;

ReportCodec.enc = ReportCodec[0];
ReportCodec.dec = ReportCodec[1];
