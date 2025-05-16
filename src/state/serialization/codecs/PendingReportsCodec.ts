import { Codec, u32 } from "scale-ts";
import { concatAll } from "../../../codecs";
import { WorkPackageHash } from "../../../stf/accumulate/types";

export type PendingReport = { w: WorkPackageHash; t: number } | null;
export type PendingReports = PendingReport[];

export const PendingReportsCodec: Codec<PendingReports> = [
  // ENCODER
  (pendingReports: PendingReports): Uint8Array => {
    const encodedItems = pendingReports.map((report) => {
      if (report === null) {
        // null is encoded as 0x00 byte
        return new Uint8Array([0x00]);
      } else {
        const { w, t } = report;

        if (w.length !== 32) {
          throw new Error("Work package hash must be 32 bytes");
        }

        const coreIndexEnc = u32.enc(t);

        // presence flag (0x01) + 32 byte hash + 4 byte integer
        return concatAll(new Uint8Array([0x01]), w, coreIndexEnc);
      }
    });

    return concatAll(...encodedItems);
  },

  // DECODER
  (data: Uint8Array): PendingReports => {
    const reports: PendingReports = [];
    let offset = 0;

    while (offset < data.length) {
      const flag = data[offset];
      offset += 1;

      if (flag === 0x00) {
        reports.push(null);
      } else if (flag === 0x01) {
        if (offset + 36 > data.length) {
          throw new Error("Not enough data to decode PendingReport");
        }

        const w = data.slice(offset, offset + 32);
        offset += 32;

        const t = u32.dec(data.slice(offset, offset + 4));
        offset += 4;

        reports.push({ w, t });
      } else {
        throw new Error(`Unknown presence flag (0x${flag.toString(16)}) in PendingReports`);
      }
    }

    return reports;
  },
] as unknown as Codec<PendingReports>;

PendingReportsCodec.enc = PendingReportsCodec[0];
PendingReportsCodec.dec = PendingReportsCodec[1];
