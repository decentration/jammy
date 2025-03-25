import { Codec } from "scale-ts";
import { ServiceActivityRecord } from "../types";
import { decodeProtocolInt, encodeProtocolInt } from "./IntegerCodec";
import { concatAll, toUint8Array } from "./utils";

export const ServiceActivityRecordCodec: Codec<ServiceActivityRecord> = [
  // ENCODER
  (record: ServiceActivityRecord): Uint8Array => {
    const providedCount       = encodeProtocolInt(record.provided_count);
    const providedSize        = encodeProtocolInt(record.provided_size);
    const refinementCount     = encodeProtocolInt(record.refinement_count);
    const refinementGasUsed   = encodeProtocolInt(record.refinement_gas_used);
    const imports             = encodeProtocolInt(record.imports);
    const extrinsicCount      = encodeProtocolInt(record.extrinsic_count);
    const extrinsicSize       = encodeProtocolInt(record.extrinsic_size);
    const exports             = encodeProtocolInt(record.exports);
    const accumulateCount     = encodeProtocolInt(record.accumulate_count);
    const accumulateGasUsed   = encodeProtocolInt(record.accumulate_gas_used);
    const onTransfersCount    = encodeProtocolInt(record.on_transfers_count);
    const onTransfersGasUsed  = encodeProtocolInt(record.on_transfers_gas_used);

    return concatAll(
      providedCount,
      providedSize,
      refinementCount,
      refinementGasUsed,
      imports,
      extrinsicCount,
      extrinsicSize,
      exports,
      accumulateCount,
      accumulateGasUsed,
      onTransfersCount,
      onTransfersGasUsed
    );
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    function readProtocolInt(): number {
      const { value, bytesRead } = decodeProtocolInt(uint8.slice(offset));
      offset += bytesRead;
      return value;
    }

    const provided_count        = readProtocolInt();
    const provided_size         = readProtocolInt();
    const refinement_count      = readProtocolInt();
    const refinement_gas_used   = readProtocolInt();
    const imports_              = readProtocolInt();
    const extrinsic_count       = readProtocolInt();
    const extrinsic_size        = readProtocolInt();
    const exports_              = readProtocolInt();
    const accumulate_count      = readProtocolInt();
    const accumulate_gas_used   = readProtocolInt();
    const on_transfers_count    = readProtocolInt();
    const on_transfers_gas_used = readProtocolInt();

    const record: ServiceActivityRecord = {
      provided_count,
      provided_size,
      refinement_count,
      refinement_gas_used,
      imports: imports_,
      extrinsic_count,
      extrinsic_size,
      exports: exports_,
      accumulate_count,
      accumulate_gas_used,
      on_transfers_count,
      on_transfers_gas_used,
    };

    return {
      value: record,
      bytesUsed: offset,
    };
  },
] as unknown as Codec<ServiceActivityRecord>;

ServiceActivityRecordCodec.enc = ServiceActivityRecordCodec[0];
ServiceActivityRecordCodec.dec = ServiceActivityRecordCodec[1];
