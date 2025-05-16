import { Codec, Bytes } from "scale-ts";
import { AuthPoolsCodec, DiscriminatorCodec, decodeWithBytesUsed, AvailAssignmentsCodec, ValidatorsInfoCodec, EntropyBufferCodec, BlockItemCodec, OffendersMarkCodec, CoresStatisticsCodec } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs/utils";
import { ReportsState } from "../types";
import { ServicesCodec } from "./Services/ServicesCodec";
import { ServicesStatisticsCodec } from "../../../codecs/ServicesStatisticsCodec";
import { convertToReadableFormat } from "../../../utils";

const HashCodec      = Bytes(32);
const OffendersCodec = DiscriminatorCodec(HashCodec);
export const ReportsStateCodec: Codec<ReportsState> = [
  // --- ENCODER ---
  (state: ReportsState): Uint8Array => {
    const encAvail = AvailAssignmentsCodec.enc(state.avail_assignments);
    const encCurrVal = ValidatorsInfoCodec.enc(state.curr_validators);
    const encPrevVal = ValidatorsInfoCodec.enc(state.prev_validators);
    const encEntropy = EntropyBufferCodec.enc(state.entropy);
    const encOffenders = OffendersCodec.enc(state.offenders);
    const encRecentBlocks = DiscriminatorCodec(BlockItemCodec).enc(state.recent_blocks);
    const encAuthPools = AuthPoolsCodec.enc(state.auth_pools);
    const encServices = ServicesCodec.enc(state.accounts);

    const encCoresStats    = CoresStatisticsCodec.enc(state.cores_statistics);
    const encServicesStats = ServicesStatisticsCodec.enc(state.services_statistics);

    const result = concatAll(
      encAvail,
      encCurrVal,
      encPrevVal,
      encEntropy,
      encOffenders,
      encRecentBlocks,
      encAuthPools,
      encServices,
      encCoresStats,
      encServicesStats,
    );

    console.log('ReportsStateCodec.enc result', convertToReadableFormat(result)); 

    return result;
  },

  // --- DECODER ---
  (data: ArrayBuffer | Uint8Array | string): ReportsState => {

    const uint8 = toUint8Array(data);
    let offset = 0;

    console.log('ReportsStateCodec.dec data', convertToReadableFormat(data));

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      console.log('read', value, bytesUsed);
      offset += bytesUsed;
      return value;
    }

    const avail_assignments = read(AvailAssignmentsCodec);
    const curr_validators   = read(ValidatorsInfoCodec);
    const prev_validators   = read(ValidatorsInfoCodec);
    const entropy           = read(EntropyBufferCodec);
    const offenders         = read(OffendersMarkCodec);
    const recent_blocks     = read(DiscriminatorCodec(BlockItemCodec));
    const auth_pools        = read(AuthPoolsCodec);
    const accounts          = read(ServicesCodec);

    const cores_statistics    = read(CoresStatisticsCodec);
    const services_statistics = read(ServicesStatisticsCodec);

    return {
      avail_assignments,
      curr_validators,
      prev_validators,
      entropy,
      offenders,
      recent_blocks,
      auth_pools,
      accounts,
      cores_statistics,
      services_statistics
    };
  },
] as unknown as Codec<ReportsState>;

ReportsStateCodec.enc = ReportsStateCodec[0];
ReportsStateCodec.dec = ReportsStateCodec[1];

