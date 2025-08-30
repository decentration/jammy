import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { SVC_ID, OK, PAYLOAD_BYTES } from "../../../risc-pvm/interpreter/host/consts";
import { decodeDesignationsVector } from "../../../risc-pvm/interpreter/host/helpers";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000;

function code(ptr = HEAP) {
  return Uint8Array.of(
    Opcodes.load_imm, 7, ptr&255, ptr>>8&255, ptr>>16&255, ptr>>24&255,
    Opcodes.ecalli, 16,
    Opcodes.trap
  );
}

const mask = Uint8Array.of(0b0100_0001,0b0000_0001);
const mkBlob = (c:Uint8Array)=>
  buildBlob({meta:Uint8Array.of(0),jumpTbl:Uint8Array.of(0),z:1,
             instr:c,jumpEntries:[Uint8Array.of(0)],bitmaskBits:mask});

describe("ΩD designate handler", () => {
  it("stores designations inside the service account", () => {
    const mem  = new Uint8Array(1<<20);
    const payload = new Uint8Array(PAYLOAD_BYTES).map((_,i)=>i&0xff);
    mem.set(payload, HEAP);

    const env = makeHostEnv({
      initAcc: { allocator: { index: 0n, env: { deltas: new Map<bigint, any>(), currentServiceId: SVC_ID } }, session: {   } }
    });    
    const st  = runBlob(mkBlob(code()), 100, { env, memInit: mem });

    const expected = decodeDesignationsVector(payload)

    expect(st.registers[7]).toBe(OK);
    expect(env.acc.allocator.env.designations).toEqual(expected);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
