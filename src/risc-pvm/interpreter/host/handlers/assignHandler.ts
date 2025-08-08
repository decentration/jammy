import { readBytes } from "../../instructions/helpers";
import { Opcodes } from "../../instructions/opcodes";
import { ExitReasonType } from "../../types";
import { CORE, CORE_BYTES, CORES_PER_SERVICE, CORES_SIZE, OK, SVC_ID } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";

// ΩA – assign (selector 6)
// assign handler is used to assign a core to a service.
export const assignHandler: HostCallHandler = (state, _id, env) => {
	const queue_index = Number(state.registers[7]);   // (q) queue index
	const off = Number(state.registers[8]);     // (o) memory offset ptr to 32 x Q block

  if (queue_index >= CORES_PER_SERVICE) return finish(state, CORE);
	const need = CORES_SIZE;

	const { bytes, state: s1 } = readBytes(state, off, need);
	if (!bytes) return { state:{ ...state, exit:{ type: ExitReasonType.Panic } }, ok:true };

	//service: getService or create new service with default values
	const service: ServiceAccount = env.getService(SVC_ID) ?? {
      storage: new Map(),
      preimages: new Map(),
      lookupStorage: new Map(),
      rootCodeHash: 0n,
      balance: 0n,
      gasAccumulate: 0n,
      gasOnTransfer: 0n,
      cores: new Uint8Array(CORES_SIZE),
      selectorMap: new Map(),
    };

  service.cores = service.cores.length ? service.cores : new Uint8Array(CORES_SIZE);
	service.cores.set(bytes, queue_index * CORE_BYTES); // set cores at idx offset
	env.putService(SVC_ID, service); // stash cores here for later down the pipeline.


	return finish(s1, OK);
};
  