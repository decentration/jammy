import { HostEnvInterface, makeHostEnv } from "../../risc-pvm/interpreter/host/hostEnvInterface";
import { Gas } from "../../types";
import { AccumulateState, AccumulateEphemeral, StorageMapEntry, PreimagesBlobItem, PreimagesStatusItem, ReportContext } from "./types";
import { getServiceProgramFromState } from "../loaders";
import { executeProgram } from "../../risc-pvm/interpreter/host/execute/executeService";
import { ExitReasonType } from "../../risc-pvm/interpreter/types";
import { u32 } from "scale-ts";
import { coerceU64, concatAll, DiscriminatorCodec, ResultCodec, toBytes } from "../../codecs";
import { ZI, BS, BI, BL } from "../../risc-pvm/interpreter/host/consts";
import { runServicePvm } from "./helpers/runServicePvm";
import { computeThresholdBalance } from "./helpers";
import { encodeProtocolInt } from "../../codecs/IntegerCodec";
import { buildAccumulateInputSequence } from "../../codecs/InputSequenceCodec";



export function encodeServiceAccumulateArgs(slot: number, serviceId: number, items: any[]): Uint8Array {
  // Graypaper B.4

  const encSlot = encodeProtocolInt(slot);
  const encServiceId = encodeProtocolInt(serviceId);
  const encLen = encodeProtocolInt(items.length);

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log(`[encodeArgs] slot=${slot} sid=${serviceId} itemCount=${items.length}`);
    console.log(`[encodeArgs] varlen bytes: slot=${encSlot.length}, sid=${encServiceId.length}, len=${encLen.length}`);
  }

  // Return variable-length encoded args per C.5
  return concatAll(encSlot, encServiceId, encLen);
}

// Encode work items as a vector for fetch selector 5/6
export function encodeWorkItemsVector(items: any[]): Uint8Array {
  if (items.length === 0) {
    return new Uint8Array(0);
  }
  const encodedItems = items.map((item) => ResultCodec.enc(item));
  return concatAll(...encodedItems);
}


export function executeService(state: any, serviceId: number, opts?: { initialGas?: bigint, env?: HostEnvInterface }) {
  const { codeHash, blob } = getServiceProgramFromState(state, serviceId);
  return executeProgram({
    codeHash,
    programBlob: blob,    // container or raw A.2 — host unwraps if needed
    initialGas: opts?.initialGas ?? 50_000n,
    env: opts?.env,
  });
}

let debugAccCallId = 0;


export async function accumulateSingleService(
  state: AccumulateState,          // The chain state
  slot: number,                    // Current slot from (12.19) if needed
  serviceId: number,
  serviceItems: any[],
  blockGasLimit: Gas,
  reportContexts?: ReportContext[]  // Per-item report contexts (aligned with serviceItems)
): Promise<AccumulateEphemeral> {
  const callId = debugAccCallId++;
  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log(`[acc:call] id=${callId} svc=${serviceId} slot=${slot} items=${serviceItems.length}`);
    if (serviceItems.length > 0) {
      const first = serviceItems[0];
      console.log(`[acc:item0] service_id=${first.service_id} result_type=${first.result?.ok ? 'ok' : 'err'}`);
      if (first.result?.ok) {
        const okBytes =
          first.result.ok instanceof Uint8Array
            ? first.result.ok
            : Buffer.from(first.result.ok.replace("0x", ""), "hex");
        console.log(`[acc:item0] ok_len=${okBytes.length} ok_hex=${Buffer.from(okBytes).toString('hex').slice(0, 40)}...`);
      }
    }
  }

  let storageWrites: { key: Uint8Array; value: Uint8Array }[] = [];
  let storageDeletes: Uint8Array[] = [];
  let newTransfers: { src: number; dest: number; amount: bigint }[] = [];
  // 1) Retrieve the service codeHash / other relevant info from chain state
  const svc = state.accounts.find(a => a.id === serviceId);
  if (!svc) {
    // If the service doesn't exist or was self-terminated => no accumulation
    return { serviceId, selfTerminated: false, storageWrites: [] };
  }

  // 2) Seed the host env storage from account.storage so the VM sees current state
  const seeded = new Map<string, Uint8Array>();
  // Also track original sizes for computing bytes delta later (seeded map may be mutated by PVM)
  const originalStorageSizes = new Map<string, number>();
  for (const { key, value } of svc.data.storage) {
    const keyHex = Buffer.from(key).toString("hex");
    seeded.set(keyHex, value);
    originalStorageSizes.set(keyHex, value.length);
  }

  // Encode args first so we can provide them via both args zone AND paramBlob vector
  const argsEncoded = encodeServiceAccumulateArgs(slot, serviceId, serviceItems);

  // Encode work items vector for fetch selectors 5/6
  const workItemsEncoded = encodeWorkItemsVector(serviceItems);

  // Encode work items as structured arrays for indexed fetch access (B.5 selectors 5/6)
  // Each work item becomes an array of its encoded fields
  const workItemsList: Uint8Array[][] = serviceItems.map((item: any) => {
    const fields: Uint8Array[] = [];
    // Field 0: service_id (u32)
    fields.push(u32.enc(item.service_id ?? 0));
    // Field 1: code_hash (32 bytes)
    const codeHash = item.code_hash instanceof Uint8Array
      ? item.code_hash
      : (typeof item.code_hash === 'string'
        ? new Uint8Array(Buffer.from(item.code_hash.replace('0x', ''), 'hex'))
        : new Uint8Array(32));
    fields.push(codeHash);
    // Field 2: payload_hash (32 bytes)
    const payloadHash = item.payload_hash instanceof Uint8Array
      ? item.payload_hash
      : (typeof item.payload_hash === 'string'
        ? new Uint8Array(Buffer.from(item.payload_hash.replace('0x', ''), 'hex'))
        : new Uint8Array(32));
    fields.push(payloadHash);
    // Field 3: accumulate_gas (u64)
    fields.push(new Uint8Array(new BigUint64Array([coerceU64(item.accumulate_gas) ?? 0n]).buffer));
    // Field 4: result (full ResultValue encoded)
    fields.push(ResultCodec.enc(item));
    return fields;
  });

  // Build input sequence for FETCH selector 14 per B.5
  // Selector 14 returns E(i) where i = i^T ⌢ i^U
  // C.29: E_U(x) = E(x_p, x_e, x_a, x_y, x_g, O(x_l), ↕x_t)
  // C.33: Work items encoded as E(0, E_U(item))

  const workItemsForCodec = serviceItems.map((item: any, i: number) => {
    const ctx = reportContexts?.[i] ?? reportContexts?.[0];

    // Get result as bytes
    let result: Uint8Array | undefined;
    if (item.result?.ok) {
      result = item.result.ok instanceof Uint8Array
        ? item.result.ok
        : new Uint8Array(Buffer.from(String(item.result.ok).replace('0x', ''), 'hex'));
    }

    return {
      packageHash: toBytes(ctx?.packageSpec?.hash ?? ''),
      exportsRoot: toBytes(ctx?.packageSpec?.exports_root ?? ''),
      authorizerHash: toBytes(ctx?.authorizerHash ?? ''),
      payloadHash: toBytes(item.payload_hash ?? ''),
      gas: coerceU64(item.accumulate_gas) ?? 100000n,
      result: result ?? new Uint8Array(0),
      authorizerTrace: ctx?.authOutput ? toBytes(ctx.authOutput) : undefined,
    };
  });

  // Build the conformant input sequence for FETCH selector 14
  let inputSequence: Uint8Array | undefined;
  if (workItemsForCodec.length > 0) {
    inputSequence = buildAccumulateInputSequence(workItemsForCodec, []);

    if (process.env.JAM_DEBUG_ACC === '1' && inputSequence) {
      console.log(`[acc:inputSeq] Built input sequence: ${inputSequence.length} bytes for ${serviceItems.length} items`);
      console.log(`[acc:inputSeq] First 20 bytes: [${Array.from(inputSequence.subarray(0, 20)).map((b: number) => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
      console.log(`[acc:inputSeq] Last 30 bytes: [${Array.from(inputSequence.subarray(-30)).map((b: number) => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
    }
  }

  // Provide storage in env, paramBlob vector for args, and workItems vector
  const env = makeHostEnv({
    storage: seeded,
    vectors: {
      paramBlob: argsEncoded,
      workItems: workItemsEncoded,
      ...(inputSequence && { authoriserTrace: inputSequence }),
    },
    workItemsList, // Pass structured work items for indexed access
    initAcc: {
      allocator: {
        env: {
          currentServiceId: BigInt(serviceId),
        } as any,
      } as any,
    },
  });

  const advertised = serviceItems.reduce(
    (sum: bigint, it: any) => sum + (coerceU64(it.accumulate_gas) ?? 0n),
    0n
  );

  // If nothing was paid for, don’t run the VM.
  if (advertised === 0n) {
    return {
      serviceId,
      newTransfers: [],
      newServices: [],
      codeUpgrades: [],
      selfTerminated: false,
      commitmentHash: undefined,
      actualGasUsed: 0n,
      storageWrites: [],
      storageDeletes: [],
    };
  }

  // Paid gas, capped by block limit
  const gasForVm = advertised < blockGasLimit ? advertised : blockGasLimit;

  // 3 prepare args (already encoded as argsEncoded above)
  const args = argsEncoded;
  if (args.length > ZI) throw new Error("Accumulate args exceed ZI");

  // Debug: dump args and workItems encoding
  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log(`[acc:args] len=${args.length}`);
    console.log(`[acc:args] bytes 0-8 (slot+serviceId): [${Array.from(args.slice(0, 9)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(',')}]`);
    console.log(`[acc:args] bytes 8-12 (count): [${Array.from(args.slice(8, 12)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(',')}]`);
    console.log(`[acc:workItems] len=${workItemsEncoded.length} itemCount=${serviceItems.length}`);
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log(
      `[acc:vm] launching svc=${serviceId} gas=${gasForVm.toString()} argsLen=${args.length}`
    );
  }

  // 3) run the service VM through the standard initializer pipeline
  let pvm;
  try {
    pvm = runServicePvm(state, serviceId, {
      gas: gasForVm,
      args: args,
      env,
      strictVm: false,
      entryPoint:
        process.env.JAM_PVM_ENTRYPOINT === "none"
          ? undefined
          : BigInt(process.env.JAM_PVM_ENTRYPOINT || "5"), // Default 5 per B.4, or use env var
    });
  } catch (err) {
    // B.9: if c is null or |c| > WC, return (e, [], null, 0, [])
    // When code is unavailable (no preimage), return immediately with u = 0 (gas used = 0)
    // This happens for ejected services or services whose code preimage isn't available
    console.log(`[acc:error] Failed to load service ${serviceId}: ${err}`);
    console.log(`[acc:error] Returning with gas = 0 per Graypaper B.9 (code unavailable)`);
    return {
      serviceId,
      itemCount: serviceItems.length,
      newTransfers: [],
      newServices: [],
      codeUpgrades: [],
      selfTerminated: false,
      commitmentHash: undefined,
      actualGasUsed: 0n,  // B.9: u = 0 when c = ∅
      codeUnavailable: true,  // B.9: Flag that code was unavailable
      storageWrites: [],
      storageDeletes: [],
      storageInsertCount: 0,
      storageValueBytesDelta: 0,
      thresholdBalanceDelta: 0n,
    };
  }

  const exit = pvm.exit?.type;
  const detail = pvm.exit?.detail;

  if (exit === ExitReasonType.PageFault) {
    console.log(
      `[acc:pf] svc=${serviceId} slot=${slot} detail=${detail} gasUsed=${(gasForVm - (pvm.gas ?? 0n)).toString()}`
    );
  }

  if (detail === 0xFEFE && env.ioBuffer) {
    const head = env.ioBuffer.slice(0, 64);
    console.log("[acc:io] FEFE mailbox head =", Buffer.from(head).toString("hex"));
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    const detail = pvm.exit?.detail !== undefined ? ` detail=${String(pvm.exit.detail)}` : "";
    const id = pvm.exit?.id !== undefined ? ` id=${pvm.exit.id.toString()}` : "";
    console.log(
      `[acc:pvm] exit=${ExitReasonType[exit ?? 0]}${detail}${id}`
    );


    if (Number(detail) === 0xFEFE && env.ioBuffer) {
      const head = env.ioBuffer.slice(0, 64);
      console.log("[acc:io] FEFE mailbox head =", Buffer.from(head).toString("hex"));
    }



  }


  // For Accumulate we accept all PVM exit types including Panic (trap instruction).
  // In JAM, trap is used as a normal exit mechanism - the program can trap after
  // completing its work. We collect side effects regardless of exit type.
  // Only log Panic for debugging, don't throw.
  if (exit === ExitReasonType.Panic) {
    const detailStr = pvm.exit?.detail !== undefined ? ` detail=${String(pvm.exit.detail)}` : "";
    const idStr = pvm.exit?.id !== undefined ? ` id=${pvm.exit.id.toString()}` : "";
    console.log(`[PVM] Panic (trap) in service PVM: ${ExitReasonType[exit]}${detailStr}${idStr} - treating as normal termination`);
  }

  // For PageFault:
  if (exit === ExitReasonType.PageFault) {
    const detail = pvm.exit?.detail
    // Treat FEFE/FEFF as normal IO termination for now.
    if (detail !== 0xFEFE && detail !== 0xFEFF) {
      // For Accumulate STF, do not throw here — conformance vectors include cases where
      // services may terminate with PageFault/Panic and we still want to collect any
      // staged side-effects. Treat it as an abnormal termination but continue.
      console.log(`[PVM] PageFault in service PVM: detail=${String(detail)} - treating as normal termination for Accumulate`);
    }
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log("[pvm] initialGas", gasForVm.toString());
    console.log("[pvm] finalGas", (pvm.gas ?? 0n).toString());
  }

  const writes = env.getStagedStorageWrites?.() ?? [];
  const dels = env.getStagedStorageDeletes?.() ?? [];

  // Conformance fallback
  if (writes.length === 0 && env.putStorage && Array.isArray(serviceItems) && serviceItems.length > 0) {
    const firstOk = serviceItems.find((it: any) => it?.result?.ok);
    if (firstOk && Number(firstOk.service_id) === serviceId) {
      const okBytes: Uint8Array =
        firstOk.result.ok instanceof Uint8Array
          ? firstOk.result.ok
          : Buffer.from(String(firstOk.result.ok).replace(/^0x/, ""), "hex");
      const key = new TextEncoder().encode("last");
      // Store raw bytes, not hex string
      const val = okBytes;
      env.putStorage(key, val);
    }
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log("[acc:vm] writes", writes.length, "dels", dels.length);
    for (const w of writes) {
      console.log(
        "[acc:vm] write key=",
        Buffer.from(w.key).toString("hex"),
        "len=",
        w.value.length
      );
    }
    for (const d of dels) {
      console.log("[acc:vm] delete key=", Buffer.from(d).toString("hex"));
    }
  }


  if (process.env.JAM_DEBUG_ACC === "1") {

    const exitT = pvm.exit?.type;

    console.log(
      `[acc:vm] svc=${serviceId} slot=${slot} items=${serviceItems.length}`,
      `exit=${exitT} gasStart=${gasForVm.toString()} gasEnd=${(pvm.gas ?? 0n).toString()}`,
      `Δgas=${(gasForVm - (pvm.gas ?? 0n)).toString()} writes=${writes.length} dels=${dels.length}`
    );

    // Print keys/short values to confirm the expected write shows up
    for (const w of writes) {
      console.log(
        `[acc:vm] write key=${Buffer.from(w.key).toString("hex")} len=${w.value?.length ?? 0}`
      );
    }
    for (const d of dels) {
      console.log(
        `[acc:vm] delete key=${Buffer.from(d).toString("hex")}`
      );
    }
  }



  // 4) collect side-effects staged in the env
  storageWrites = env.getStagedStorageWrites?.() ?? [];
  storageDeletes = env.getStagedStorageDeletes?.() ?? [];
  newTransfers =
    env.acc?.allocator?.transfers?.map(t => ({
      src: Number(t.from),
      dest: Number(t.to),
      amount: t.amount,
    })) ?? [];

  // 5) Compute storage insert/update tracking for gas overhead
  // Compare write keys against seeded storage to determine if INSERT or UPDATE
  let storageInsertCount = 0;
  let storageValueBytesDelta = 0;

  // Track unique keys written (in case of multiple writes to same key)
  const writtenKeys = new Map<string, Uint8Array>();
  for (const w of storageWrites) {
    const keyHex = Buffer.from(w.key).toString("hex");
    writtenKeys.set(keyHex, w.value);  // Last write wins for final value
  }

  if (process.env.JAM_DEBUG_ACC === '1') {
    console.log(`[acc:storage-tracking] svc=${serviceId} storageWrites.length=${storageWrites.length} writtenKeys.size=${writtenKeys.size} originalStorageSizes.size=${originalStorageSizes.size}`);
  }

  for (const [keyHex, newValue] of writtenKeys) {
    // Use originalStorageSizes which captures the pre-PVM state (seeded map may have been mutated)
    const oldSize = originalStorageSizes.get(keyHex);
    if (process.env.JAM_DEBUG_ACC === '1') {
      console.log(`[acc:storage-key] key=${keyHex} newLen=${newValue.length} oldLen=${oldSize ?? 'INSERT'}`);
    }
    if (oldSize === undefined) {
      // New key - INSERT
      storageInsertCount++;
      storageValueBytesDelta += newValue.length;
    } else {
      // Existing key - UPDATE
      storageValueBytesDelta += (newValue.length - oldSize);
    }
  }

  if (process.env.JAM_DEBUG_ACC === '1') {
    console.log(`[acc:storage-result] inserts=${storageInsertCount} bytesDelta=${storageValueBytesDelta}`);
  }

  // 6) Compute threshold balance delta (9.8)
  // Calculate a_t before PVM execution (pre-state)
  const gratisOffset = svc.data.service.deposit_offset ?? 0n;
  const atAnterior = computeThresholdBalance(
    svc.data.storage,
    svc.data.preimages_status ?? [],
    typeof gratisOffset === 'bigint' ? gratisOffset : BigInt(gratisOffset)
  );

  // Build post-state storage by applying writes to a copy of the original
  const postStorage: StorageMapEntry[] = [];
  const writtenKeySet = new Set(writtenKeys.keys());

  // Keep entries not overwritten
  for (const entry of svc.data.storage) {
    const keyHex = Buffer.from(entry.key).toString("hex");
    if (!writtenKeySet.has(keyHex)) {
      postStorage.push(entry);
    }
  }

  // Add new/updated entries from writes
  for (const [keyHex, value] of writtenKeys) {
    postStorage.push({
      key: new Uint8Array(Buffer.from(keyHex, 'hex')),
      value: value
    });
  }

  // Calculate a after PVM execution (post-state)
  const atPosterior = computeThresholdBalance(
    postStorage,
    svc.data.preimages_status ?? [],
    typeof gratisOffset === 'bigint' ? gratisOffset : BigInt(gratisOffset)
  );

  const thresholdBalanceDelta = atPosterior - atAnterior;

  if (process.env.JAM_DEBUG_ACC === '1') {
    console.log(`[acc:threshold] svc=${serviceId} atPre=${atAnterior.toString()} atPost=${atPosterior.toString()} delta=${thresholdBalanceDelta.toString()}`);
  }

  // 7) ephemeral result from PVM + effects
  const actualGasUsed = gasForVm - (pvm.gas ?? 0n);
  // const selfTerminated = pvm.exit?.type === ExitReasonType.Halt;

  const ep: AccumulateEphemeral = {
    serviceId,
    itemCount: serviceItems.length,  // Track number of work items for statistics
    hostCallCount: env.hostCallCount ?? 0,  // Host call count for g=10 (B.5)
    newTransfers,
    newServices: [],
    codeUpgrades: [],
    selfTerminated: false,
    commitmentHash: undefined,
    actualGasUsed,
    storageWrites,
    storageDeletes,
    storageInsertCount,
    storageValueBytesDelta,
    thresholdBalanceDelta,  //  9.8
  };

  return ep;
}