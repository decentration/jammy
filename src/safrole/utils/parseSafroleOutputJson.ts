import { SafroleOutput, ErrorCode, TicketsMark } from "../types";
import { hexStringToBytes } from "../../codecs/utils";

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
        validators: json.ok.epoch_mark.validators.map((v: string) => hexStringToBytes(v)),
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
