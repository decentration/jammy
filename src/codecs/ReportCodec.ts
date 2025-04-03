import { Codec } from "scale-ts";
import { Report } from "../types/types";
import { PackageSpecCodec } from "../types/types";
import { ResultCodec } from "./ResultCodec";
import { DiscriminatorCodec } from "./DiscriminatorCodec";
import { SegmentItemCodec } from "./SegmentItemCodec";
import { ContextCodec } from "./ContextCodec";
import { VarLenBytesCodec, decodeProtocolInt, decodeWithBytesUsed, encodeProtocolInt } from "./index";
import { Bytes, Vector } from "scale-ts";
import { convertToReadableFormat } from "../utils";
import { parseReportFromJson } from "../parsers/parseReportsGuaranteeFromJson";

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
    const coreIndexBuf = new Uint8Array(2);
    new DataView(coreIndexBuf.buffer).setUint16(0, report.core_index, true);
    

    // 4) encode authorizer_hash (32 bytes)
    const encAuthHash = Bytes(32).enc(report.authorizer_hash);

    // console.log("encAuthHash", Buffer.from(encAuthHash).toString("hex"));
    // 5) encode auth_output with VarLenBytesCodec
    const encAuthOutput = VarLenBytesCodec.enc(report.auth_output);

    // console.log("encAuthOutput", encAuthOutput);
    // console.log("encAuthOutput", encAuthOutput);
    // 6) encode segment_root_lookup with Vector(Bytes(32))

    const encSegLookup = DiscriminatorCodec(SegmentItemCodec).enc(report.segment_root_lookup);
    // log string hex

    // console.log("encSegLookup", Buffer.from(encSegLookup).toString("hex"));
const ReportTillNow = { encPkg, encCtx, coreIndexBuf, encAuthHash, encAuthOutput, encSegLookup };
    console.log("out before results", convertToReadableFormat(ReportTillNow));

    // 7) encode results with DiscriminatorCodec(ResultCodec)
    const encResults = DiscriminatorCodec(ResultCodec, { minSize: 1, maxSize: 16 }).enc(report.results);


    // 8) newly added auth-gas-used (u64)
    const authGasUsedBuf = encodeProtocolInt(report.auth_gas_used);
    
    // new DataView(authGasUsedBuf.buffer).setBigUint64(0, report.auth_gas_used, true);

    // 8) Concatenate all
    const totalSize =
      encPkg.length +
      encCtx.length +
      2 + // for core_index (u16)
      encAuthHash.length +
      encAuthOutput.length +
      encSegLookup.length +
      encResults.length +
      authGasUsedBuf.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encPkg, offset);
    offset += encPkg.length;

    out.set(encCtx, offset);
    offset += encCtx.length;

    out.set(coreIndexBuf, offset);
    offset += 2;

    out.set(encAuthHash, offset);
    offset += encAuthHash.length;

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

    console.log("ReportCodec dec", convertToReadableFormat(uint8));

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
    const coreView = new DataView(uint8.buffer, uint8.byteOffset + offset, 2);
    const core_index = coreView.getUint16(0, true);
    offset += 2;

    // 4) decode authorizer_hash (32 bytes)
    if (offset + 32 > uint8.length) {
      throw new Error("ReportCodec: not enough bytes for authorizer_hash");
    }
    const authorizer_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // 5) decode auth_output with VarLenBytesCodec
    {
      const { value: authOutputVal, bytesUsed } = decodeWithBytesUsed(
        VarLenBytesCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var auth_output = authOutputVal;
    }


    // 6) decode segment_root_lookup => SegmentArrayCodec
    {
      const { value: segLookup, bytesUsed } = decodeWithBytesUsed(
        SegmentArrayCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var segment_root_lookup = segLookup;
    }


    // 7) decode results with DiscriminatorCodec(ResultCodec)
    {
      const { value: resultsVal, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(ResultCodec),
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var results = resultsVal;
    }

    // 8) decode auth_gas_used (u64)
    const { value: authGasValue, bytesRead } = decodeProtocolInt(uint8.slice(offset));
    offset += bytesRead;
    const auth_gas_used = authGasValue;

    // 8) Return final object
    return {
      package_spec: pkg,
      context: ctx,
      core_index,
      authorizer_hash,
      auth_output,
      segment_root_lookup,
      results,
      auth_gas_used
    };
  },
] as unknown as Codec<Report>;

ReportCodec.enc = ReportCodec[0];
ReportCodec.dec = ReportCodec[1];
