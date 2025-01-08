import { Codec } from 'scale-ts';
import { ExtrinsicData } from '../../types/types';
import { TicketCodec, AssuranceCodec } from '../../types/types';
import { GuaranteeCodec, DisputeCodec, PreimageCodec } from '../../codecs';
import { DiscriminatorCodec, decodeWithBytesUsed } from '../../codecs';

export const ExtrinsicDataCodec: Codec<ExtrinsicData> = [
  // 1) ENCODER
  (data: ExtrinsicData): Uint8Array => {
    // a) encode tickets
    const encTickets = DiscriminatorCodec(TicketCodec).enc(data.tickets);

    // b) encode preimages
    const encPreimages = DiscriminatorCodec(PreimageCodec).enc(data.preimages);

    // c) encode guarantees
    const encGuarantees = DiscriminatorCodec(GuaranteeCodec).enc(data.guarantees);

    // d) encode assurances
    const encAssurances = DiscriminatorCodec(AssuranceCodec).enc(data.assurances);

    // e) encode disputes (single object)
    const encDisputes = DisputeCodec.enc(data.disputes);

    // f) concat all
    const totalSize = 
      encTickets.length + 
      encPreimages.length + 
      encGuarantees.length + 
      encAssurances.length + 
      encDisputes.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encTickets, offset);    offset += encTickets.length;
    out.set(encPreimages, offset);  offset += encPreimages.length;
    out.set(encGuarantees, offset); offset += encGuarantees.length;
    out.set(encAssurances, offset); offset += encAssurances.length;
    out.set(encDisputes, offset);

    return out;
  },

  // 2) DECODER
  (input: ArrayBuffer | Uint8Array | string): ExtrinsicData => {
    console.log('ExtrinsicDataCodec input:', input);
    // Convert input to Uint8Array
    const uint8 =
      input instanceof Uint8Array
        ? input
        : typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);

    let offset = 0;
console.log('ExtrinsicDataCodec before a:');
    // a) decode tickets
    {
      const { value: ticketsVal, bytesUsed } = 
        
      decodeWithBytesUsed(
        DiscriminatorCodec(TicketCodec),
        uint8.slice(offset)
      );

      console.log('ExtrinsicDataCodec ticketsVal:', ticketsVal);
      offset += bytesUsed;
      var tickets = ticketsVal;
    }
    console.log('ExtrinsicDataCodec before b and offset bytesUsed:', offset);

    // b) decode preimages
    {
      const { value: preimagesVal, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(PreimageCodec),
        uint8.slice(offset)
      );

      console.log('ExtrinsicDataCodec preimagesVal:', preimagesVal);
      offset += bytesUsed;
      var preimages = preimagesVal;
    }

    // c) decode guarantees
    {
      const { value: guaranteesVal, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(GuaranteeCodec),
        uint8.slice(offset)
      );
      console.log('ExtrinsicDataCodec guaranteesVal:', guaranteesVal);
      offset += bytesUsed;
      var guarantees = guaranteesVal;
    }

    // d) decode assurances
    {
      const { value: assurancesVal, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(AssuranceCodec),
        uint8.slice(offset)
      );
      console.log('ExtrinsicDataCodec assurancesVal:', assurancesVal);
      offset += bytesUsed;
      var assurances = assurancesVal;
    }

    
    // e) decode disputes
    console.log('e: ExtrinsicDataCodec before disputes');
    {
      const { value: disputesVal, bytesUsed } = decodeWithBytesUsed(
        DisputeCodec,
        uint8.slice(offset)
      );
      console.log('ExtrinsicDataCodec disputesVal:', disputesVal);
      offset += bytesUsed;
      var disputes = disputesVal;
    }

    return { tickets, preimages, guarantees, assurances, disputes };
  },
] as unknown as Codec<ExtrinsicData>;

ExtrinsicDataCodec.enc = ExtrinsicDataCodec[0];
ExtrinsicDataCodec.dec = ExtrinsicDataCodec[1];
