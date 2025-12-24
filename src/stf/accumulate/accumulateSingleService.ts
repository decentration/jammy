import { HostEnvInterface, makeHostEnv } from "../../risc-pvm/interpreter/host/hostEnvInterface";
import { Gas } from "../../types";
import { AccumulateState, AccumulateEphemeral } from "./types";
import { getServiceProgramFromState } from "../loaders";
import { executeProgram } from "../../risc-pvm/interpreter/host/execute/executeService";
import { ExitReasonType } from "../../risc-pvm/interpreter/types";
import { u32 } from "scale-ts";
import { coerceU64, concatAll, DiscriminatorCodec, ResultCodec } from "../../codecs";
import { ZI } from "../../risc-pvm/interpreter/host/consts";
import { runServicePvm } from "./helpers/runServicePvm";


export function encodeServiceAccumulateArgs(slot: number, serviceId: number, items: any[]): Uint8Array {
  const encSlot  = u32.enc(slot);
  const encSid   = u32.enc(serviceId);
  const encItems = DiscriminatorCodec(ResultCodec).enc(items);
  return concatAll(encSlot, encSid, encItems);
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
  blockGasLimit: Gas
): Promise<AccumulateEphemeral> {
  const callId = debugAccCallId++;
  console.log(`[acc:call] id=${callId} svc=${serviceId} slot=${slot} items=${serviceItems.length}`);
  
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
  for (const { key, value } of svc.data.storage) {
    seeded.set(Buffer.from(key).toString("hex"), value);
  }

  const env = makeHostEnv({ storage: seeded });

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
  
  // 3 prepare args
  const args = encodeServiceAccumulateArgs(slot, serviceId, serviceItems);
  if (args.length > ZI) throw new Error("Accumulate args exceed ZI");

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log(
      `[acc:vm] launching svc=${serviceId} gas=${gasForVm.toString()} argsLen=${args.length}`
    );
  }

  // 3) run the service VM through the standard initializer pipeline
  const pvm = runServicePvm(state, serviceId, {
    gas: gasForVm,
    args: args,
    env,
    strictVm: false,
  });

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
    const id     = pvm.exit?.id !== undefined ? ` id=${pvm.exit.id.toString()}` : "";
    console.log(
      `[acc:pvm] exit=${ExitReasonType[exit ?? 0]}${detail}${id}`
    );


    if (Number(detail) === 0xFEFE && env.ioBuffer) {
      const head = env.ioBuffer.slice(0, 64);
      console.log("[acc:io] FEFE mailbox head =", Buffer.from(head).toString("hex"));
    }

    
    
  }

  
  // For Accumulate we accept non-halt exits (PageFault, OutOfGas, etc.)
// and only treat Panic as a hard failure (for now).
if (exit === ExitReasonType.Panic) {
  const detail = pvm.exit?.detail !== undefined ? ` detail=${String(pvm.exit.detail)}` : "";
  const id     = pvm.exit?.id !== undefined ? ` id=${pvm.exit.id.toString()}` : "";
  throw new Error(`[PVM] Panic in service PVM: ${ExitReasonType[exit]}${detail}${id}`);
  
}

  // For PageFault:
  if (exit === ExitReasonType.PageFault) {
    const detail = pvm.exit?.detail
    // Treat FEFE/FEFF as normal IO termination for now.
    if (detail !== 0xFEFE && detail !== 0xFEFF) {
      throw new Error(`[PVM] Unexpected PageFault detail=${detail}`);
    }
  }

  console.log("[pvm] initialGas", gasForVm.toString());
  console.log("[pvm] finalGas", (pvm.gas ?? 0n).toString());

  const writes = env.getStagedStorageWrites?.() ?? [];
  const dels   = env.getStagedStorageDeletes?.() ?? [];

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


  if (process.env.JAM_DEBUG_ACC === "1") {
   
    const exitT  = pvm.exit?.type;

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

  // 5) ephemeral result from PVM + effects
  const actualGasUsed = gasForVm - (pvm.gas ?? 0n);
  // const selfTerminated = pvm.exit?.type === ExitReasonType.Halt;

  const ep: AccumulateEphemeral = {
    serviceId,
    newTransfers,
    newServices: [],
    codeUpgrades: [],
    selfTerminated: false,
    commitmentHash: undefined,
    actualGasUsed,
    storageWrites,
    storageDeletes,
  };

  return ep;
}