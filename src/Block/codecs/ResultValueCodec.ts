import { Codec } from "scale-ts";
import { decodeWithBytesUsed } from "../../codecs/utils/decodeWithBytesUsed";
import { SingleByteLenCodec } from "../../codecs/SingleByteLenCodec";
import { ResultValue } from "../types";

export const ResultValueCodec: Codec<ResultValue> = [
  // ENCODER
  (rv: ResultValue) => {
    if ("ok" in rv) {
      const encodedOk = SingleByteLenCodec.enc(rv.ok);
      const out = new Uint8Array(1 + encodedOk.length);
      out[0] = 0x00; // 0 => "ok"
      out.set(encodedOk, 1);
      return out;
    } else if ("placeholder" in rv) {

      return Uint8Array.of(0x01);
    } else {

      return Uint8Array.of(0x02);
    }
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 1) {
      throw new Error("ResultValueCodec: no variant byte found");
    }
    const variantByte = uint8[0];
    const remainder = uint8.slice(1);

    if (variantByte === 0x00) {
      // "ok" => decode single-byte-len
      const { value: okBytes } = decodeWithBytesUsed(SingleByteLenCodec, remainder);
      return { ok: okBytes };
    } else if (variantByte === 0x01) {
      return { placeholder: null };
    } else if (variantByte === 0x02) {
      return { panic: null };
    } else {
      throw new Error(
        `ResultValueCodec: unknown variant byte=0x${variantByte.toString(16)}`
      );
    }
  },
] as unknown as Codec<ResultValue>;

ResultValueCodec.enc = ResultValueCodec[0];
ResultValueCodec.dec = ResultValueCodec[1];
