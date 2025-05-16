import { Codec } from "scale-ts";
import { AccumulateStf } from "../types";
import { concatAll, decodeWithBytesUsed } from "../../../codecs";
import { AccumulateInputCodec } from "./AccumulateInputCodec";
import { AccumulateStateCodec } from "./AcumulateStateCodec";
import { AccumulateOutputCodec } from "./AccumulateOutputCodec";

// export interface AccumulateStf {
//     input: AccumulateInput,
//     pre_state: AccumulateState,
//     output: AccumulateOutput,
//     post_state: AccumulateState
// }


export const AccumulateStfCodec: Codec<AccumulateStf> = [
    // ENCODER
    (stf: AccumulateStf): Uint8Array => {
        const encInput     = AccumulateInputCodec.enc(stf.input); 
        const encPreState  = AccumulateStateCodec.enc(stf.pre_state);
        const encOutput    = AccumulateOutputCodec.enc(stf.output);
        const encPostState = AccumulateStateCodec.enc(stf.post_state);

        return concatAll(
            encInput, encPreState, encOutput, encPostState
        )
    },

    // DECODER
    (data: ArrayBuffer | Uint8Array | string): AccumulateStf => {
        const uint8 =
        data instanceof Uint8Array
            ? data
            : typeof data === "string"
            ? new TextEncoder().encode(data)
            : new Uint8Array(data);

        let offset = 0;

        function read<T>(codec: Codec<T>): T {
            const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
            offset += bytesUsed;
            return value;
        }

        const input = read(AccumulateInputCodec)
        const pre_state = read(AccumulateStateCodec)
        const output = read(AccumulateOutputCodec)
        const post_state = read(AccumulateStateCodec)

        
        return {
            input, pre_state, output, post_state
        }
    }
] as unknown as Codec<AccumulateStf>;

AccumulateStfCodec.enc = AccumulateStfCodec[0];
AccumulateStfCodec.dec = AccumulateStfCodec[1];



