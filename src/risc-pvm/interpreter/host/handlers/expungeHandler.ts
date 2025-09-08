import { WHO } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler } from "../types";

// ΩX  – expunge (selector 13)
export const expungeHandler: HostCallHandler = (state, _id, env) => {
const n = Number(state.registers[7]);
const entry = env.machineTable.get(n);
if (!entry) return finish(state, WHO);

env.machineTable.delete(n);
return finish(state, BigInt(entry.i ?? 0));
};
