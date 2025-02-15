import { Codec } from "scale-ts";
import { Assignment, DisputesState } from "../types";
import { RecordsCodec } from "./RecordsCodec";
import { AvailAssignmentsCodec, ValidatorsInfoCodec } from "../../../codecs"; 
import { decodeWithBytesUsed, concatAll, toUint8Array } from "../../../codecs";
import { ValidatorInfo } from "../../types";

/**
 * DisputesStateCodec: 
 *   Encodes the entire state object:
 *     - psi  (the disputes records: good, bad, wonky, offenders)
 *     - rho  (availability assignment array)
 *     - tau  (TimeSlot, e.g. a u32)
 *     - kappa (current validators)
 *     - lambda (previous validators)
 */
export const DisputesStateCodec: Codec<DisputesState> = [
  // ENCODER
  (state: DisputesState): Uint8Array => {
    // 1) encode psi
    const encPsi = RecordsCodec.enc(state.psi);

    // 2) encode rho => using e.g. AvailabilityAssignmentsCodec
    const encRho = AvailAssignmentsCodec.enc(state.rho);

    // 3) encode tau => 4 bytes
    const tauBuf = new Uint8Array(4);
    new DataView(tauBuf.buffer).setUint32(0, state.tau, true);

    // 4) encode kappa
    const encKappa = ValidatorsInfoCodec.enc(state.kappa);

    // 5) encode lambda
    const encLambda = ValidatorsInfoCodec.enc(state.lambda);

    return concatAll(encPsi, encRho, tauBuf, encKappa, encLambda);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): DisputesState => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    // decode psi
    {
        const { value: psiVal, bytesUsed } = decodeWithBytesUsed(RecordsCodec, uint8.slice(offset));
        offset += bytesUsed;
        var psi = psiVal;
    }
    // decode rho
    {
        const { value: rhoVal, bytesUsed } = decodeWithBytesUsed(AvailAssignmentsCodec, uint8.slice(offset));
        offset += bytesUsed;
        var rho = rhoVal as (Assignment | null)[];
    }

    // decode tau => 4 bytes
    if (offset + 4 > uint8.length) {
      throw new Error("DisputesStateCodec: not enough bytes for tau");
    }
    const tauView = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const tau = tauView.getUint32(0, true);
    offset += 4;

    // decode kappa
    const { value: kappaVal, bytesUsed: usedKappa } = decodeWithBytesUsed(ValidatorsInfoCodec, (uint8.slice(offset)));
    offset += usedKappa;

    // decode lambda
    const { value: lambdaVal, bytesUsed: usedLambda } = decodeWithBytesUsed(ValidatorsInfoCodec, (uint8.slice(offset)));
    offset += usedLambda;

    if (offset < uint8.length) {
      console.warn(`DisputesStateCodec: leftover data after decode. offset=${offset}, total=${uint8.length}`);
    }

    return {
      psi: psi,
      rho: rho,
      tau,
      kappa: kappaVal,
      lambda: lambdaVal,
    };
  },
] as unknown as Codec<DisputesState>;

DisputesStateCodec.enc = DisputesStateCodec[0];
DisputesStateCodec.dec = DisputesStateCodec[1];
