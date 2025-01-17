import { Codec } from "scale-ts";
import { SafroleState } from "../types"; 
import { TimeSlotCodec } from "../types";  
import { EntropyBufferCodec } from "./EntropyBufferCodec"; 
import { ValidatorsInfoCodec } from "./ValidatorsInfoCodec";
import { TicketsAccumulatorCodec } from "./TicketsAccumulatorCodec";
import { PostOffendersCodec } from "../types";
import { concatAll, decodeWithBytesUsed, toUint8Array } from "../../codecs/utils"; 
import { BlsPublicCodec } from "../../types/types";
import { TicketsOrKeysCodec } from "./TicketsOrKeysCodec";
import { toHex } from "../../utils";

/**
 * SafroleStateCodec:
 *   1) tau (4 bytes via TimeSlotCodec)
 *   2) eta (128 bytes via EntropyBufferCodec)
 *   3) lambda (2016 bytes => 6 validators * 336 each) => ValidatorsInfoCodec
 *   4) kappa (2016 bytes => same) => ValidatorsInfoCodec
 *   5) gamma_k (2016) => ValidatorsInfoCodec
 *   6) iota (2016) => ValidatorsInfoCodec
 *   7) gamma_a => variable => TicketsAccumulatorCodec
 *   8) gamma_s => variable => TicketsOrKeysCodec
 *   9) gamma_z => 144 bytes => BlsPublicCodec
 *   10) post_offenders => variable => PostOffendersCodec
 */
export const SafroleStateCodec: Codec<SafroleState> = [
  // ENCODER
  (st: SafroleState): Uint8Array => {
    // 1) tau
    const tauEnc = TimeSlotCodec.enc(st.tau);

    // 2) eta => 4×32 = 128
    const etaEnc = EntropyBufferCodec.enc(st.eta);

    // 3..6) lambda, kappa, gamma_k, iota => each use ValidatorsInfoCodec
    const lambdaEnc = ValidatorsInfoCodec.enc(st.lambda);
    const kappaEnc = ValidatorsInfoCodec.enc(st.kappa);
    const gammaKEnc = ValidatorsInfoCodec.enc(st.gamma_k);
    const iotaEnc = ValidatorsInfoCodec.enc(st.iota);

    // 7) gamma_a => variable => TicketsAccumulatorCodec
    const gammaAEnc = TicketsAccumulatorCodec.enc(st.gamma_a);

    // 8) gamma_s => variable => TicketsOrKeysCodec
    const gammaSEnc = TicketsOrKeysCodec.enc(st.gamma_s);

    // 9) gamma_z => 144
    if (st.gamma_z.length !== 144) {
      throw new Error(`SafroleStateCodec: gamma_z must be 144 bytes, got ${st.gamma_z.length}`);
    }
    const gammaZEnc = BlsPublicCodec.enc(st.gamma_z);

    // 10) post_offenders => variable => PostOffendersCodec
    const postOffendersEnc = PostOffendersCodec.enc(st.post_offenders);

    // Concatenate in order
    return concatAll(
      tauEnc,
      etaEnc,
      lambdaEnc,
      kappaEnc,
      gammaKEnc,
      iotaEnc,
      gammaAEnc,
      gammaSEnc,
      gammaZEnc,
      postOffendersEnc,
    );
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): SafroleState => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    console.log("SafroleStateCodec: dec => hex length:", uint8.length);
    // console.log("SafroleStateCodec: dec => hex data:", toHex(uint8));

    // 1) tau => exactly 4 bytes via TimeSlotCodec
    {
      const slice = uint8.slice(offset, offset + 4);
      if (slice.length < 4) throw new Error(`Not enough data for tau`);
      const tau = TimeSlotCodec.dec(slice);
      offset += 4;
      var tau_ = tau;
      console.log("decode tau and bytes", tau_, offset);
    }

    // 2) eta => 128 bytes => pass that slice to EntropyBufferCodec
    {
      const slice = uint8.slice(offset, offset + 128);
      if (slice.length < 128) {
        throw new Error(`Not enough data for eta (need 128, got ${slice.length})`);
      }
      const eta = EntropyBufferCodec.dec(slice);
      offset += 128;
      var eta_ = eta;
      console.log("decode eta => 4 items of 32 bytes each", eta, offset);
    }

    function decodeValidators(data: Uint8Array): { val: any; used: number } {
      // make sure the codec only decodes 2016. So let's just pass exactly 2016 
      const slice = data.slice(0, 2016);
      if (slice.length < 2016) {
        throw new Error(`Not enough data for validators (need 2016)`);
      }
      const v = ValidatorsInfoCodec.dec(slice);
      return { val: v, used: 2016 };
    }

    // 3) lambda
    {
      const part = decodeValidators(uint8.slice(offset));
      offset += part.used;
      var lambda_ = part.val;
    }

    // 4) kappa
    {
      const part = decodeValidators(uint8.slice(offset));
      offset += part.used;
      var kappa_ = part.val;
    }

    // 5) gamma_k
    {
      const part = decodeValidators(uint8.slice(offset));
      offset += part.used;
      var gamma_k_ = part.val;
    }

    // 6) iota
    {
      const part = decodeValidators(uint8.slice(offset));
      offset += part.used;
      var iota_ = part.val;
    }

    console.log("SafroleStateCodec: offset after validators", offset);

    // 7) gamma_a => variable => TicketsAccumulatorCodec
    {
      const slice = uint8.slice(offset);
      console.log("SafroleStateCodec: gamma_a slice length", slice.length);
      const { value: gamma_a, bytesUsed } = decodeWithBytesUsed(TicketsAccumulatorCodec, slice);
      offset += bytesUsed;
      console.log("SafroleStateCodec: gamma_a offset", offset);
      var gamma_a_ = gamma_a;
      console.log("gamma_a => used", bytesUsed);
    }
    // 8) gamma_s => variable => TicketsOrKeysCodec
    {
      const slice = uint8.slice(offset);
      const { value: gamma_s, bytesUsed } = decodeWithBytesUsed(TicketsOrKeysCodec, slice);
      offset += bytesUsed;
      var gamma_s_ = gamma_s;
    }

    // 9) gamma_z => 144 => pass exactly 144 to BlsPublicCodec
    {
      const slice = uint8.slice(offset, offset + 144);
      if (slice.length < 144) {
        throw new Error(`Not enough data for gamma_z (need 144, got ${slice.length})`);
      }
      const gamma_z = BlsPublicCodec.dec(slice);
      offset += 144;
      var gamma_z_ = gamma_z;
    }

    console.log("SafroleStateCodec: offset after gamma_z", offset);
    // 10) post_offenders => variable => PostOffendersCodec
    {
      const slice = uint8.slice(offset);
      const { value: post_offenders, bytesUsed } = decodeWithBytesUsed(PostOffendersCodec, slice);
      offset += bytesUsed;
      var post_offenders_ = post_offenders;
    }

    console.log("SafroleStateCodec: final offset =", offset);

    return {
      tau: tau_,
      eta: eta_,
      lambda: lambda_,
      kappa: kappa_,
      gamma_k: gamma_k_,
      iota: iota_,
      gamma_a: gamma_a_,
      gamma_s: gamma_s_,
      gamma_z: gamma_z_,
      post_offenders: post_offenders_,
    };
  },
] as unknown as Codec<SafroleState>;

SafroleStateCodec.enc = SafroleStateCodec[0];
SafroleStateCodec.dec = SafroleStateCodec[1];
