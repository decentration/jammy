import { Codec } from "scale-ts";
import { decodeWithBytesUsed, DiscriminatorCodec, GuaranteeCodec } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs"; 
import { ReportsInput } from "../types"; 
import { convertToReadableFormat } from "../../../utils";
import { OpaqueHashCodec } from "../../../types";

export const ReportsInputCodec: Codec<ReportsInput> = [
  // --- ENCODER ---
  (input: ReportsInput): Uint8Array => {
    // 1) encode guarantees as a DiscriminatorCodec of GuaranteeCodec
    const encGuarantees = DiscriminatorCodec(GuaranteeCodec).enc(input.guarantees);

    // 2) encode slot as 4 byte LE
    const slotBuf = new Uint8Array(4);
    new DataView(slotBuf.buffer).setUint32(0, input.slot, true);

    // 3) known packages is just an array of 32 byte hashes with a prefix using discriminator code
    const encKnownPackages = DiscriminatorCodec(OpaqueHashCodec).enc(input.known_packages);

    // 3) concat
    return concatAll(
      encGuarantees, 
      slotBuf, 
      encKnownPackages
    );
  },

  // --- DECODER ---
  (data: ArrayBuffer | Uint8Array | string): ReportsInput => {
    const uint8 = toUint8Array(data);

    let offset = 0;

    // a) decode the guarantees (DiscriminatorCodec)
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed: usedGuarantees } = decodeWithBytesUsed(
        DiscriminatorCodec(GuaranteeCodec),
        slice
      );
      offset += usedGuarantees;
      var guarantees = value;
    }

    // b) decode slot 4 bytes
    {
      if (offset + 4 > uint8.length) {
        throw new Error("ReportsInputCodec: not enough data for slot (need 4 bytes)");
      }
      const slice = uint8.slice(offset);

      const value = new DataView(slice.buffer, slice.byteOffset, 4).getUint32(0, true);
      offset += 4;
      var slot = value;
    }

    console.log("ReportsInputCodec dec offset after slot", offset, "total", uint8.length);

    // c) decode known packages (DiscriminatorCodec)
    { 
      const slice = uint8.slice(offset);

      const { value, bytesUsed: usedKnownPackages } = decodeWithBytesUsed(
        DiscriminatorCodec(OpaqueHashCodec),
        slice
      );
      offset += usedKnownPackages;
      console.log("known packages offset", offset, "total", uint8.length);
      var known_packages = value;
    }
    // d) check if we have read all the data

    return { guarantees, slot, known_packages };
  },
] as unknown as Codec<ReportsInput>;

ReportsInputCodec.enc = ReportsInputCodec[0];
ReportsInputCodec.dec = ReportsInputCodec[1];
