import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { OK, WHO, HUH } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { makeOpcodeBitmask } from "./helpers";

const GAS = 200n;

function mkCode(n=0,p=16,c=2,r=1) {
  return Uint8Array.of(
    Opcodes.load_imm, 7, n&255,0,0,0,           // n
    Opcodes.load_imm, 8, p&255,0,0,0,           // p
    Opcodes.load_imm, 9, c&255,0,0,0,           // c
    Opcodes.load_imm,10, r&255,0,0,0,           // r
    Opcodes.ecalli, 11,
    Opcodes.trap
  );
}

const mask = makeOpcodeBitmask(mkCode(), [0, 6, 12, 18, 24, 26]);

const mkBlob = (code:Uint8Array) =>
  buildBlob({ meta:new Uint8Array([0]), jumpTbl:new Uint8Array([0]), z:1,
              instr:code, jumpEntries:[new Uint8Array([0])], bitmaskBits:mask });

test("pages ok: R over existing pages, r7=OK", () => {
  const env = makeHostEnv();
  // seed machine 0 with a basic u where target pages are already R (so r=3 path okay)
  env.machineTable.set(0, { p:new Uint8Array([0]), u:{ vPages:new Map(), aPages:new Map([[16,1],[17,1]]) }, i:0 });

  // r=3 (R, no zero), p=16, c=2
  const st = runBlob(mkBlob(mkCode(0,16,2,3)), GAS, { env, memInit:new Uint8Array(1<<20) });
  expect(st.registers[7]).toBe(OK);
});

test("pages who: missing machine", () => {
  const env = makeHostEnv();
  const st = runBlob(mkBlob(mkCode(7,16,1,1)), GAS, { env, memInit:new Uint8Array(1<<20) });
  expect(st.registers[7]).toBe(WHO);
});

test("pages huh: r>4", () => {
  const env = makeHostEnv();
  env.machineTable.set(0, { p:new Uint8Array([0]), u:{ vPages:new Map(), aPages:new Map() }, i:0 });
  const st = runBlob(mkBlob(mkCode(0,16,1,5)), GAS, { env, memInit:new Uint8Array(1<<20) });
  expect(st.registers[7]).toBe(HUH);
});

test("pages huh: p<16", () => {
  const env = makeHostEnv();
  env.machineTable.set(0, { p:new Uint8Array([0]), u:{ vPages:new Map(), aPages:new Map() }, i:0 });
  const st = runBlob(mkBlob(mkCode(0,0,1,1)), GAS, { env, memInit:new Uint8Array(1<<20) });
  expect(st.registers[7]).toBe(HUH);
});

test("pages huh: r>2 but target empty", () => {
  const env = makeHostEnv();
  env.machineTable.set(0, { p:new Uint8Array([0]), u:{ vPages:new Map(), aPages:new Map() }, i:0 });
  // r=4 wants W w/o zeroing; target page 16 is currently empty => HUH
  const st = runBlob(mkBlob(mkCode(0,16,1,4)), GAS, { env, memInit:new Uint8Array(1<<20) });
  expect(st.registers[7]).toBe(HUH);
});
