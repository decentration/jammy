import { fromLE, panic, readBytes, toLE, writeBytes } from "../../instructions/helpers";
import { ExitReasonType, InterpreterState } from "../../types";
import { WHO, OK, E, FAULT, HALT, HOST, OOG, PANIC } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler } from "../types";

// ΩK  – invoke  (selector 25)
export const invokeHandler: HostCallHandler = (state, _id, env) => {
	const n = Number(state.registers[7]);  // machine‑id
	const o = Number(state.registers[8]);  // pointer to 112 byte call blob

	const entry = env.machineTable.get(n);
	if (!entry) return finish(state, WHO);

	const { bytes, state: s1 } = readBytes(state, o, 112);
	if (!bytes) return { state: panic(s1), ok: true };

	// decode g (8 bytes) and w (13 regs * 8 bytes = 104)
	const gas = fromLE(bytes, 0, 8);
	const regsIn = new BigUint64Array(13);

	// 13 registers, each 8 bytes
	for (let i = 0; i < 13; i++) regsIn[i] = fromLE(bytes, 8 + i * 8, 8);

	// Ψ - run inner VM once
	if (!env.runInnerMachine) return { state: panic(s1), ok: true }; 

	// run inner machine
	const {
		exit,
		nextIc,
		gasRemaining,
		regs: regsOut,
		u: memOut,
		hostId,
		faultPage,
	  } = env.runInnerMachine(entry.p, entry.i, gas, regsIn, entry.u);

	// prepare write-back blob
	const out = new Uint8Array(112);
	out.set(toLE(gasRemaining, 8)); // 8 byte little-endian integer

	// 13 registers, each 8 bytes
	for (let i = 0; i < 13; i++) out.set(toLE(regsOut[i], 8), 8 + i * 8);

	console.log("[ΩK] write-back @", o, "len=112");
  const s2: InterpreterState = { ...s1, exit: { type: ExitReasonType.Continue } };

	let s3 = writeBytes(s2, o, out);
	console.log("[ΩK] write-back exit=", s3.exit ? ExitReasonType[s3.exit.type] : "ok");

	if (s3.exit && s3.exit.type !== ExitReasonType.Continue) {
		console.log("[ΩK] writeBytes exit=", ExitReasonType[s3.exit.type]);
		return { state: panic(s3), ok: true };
	}
  const oldI = env.machineTable.get(n)!.i;

	// persist back into the table
	env.machineTable.set(n, {
		p: entry.p,
		u: memOut,
    i: exit === ExitReasonType.HostCall ? (nextIc + 1) : nextIc,
	});

	console.log("[ΩK] table i:", oldI, "→", env.machineTable.get(n)!.i);

	// map exit to outer r7 and r8
	const map = (st: typeof s3, r7: bigint, r8?: bigint) => ({
		ok: true,
		state: {
			...st,
			registers: Object.assign([], st.registers, r8 === undefined ? { 7: r7 } : { 7: r7, 8: r8 }),
		},
	});

	switch (exit) {
			case ExitReasonType.HostCall:  return map(s3, HOST, hostId ?? 0n);
			case ExitReasonType.PageFault: return map(s3, FAULT, faultPage ?? 0n);
			case ExitReasonType.OutOfGas:  return map(s3, OOG);
			case ExitReasonType.Panic:     return map(s3, PANIC);
			case ExitReasonType.Halt:      return map(s3, HALT);
			default:                       return map(s3, PANIC);
	  }
	};
  