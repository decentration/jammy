import { Codec } from "scale-ts";
import { Report } from "../types/types";
import { PackageSpecCodec } from "../types/types";
// import { ContextCodec } from "../types/types"; // replace this with new ContextCodec
import { ResultCodec } from "./ResultCodec";

import { DiscriminatorCodec } from "../codecs/DiscriminatorCodec";  // direct path
import { SegmentLookupItemCodec } from "./SegmentLookupItemCodec";
import { ContextCodec } from "./ContextCodec";
import { SingleByteLenCodec, decodeWithBytesUsed } from "./index";
import { Bytes, Vector } from "scale-ts";


export const SegmentLookupArrayCodec = DiscriminatorCodec(SegmentLookupItemCodec);

/**
 * `Report` has:
 *  - package_spec: PackageSpec
 *  - context: Context
 *  - core_index: number (u16)
 *  - authorizer_hash: Uint8Array (32 bytes)
 *  - auth_output: Uint8Array (single-byte-len)
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

    // 5) encode auth_output with SingleByteLenCodec
    const encAuthOutput = SingleByteLenCodec.enc(report.auth_output);


    console.log("encAuthOutput", encAuthOutput);
    // 6) encode segment_root_lookup with Vector(Bytes(32))

    const encSegLookup = DiscriminatorCodec(SegmentLookupItemCodec).enc(report.segment_root_lookup);
    // log string hex
console.log("encSegLookup", Buffer.from(encSegLookup).toString("hex"));
    // 7) encode results with DiscriminatorCodec(ResultCodec)
    const encResults = DiscriminatorCodec(ResultCodec).enc(report.results);

    // 8) Concatenate all
    const totalSize =
      encPkg.length +
      encCtx.length +
      2 + // for core_index (u16)
      encAuthHash.length +
      encAuthOutput.length +
      encSegLookup.length +
      encResults.length;

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

    // 5) decode auth_output with SingleByteLenCodec
    {
      const { value: authOutputVal, bytesUsed } = decodeWithBytesUsed(
        SingleByteLenCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var auth_output = authOutputVal;
    }


    // 6) decode segment_root_lookup => SegmentLookupArrayCodec
    {
      const { value: segLookup, bytesUsed } = decodeWithBytesUsed(
        SegmentLookupArrayCodec,
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

    // 8) Return final object
    return {
      package_spec: pkg,
      context: ctx,
      core_index,
      authorizer_hash,
      auth_output,
      segment_root_lookup,
      results,
    };
  },
] as unknown as Codec<Report>;

ReportCodec.enc = ReportCodec[0];
ReportCodec.dec = ReportCodec[1];
