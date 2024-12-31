import { Codec } from "scale-ts";
import { decodeWithBytesUsed, DiscriminatorCodec, SetCodec } from "../../codecs";
import { Bytes, u32 } from "scale-ts";
import { EpochMarkerCodec } from "./EpochMarkerCodec"; 
import { TicketMarkCodec } from "./TicketMarkCodec";
import { Header, EpochMarker, TicketMark } from "../types";

export const HeaderCodec: Codec<Header> = [
  // ENCODER
  (header: Header): Uint8Array => {
    const encParent = Bytes(32).enc(header.parent);
    const encParentRoot = Bytes(32).enc(header.parent_state_root);
    const encExtrinsicHash = Bytes(32).enc(header.extrinsic_hash);

    // 2) slot => 4 bytes LE
    const slotBuf = new Uint8Array(4);
    new DataView(slotBuf.buffer).setUint32(0, header.slot, true);

    // 3) epoch_mark => Option(EpochMarkerCodec)
    let encEpoch: Uint8Array;
    if (header.epoch_mark === null) {
      // 0x00 = "None"
      encEpoch = Uint8Array.of(0x00);
      console.log('HeaderCodec enc epoch_mark:', header.epoch_mark, 'encEpoch:', Buffer.from(encEpoch).toString('hex'));
    } else {
      // 0x01 = "Some"
      const encMarker = EpochMarkerCodec.enc(header.epoch_mark);
      console.log('HeaderCodec epoch_mark encMarker:', Buffer.from(encMarker).toString('hex'));
      encEpoch = new Uint8Array(1 + encMarker.length);
      encEpoch[0] = 0x01;
      encEpoch.set(encMarker, 1);
    }
    
    // 4) tickets_mark => Option(DiscriminatorCodec(Bytes(32)))
    let encTickets: Uint8Array;
    if (header.tickets_mark === null) {
      encTickets = Uint8Array.of(0x00); // None
    } else {
    console.log('HeaderCodec tickets_mark:', header.tickets_mark);
      const setEnc = SetCodec(TicketMarkCodec, 33).enc(header.tickets_mark);
      encTickets = new Uint8Array(1 + setEnc.length);
      encTickets[0] = 0x01; // Some
      encTickets.set(setEnc, 1);
    }

    // 5) offenders_mark => DiscriminatorCodec(Bytes(32))
    const encOffenders = DiscriminatorCodec(Bytes(32)).enc(header.offenders_mark);

    // 6) author_index 
    const authorBuf = new Uint8Array(2);
    new DataView(authorBuf.buffer).setUint16(0, header.author_index, true);

    // 7) entropy_source 
    const encEntropy = Bytes(96).enc(header.entropy_source);

    // 8) seal => Encode either as 0x00 (no seal) or directly as the 96-byte seal
    let encSeal: Uint8Array;
    if (header.seal === null) {
    // No seal, encode as a single byte `0x00`
    encSeal = Uint8Array.of(0x00);
    console.log("Encoding seal as null (0x00)");
    } else {
    // Seal is present, encode directly without a prefix
    if (header.seal.length !== 96) {
        throw new Error("HeaderCodec: Seal must be exactly 96 bytes");
    }
    encSeal = new Uint8Array(header.seal);
    console.log("Encoding seal directly as 96 bytes:", encSeal);
    }


    // 9) Concatenate all
    const totalSize =
      encParent.length +
      encParentRoot.length +
      encExtrinsicHash.length +
      slotBuf.length +
      encEpoch.length +
      encTickets.length +
      encOffenders.length +
      authorBuf.length +
      encEntropy.length +
      encSeal.length;

    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encParent, offset);          offset += encParent.length;
    out.set(encParentRoot, offset);      offset += encParentRoot.length;
    out.set(encExtrinsicHash, offset);   offset += encExtrinsicHash.length;
    out.set(slotBuf, offset);            offset += slotBuf.length;

    out.set(encEpoch, offset);           offset += encEpoch.length;
    out.set(encTickets, offset);         offset += encTickets.length;
    out.set(encOffenders, offset);       offset += encOffenders.length;
    out.set(authorBuf, offset);          offset += authorBuf.length;

    out.set(encEntropy, offset);         offset += encEntropy.length;
    out.set(encSeal, offset);

    return out;
  },

  // DECODER
  (input: ArrayBuffer | Uint8Array | string) => {
    const uint8 =
      input instanceof Uint8Array
        ? input
        : typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);

    let offset = 0;
    console.log('HeaderCodec dec uint8 hex:', Buffer.from(uint8).toString('hex'));

    // 1) parent(32), parent_state_root(32), extrinsic_hash(32)
    if (offset + 32 > uint8.length) throw new Error("HeaderCodec: not enough data for parent");
    const parent = uint8.slice(offset, offset + 32);
    offset += 32;

    if (offset + 32 > uint8.length) throw new Error("HeaderCodec: not enough data for parent_state_root");
    const parent_state_root = uint8.slice(offset, offset + 32);
    offset += 32;

    if (offset + 32 > uint8.length) throw new Error("HeaderCodec: not enough data for extrinsic_hash");
    const extrinsic_hash = uint8.slice(offset, offset + 32);
    offset += 32;

    // 2) slot => 4 bytes
    if (offset + 4 > uint8.length) throw new Error("HeaderCodec: not enough data for slot");
    const slotView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const slot = slotView.getUint32(0, true);
    offset += 4;

    // 3) epoch_mark => Option(EpochMarkerCodec)
    let epoch_mark: EpochMarker | null = null;

    if (offset >= uint8.length) {
        throw new Error("HeaderCodec: not enough data for epoch_mark presence byte");
    }

    // Read the presence byte
    const epochByte = uint8[offset++];
    console.log('HeaderCodec epoch_mark presence byte:', epochByte);

    if (epochByte === 0x01) {
        // "Some" => Decode using EpochMarkerCodec
        if (offset >= uint8.length) {
            throw new Error("HeaderCodec: not enough data for epoch_mark after presence byte");
        }

        // Pass the remaining slice directly to EpochMarkerCodec
        const remainingSlice = uint8.slice(offset);
        console.log('HeaderCodec epoch_mark slice before decoding:', Buffer.from(remainingSlice).toString('hex'));

        // Decode using EpochMarkerCodec
        epoch_mark = EpochMarkerCodec.dec(remainingSlice);

        // Calculate bytes used as the length of the encoded EpochMarker
        const bytesUsed = 64 + epoch_mark.validators.length * 32;
        offset += bytesUsed;

        console.log('HeaderCodec decoded epoch_mark validators:', epoch_mark.validators.map((v) => Buffer.from(v).toString('hex')));
        console.log('HeaderCodec epoch_mark offset after decoding:', offset, 'epoch_mark:', epoch_mark);

    } else if (epochByte === 0x00) {
        // "None" => Null epoch_mark
        epoch_mark = null;
        console.log('HeaderCodec epoch_mark is null');

    } else {
        // Invalid tag
        throw new Error(`HeaderCodec: invalid epoch_mark option tag: ${epochByte}`);
    }


    // 4) tickets_mark 
    const ticketsByte = uint8[offset++];
    console.log('HeaderCodec ticketsByte:', ticketsByte);
    let tickets_mark: TicketMark[] | null = null;

    if (ticketsByte === 0x01) {
    const tickets: TicketMark[] = [];
    while (offset + 33 <= uint8.length) {
        // Check for stop condition
        if (uint8[offset] === 0x00 && offset + 3 <= uint8.length) {
          const potentialStop = new DataView(uint8.buffer, uint8.byteOffset + offset, 3);
          const u16Value = potentialStop.getUint16(1, true); // Little-endian u16
          if (u16Value > 0) {
              // Valid stop condition
              break;
          }
        }

        // Decode a single ticket
        const id = uint8.slice(offset, offset + 32);
        const attempt = uint8[offset + 32];
        tickets.push({ id, attempt });

        offset += 33;
    }
        tickets_mark = tickets;
    } else if (ticketsByte === 0x00) {
        tickets_mark = null;
    } else {
        console.error("HeaderCodec: tickets_mark decoding failed. Invalid tag:", ticketsByte);
        console.error("Remaining data slice:", uint8.slice(offset));
        throw new Error(`Invalid option tag for tickets_mark: ${ticketsByte}`);
    }


    // 5) offenders_mark => DiscriminatorCodec(Bytes(32)) (non-optional)
    {
      const slice = uint8.slice(offset);
      console.log('HeaderCodec offenders_mark slice:', slice);
      const { value: offendersVal, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(Bytes(32)), slice
      );
      offset += bytesUsed;
      var offenders_mark = offendersVal;
    }
    console.log('HeaderCodec offenders_mark:', offenders_mark, 'Offset:', offset, input);
    
    // 6) author_index => 2 bytes
    if (offset + 2 > uint8.length) {
        throw new Error("HeaderCodec: not enough data for author_index");
    }
    const authorView = new DataView(uint8.buffer, uint8.byteOffset + offset, 2);
    const author_index = authorView.getUint16(0, true); 
    offset += 2;

    // 7) entropy_source => 96 bytes
    if (offset + 96 > uint8.length) throw new Error("HeaderCodec: not enough data for entropy_source (96 bytes)");
    const entropy_source = uint8.slice(offset, offset + 96);
    offset += 96;

    // 8) seal either 0x00 (no seal) or direct 96-byte seal
    let seal: Uint8Array | null = null;

    if (offset < uint8.length) {
    const potentialSealByte = uint8[offset];

    if (potentialSealByte === 0x00) {

        seal = null;
        offset++;
        console.log('Seal is null (0x00)');
    } else {
      
        if (offset + 96 > uint8.length) {
        throw new Error("HeaderCodec: not enough data for seal (96 bytes expected)");
        }
        seal = uint8.slice(offset, offset + 96);
        offset += 96;
        console.log('Seal decoded:', seal);
    }
    } else {
    console.log('No seal data present at all');
    seal = null; 
    }


    return {
      parent,
      parent_state_root,
      extrinsic_hash,
      slot,
      epoch_mark,
      tickets_mark,
      offenders_mark,
      author_index,
      entropy_source,
      seal,
    };
  },
] as unknown as Codec<Header>;

HeaderCodec.enc = HeaderCodec[0];
HeaderCodec.dec = HeaderCodec[1];
