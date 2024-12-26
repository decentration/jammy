import { Codec, Encoder, Decoder } from "scale-ts";
import { Verdict, Culprit, Dispute, Fault } from '../types';
import { VerdictCodec, CulpritCodec, FaultCodec } from "../../block/codecs";
import { DiscriminatorCodec, decodeWithBytesUsed } from "../../codecs";



export const DisputeCodec: Codec<Dispute> = [
  // enc
  (dispute: Dispute) => {


    // Encode verdicts, culprits, and faults as separate parts
    const encodedVerdicts = DiscriminatorCodec(VerdictCodec).enc(dispute.verdicts);
    const encodedCulprits = DiscriminatorCodec(CulpritCodec).enc(dispute.culprits);
    const encodedFaults = DiscriminatorCodec(FaultCodec).enc(dispute.faults);

    // Concatenate all parts
    const totalSize = encodedVerdicts.length + encodedCulprits.length + encodedFaults.length;
    const out = new Uint8Array(totalSize);

    let offset = 0;

    // Copy verdicts
    out.set(encodedVerdicts, offset);
    offset += encodedVerdicts.length;

    // Copy culprits
    out.set(encodedCulprits, offset);
    offset += encodedCulprits.length;

    // Copy faults
    out.set(encodedFaults, offset);

    return out;
  },

// dec
(data: ArrayBuffer | Uint8Array | string) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // 1) decode verdicts
    {
      const { value: verdictsArr, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(VerdictCodec),
        uint8.slice(offset)
      )
      offset += bytesUsed
      // store them
      var verdicts = verdictsArr
    }

    // 2) decode culprits
    {
      const { value: culpritsArr, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(CulpritCodec),
        uint8.slice(offset)
      )
      offset += bytesUsed
      var culprits = culpritsArr
    }

    // 3) decode faults
    {
      const { value: faultsArr, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(FaultCodec),
        uint8.slice(offset)
      )
      offset += bytesUsed
      var faults = faultsArr
    }

    // 4) Combine
    return { verdicts, culprits, faults }
  },
] as unknown as Codec<Dispute>;

DisputeCodec.enc = DisputeCodec[0];
DisputeCodec.dec = DisputeCodec[1];

function buf2hex(buffer: Uint8Array): string {
    return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
}

