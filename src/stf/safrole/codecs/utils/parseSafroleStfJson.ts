import { SafroleStf } from "../../types";
import { parseSafroleInputJson } from "./parseSafroleInputJson";
import { parseSafroleStateJson } from "./parseSafroleStateJson";
import { parseSafroleOutputJson } from "./parseSafroleOutputJson";

/**
 * parseSafroleStfJson:
 *   Reads a big JSON object of the shape:
 *   {
 *     "input": {...},
 *     "pre_state": {...},
 *     "output": {...},
 *     "post_state": {...}
 *   }
 *   and returns a fully typed SafroleStf object.
 */
export function parseSafroleStfJson(json: any): SafroleStf {
  console.log("parseSafroleStfJson: json = ", json);
  return {
    input: parseSafroleInputJson(json.input),
    pre_state: parseSafroleStateJson(json.pre_state),
    output: parseSafroleOutputJson(json.output),
    post_state: parseSafroleStateJson(json.post_state),
  };
}
