import { SafroleOutput, ErrorCode, TicketsMark } from "../types";
import { hexStringToBytes } from "../../../codecs/utils";
import { EpochMarkValidators } from "../../../types";

/**
 * parseSafroleOutputJson:
 *   The JSON might be { "err": "bad-slot",... } or { "ok": { ... } }.
 */
export function parseSafroleOutputJson(json: any): SafroleOutput {
  if (json.err) {
    const mappedErr = (ErrorCode as any)[json.err] as ErrorCode;
    if (mappedErr === undefined) {
      throw new Error(`parseSafroleOutputJson: unknown err code '${json.err}'`);
    }
    return { err: mappedErr };
  }

  if (json.ok) {
    // { epoch_mark, tickets_mark }
    // parse optional epoch_mark
    let epoch_mark = undefined;
    if (json.ok.epoch_mark) {
      epoch_mark = {
        entropy: hexStringToBytes(json.ok.epoch_mark.entropy),
        tickets_entropy: hexStringToBytes(json.ok.epoch_mark.tickets_entropy),

        //   "validators": [
        //               {
        //                   "bandersnatch": "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
        //                   "ed25519": "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00"
        //               },
        //               {
        //                   "bandersnatch": "0x0000000000000000000000000000000000000000000000000000000000000000",
        //                   "ed25519": "0x0000000000000000000000000000000000000000000000000000000000000000"

        validators: json.ok.epoch_mark.validators.map((valJson: any) => ({
          bandersnatch: hexStringToBytes(valJson.bandersnatch),
          ed25519: hexStringToBytes(valJson.ed25519),
        })),
      };
    }

    let tickets_mark = undefined;
    if (json.ok.tickets_mark) {
      // parse array of TicketsMark
      const parseTicketsMark = (tb: any): TicketsMark => ({
        id: hexStringToBytes(tb.id),
        attempt: tb.attempt,
      });
      tickets_mark = json.ok.tickets_mark.map(parseTicketsMark);
    }

    return {
      ok: {
        epoch_mark: epoch_mark ?? null,
        tickets_mark: tickets_mark ?? null,
      },
    };
  }

  throw new Error("parseSafroleOutputJson: must have either `err` or `ok` in output");
}
