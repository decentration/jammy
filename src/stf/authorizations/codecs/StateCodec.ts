import { Codec } from "scale-ts";
import { AuthorizationsState } from "../types";
import { AuthPoolsCodec } from "../../../codecs/AuthPools/AuthPoolsCodec";
import { AuthQueuesCodec } from "./AuthQueues/AuthQueuesCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs";

export const StateCodec: Codec<AuthorizationsState> = [
  // ENCODER
  (state: AuthorizationsState): Uint8Array => {
    // pools + queues
    const encPools = AuthPoolsCodec.enc(state.auth_pools);
    const encQueues = AuthQueuesCodec.enc(state.auth_queues);
    return concatAll(encPools, encQueues);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AuthorizationsState => {
    const uint8 = toUint8Array(data);

    let offset = 0;
    const { value: pools, bytesUsed: usedPools } = decodeWithBytesUsed(AuthPoolsCodec, uint8);
    offset += usedPools;
    
    // Now we want exactly 5120 bytes for auth_queues
    // Because we know 2 sub-arrays each 80 items => 2*(80*32) = 5120
    const sliceForQueues = uint8.slice(offset, offset + 5120);
    offset += 5120;
    
    // decode the 2 queues from that 5120 chunk
    const { value: queues, bytesUsed: usedQueues } = decodeWithBytesUsed(AuthQueuesCodec, sliceForQueues);
    
    // if usedQueues < 5120, we might have leftover in the queue chunk
    // or if usedQueues===5120, perfect
    if (usedQueues < 5120) {
      console.warn(`AuthQueues decoding used ${usedQueues} < 5120? leftover in that chunk?`);
    }
    
    // Now offset has advanced by usedPools + 5120
    if (offset < uint8.length) {
      console.warn(`StateCodec: leftover after reading pools+queues => offset=${offset}, total=${uint8.length}`);
    }
    return { auth_pools: pools, auth_queues: queues };
    
  },
] as unknown as Codec<AuthorizationsState>;

StateCodec.enc = StateCodec[0];
StateCodec.dec = StateCodec[1];
