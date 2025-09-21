import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { BYTES_PER_BLESS_HASH, MAX_BLESS_SELECTOR_SLOTS, OK, SVC_ID, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000;
const GAS  = 100;

function codeBless(m = 1, a = 2, v = 3, o = HEAP, n = 2): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  m & 255,  m >> 8 & 255,  m >> 16 & 255,  m >> 24 & 255,
    Opcodes.load_imm, 8,  a & 255,  a >> 8 & 255,  a >> 16 & 255,  a >> 24 & 255,
    Opcodes.load_imm, 9,  v & 255,  v >> 8 & 255,  v >> 16 & 255,  v >> 24 & 255,
    Opcodes.load_imm,10,  o & 255,  o >> 8 & 255,  o >> 16 & 255,  o >> 24 & 255,
    Opcodes.load_imm,11,  n & 255,  n >> 8 & 255,  n >> 16 & 255,  n >> 24 & 255,
    Opcodes.ecalli, 14,
    Opcodes.trap
  );
}

const mask = Uint8Array.of(0b0100_0001,0b0001_0000, 0b0000_0100,0b0100_0001, 0b0000_0001);

function makeBlob(code: Uint8Array): Uint8Array {
    return buildBlob({
      meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z:1,
      instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask
    });
  }
  
  describe("ΩB bless handler", () => {
    it("happy-path -> OK, selector map updated", () => {
      // prepare 2x12-byte records at HEAP
      const mem = new Uint8Array(1 << 20);
      
      // (g) bytes for 2 bless hashes
      const gBytes = Uint8Array.of(
        1,0,0,0,  0x11,0x11,0x11,0x11,0x11,0x11,0x11,0x11,
        2,0,0,0,  0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22
      );

      
      // const gBytes = new Uint8Array(BYTES_PER_BLESS_HASH * 2).fill(7);
      mem.set(gBytes, HEAP);
  
      const env = makeHostEnv();
      env.acc.allocator.env.currentServiceId = SVC_ID;

      const st  = runBlob(makeBlob(codeBless()), GAS, { env, memInit: mem });
  
      // we read from the overlay (instead of the placehodler getService): (xe).d[SVC_ID]
      const staged = env.acc.allocator.env.deltas.get(SVC_ID) as ServiceAccount | undefined;
      expect(staged).toBeTruthy(); 

      const entry = staged!.selectorMap.get(1)!; // m = 1
  
      expect(st.registers[7]).toBe(OK);
      expect(entry.authSlot).toBe(2);
      expect(entry.versionSlot).toBe(3);
      expect(entry.extCodeHash64).toEqual(gBytes.slice(4,12));   // the 0x11… hash
      expect(st.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("selector out-of-range -> WHO", () => {
      const mem = new Uint8Array(1 << 20);
      const env = makeHostEnv();

      const BAD = MAX_BLESS_SELECTOR_SLOTS; // 65 536

      const st  = runBlob(makeBlob(codeBless(BAD, 2, 3)), GAS, { env, memInit: mem });
  
      expect(st.registers[7]).toBe(WHO);
    });
  });
  

