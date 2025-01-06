import { Codec } from "scale-ts";
import { AvailAssignment } from "../../../types";
import { ReportCodec } from "../../../../codecs";
import { decodeWithBytesUsed } from "../../../../codecs";

/**
 * AvailAssignment has:
 *  - report: Report | null
 *  - timeout: number (u32)
 *
 * This codec encodes `report` with a 1-byte tag (0x00 = null, 0x01 = present)
 * followed by an encoded report if present, and then 4 bytes for `timeout`.
 */
export const AvailAssignmentCodec: Codec<AvailAssignment> = [
  // ENCODER
  (data: AvailAssignment): Uint8Array => {
    // 1) `report` is mandatory
    if (!data.report) {
      throw new Error("AvailAssignmentCodec.enc: `report` must not be null");
    }
    const encReport = ReportCodec.enc(data.report);

    // 2) Encode 
    const timeBuf = new Uint8Array(4);
    new DataView(timeBuf.buffer).setUint32(0, data.timeout, true);

    // 3) Concatenate
    const out = new Uint8Array(encReport.length + 4);
    out.set(encReport, 0);
    out.set(timeBuf, encReport.length);
    return out;
  },

  // DECODER
  (input: ArrayBuffer | Uint8Array | string): AvailAssignment => {
    const uint8 =
      input instanceof Uint8Array
        ? input
        : typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);

    let offset = 0;

    // 1) decode `report`
    //    We expect a valid `Report` with no optional tag
    const { value: decodedReport, bytesUsed: repUsed } = decodeWithBytesUsed(
      ReportCodec,
      uint8
    );
    offset += repUsed;
    if (!decodedReport) {
      throw new Error("AvailAssignmentCodec.dec: decoded a null report, but it's required");
    }

    // 2) decode `timeout` (4 bytes)
    if (offset + 4 > uint8.length) {
      throw new Error("AvailAssignmentCodec: not enough data for `timeout`");
    }
    const timeView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const timeout = timeView.getUint32(0, true);
    offset += 4;

    return { report: decodedReport, timeout };
  },
] as unknown as Codec<AvailAssignment>;

AvailAssignmentCodec.enc = AvailAssignmentCodec[0];
AvailAssignmentCodec.dec = AvailAssignmentCodec[1];


export const OptionalAvailAssignmentCodec: Codec<AvailAssignment | null> = [
  // ENCODER
  (assignment: AvailAssignment | null): Uint8Array => {
    if (!assignment) {
      // entire item is null 
      return new Uint8Array([0x00]);
    }
    // item present
    const encItem = AvailAssignmentCodec.enc(assignment);
    const out = new Uint8Array(1 + encItem.length);
    out[0] = 0x01;
    out.set(encItem, 1);
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AvailAssignment | null => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (!uint8.length) {
      throw new Error("OptionalAvailAssignmentCodec.dec: no data to decode");
    }

    const tag = uint8[0];
    if (tag === 0x00) {
      return null; // item null
    }
    if (tag === 0x01) {
      // decode 
      const slice = uint8.slice(1);
      return AvailAssignmentCodec.dec(slice);
    }
    throw new Error(`OptionalAvailAssignmentCodec: invalid tag 0x${tag.toString(16)}`);
  },
] as Codec<AvailAssignment | null>;

OptionalAvailAssignmentCodec.enc = OptionalAvailAssignmentCodec[0];
OptionalAvailAssignmentCodec.dec = OptionalAvailAssignmentCodec[1];
