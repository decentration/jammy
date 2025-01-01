import { Codec } from 'scale-ts';
import { decodeWithBytesUsed } from '../../../codecs';
import { History, OutputCodec } from '../../types';
import { HistoryInputCodec, PreAndPostStateCodec } from './';

export const HistoryCodec: Codec<History> = [
  // ENCODER
  (history: History): Uint8Array => {
    const encInput = HistoryInputCodec.enc(history.input);
    const encPreState = PreAndPostStateCodec.enc(history.pre_state);
    const encOutput = OutputCodec.enc(history.output);
    const encPostState = PreAndPostStateCodec.enc(history.post_state);

    const totalSize =
      encInput.length + encPreState.length + encOutput.length + encPostState.length;
    const out = new Uint8Array(totalSize);

    let offset = 0;
    out.set(encInput, offset);      offset += encInput.length;
    out.set(encPreState, offset);   offset += encPreState.length;
    out.set(encOutput, offset);     offset += encOutput.length;
    out.set(encPostState, offset);  offset += encPostState.length;

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    const { value: inputVal, bytesUsed: inputUsed } = decodeWithBytesUsed(HistoryInputCodec, uint8.slice(offset));
    offset += inputUsed;

    const { value: preVal, bytesUsed: preUsed } = decodeWithBytesUsed(PreAndPostStateCodec, uint8.slice(offset));
    offset += preUsed;

    const { value: outVal, bytesUsed: outUsed } = decodeWithBytesUsed(OutputCodec, uint8.slice(offset));
    offset += outUsed;

    const { value: postVal, bytesUsed: postUsed } = decodeWithBytesUsed(PreAndPostStateCodec, uint8.slice(offset));
    offset += postUsed;

    return {
      input: inputVal,
      pre_state: preVal,
      output: outVal,
      post_state: postVal,
    };
  },
] as unknown as Codec<History>;

HistoryCodec.enc = HistoryCodec[0];
HistoryCodec.dec = HistoryCodec[1];
