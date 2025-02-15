import { Bytes, Codec } from "scale-ts";
import { DisputesRecords } from "../types";
import { toUint8Array, concatAll, DiscriminatorCodec, decodeWithBytesUsed } from "../../../codecs";
import { convertToReadableFormat } from "../../../utils";


const HashCodec      = Bytes(32);
const GoodCodec      = DiscriminatorCodec(HashCodec);
const BadCodec       = DiscriminatorCodec(HashCodec);
const WonkyCodec     = DiscriminatorCodec(HashCodec);
const OffendersCodec = DiscriminatorCodec(HashCodec);

export const RecordsCodec: Codec<DisputesRecords> = [
  // ENCODER
  (records: DisputesRecords): Uint8Array => {
    const encGood =      GoodCodec.enc(records.good);
    const encBad =       BadCodec.enc(records.bad);
    const encWonky =     WonkyCodec.enc(records.wonky);
    const encOffenders = OffendersCodec.enc(records.offenders);

    const result = concatAll(encGood, encBad, encWonky, encOffenders);
    // console.log("RecordsCodec: encoded", Buffer.from(result).toString('hex'));
    return result;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): DisputesRecords => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    // 1) decode good
    {
      const slice = uint8.slice(offset);
      // console.log("RecordsCodec: decoding", Buffer.from(slice).toString('hex'));   

      const { value, bytesUsed } = decodeWithBytesUsed(GoodCodec, slice);

      offset += bytesUsed;
      var good = value;
      // console.log("RecordsCodec 1: decoded good", convertToReadableFormat(good));
    }

    // 2) decode bad
    {
      const slice = uint8.slice(offset);
      // console.log("RecordsCodec 2: decoding", Buffer.from(slice).toString('hex'));
      const { value, bytesUsed } = decodeWithBytesUsed(BadCodec, slice);
      offset += bytesUsed;
      var bad = value;
    }


    // 3) decode wonky
    {
      const slice = uint8.slice(offset);
      // console.log("RecordsCodec 3: decoding", Buffer.from(slice).toString('hex'));
      const { value, bytesUsed } = decodeWithBytesUsed(WonkyCodec, slice);
      offset += bytesUsed;
      var wonky = value;
    }

    // to hex string
    
    // 4) decode offenders
    {
      const slice = uint8.slice(offset);
      // console.log("RecordsCodec 4: decoding", Buffer.from(slice).toString('hex'));
      const { value, bytesUsed } = decodeWithBytesUsed(OffendersCodec, slice);
      offset += bytesUsed;
      var offenders = value;
    }

    // console.log("RecordsCodec 5: decoding", Buffer.from(uint8).toString('hex'));


    // leftover check
    // if (offset < uint8.length) {
    //   console.warn(`RecordsCodec: leftover data after decoding? offset=${offset}, total=${uint8.length}`);
    // }

    return { good, bad, wonky, offenders };
  },
] as unknown as Codec<DisputesRecords>;

RecordsCodec.enc = RecordsCodec[0];
RecordsCodec.dec = RecordsCodec[1];
