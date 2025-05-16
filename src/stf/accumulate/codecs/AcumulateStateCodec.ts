import { Bytes, Codec, u32 } from "scale-ts";
import { AccumulateState} from "../types"; 
import { concatAll, decodeWithBytesUsed } from "../../../codecs";
import { ReadyQueueCodec } from "./ReadyQueueCodec";
import { PrivilegesCodec } from "./PrivilegesCodec";
import { AccountsCodec } from "./AccountsCodec";
import { AccumulatedQueueCodec } from "./AccumulatedQueueCodec";

// export interface AccumulateState { 
//     slot: number,
//     entropy: Entropy,
//     ready_queue: ReadyQueue[],
//     accumulated: ReadyQueue[],
//     privileges: Privileges,
//     accounts: AccountItem[],
// }

export const AccumulateStateCodec: Codec<AccumulateState> = [
  // ENCODER
  (state: AccumulateState): Uint8Array => {
    // Encode
    // const encAvailAssignments = AvailAssignmentsCodec.enc(state.avail_assignments);
    // const encCurrValidators = CurrValidatorsCodec.enc(state.curr_validators);

    const encSlot = u32.enc(state.slot);
    const encEntropy = Bytes(32).enc(state.entropy);
    const encReadyQueue = ReadyQueueCodec.enc(state.ready_queue);
    const encAccumulated = AccumulatedQueueCodec.enc(state.accumulated);
    const encPrivileges = PrivilegesCodec.enc(state.privileges);
    const encAccounts = AccountsCodec.enc(state.accounts);


    // Concatenate
    return concatAll( 
      encSlot, 
      encEntropy, 
      encReadyQueue,
      encAccumulated,
      encPrivileges,
      encAccounts
    );
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AccumulateState => {
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

    const slot = read(u32);
    const entropy = read(Bytes(32));
    const ready_queue = read(ReadyQueueCodec);
    const accumulated = read(AccumulatedQueueCodec);
    const privileges = read(PrivilegesCodec);
    const accountItems = read(AccountsCodec);
  

    return {
      slot,
      entropy,
      ready_queue,
      accumulated,
      privileges,
      accounts: accountItems,
    };
  },
] as unknown as Codec<AccumulateState>;

AccumulateStateCodec.enc = AccumulateStateCodec[0];
AccumulateStateCodec.dec = AccumulateStateCodec[1];


