import { Codec, Bytes } from "scale-ts";
import { AuthPoolsCodec, DiscriminatorCodec, decodeWithBytesUsed, AvailAssignmentsCodec, ValidatorsInfoCodec, EntropyBufferCodec, BlockItemCodec } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs/utils";
import { ReportsState } from "../types";
import { ServicesCodec } from "./Services/ServicesCodec";

export const ReportsStateCodec: Codec<ReportsState> = [
  // --- ENCODER ---
  (state: ReportsState): Uint8Array => {
    const encAvail = AvailAssignmentsCodec.enc(state.avail_assignments);
    const encCurrVal = ValidatorsInfoCodec.enc(state.curr_validators);
    const encPrevVal = ValidatorsInfoCodec.enc(state.prev_validators);
    const encEntropy = EntropyBufferCodec.enc(state.entropy);
    const encOffenders = DiscriminatorCodec(Bytes(32)).enc(state.offenders);
    const encRecentBlocks = DiscriminatorCodec(BlockItemCodec).enc(state.recent_blocks);
    const encAuthPools = AuthPoolsCodec.enc(state.auth_pools);
    const encServices = ServicesCodec.enc(state.accounts);

    return concatAll(
      encAvail,
      encCurrVal,
      encPrevVal,
      encEntropy,
      encOffenders,
      encRecentBlocks,
      encAuthPools,
      encServices
    );
  },

  // --- DECODER ---
  (data: ArrayBuffer | Uint8Array | string): ReportsState => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const avail_assignments = read(AvailAssignmentsCodec);
    const curr_validators   = read(ValidatorsInfoCodec);
    const prev_validators   = read(ValidatorsInfoCodec);
    const entropy           = read(EntropyBufferCodec);
    const offenders         = read(DiscriminatorCodec(Bytes(32)));
    const recent_blocks     = read(DiscriminatorCodec(BlockItemCodec));
    const auth_pools        = read(AuthPoolsCodec);
    const accounts          = read(ServicesCodec);

    return {
      avail_assignments,
      curr_validators,
      prev_validators,
      entropy,
      offenders,
      recent_blocks,
      auth_pools,
      accounts
    };
  },
] as unknown as Codec<ReportsState>;

ReportsStateCodec.enc = ReportsStateCodec[0];
ReportsStateCodec.dec = ReportsStateCodec[1];

