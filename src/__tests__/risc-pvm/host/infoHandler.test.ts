import { buildBlob }       from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }     from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }         from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }         from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }  from "../../../risc-pvm/interpreter/types";
import { NONE, OK, SVC_ID, WHO }   from "../../../risc-pvm/interpreter/host/consts";
import { encodeInfoHelper } from "../../../risc-pvm/interpreter/host/helpers";
import { EncodableAccount } from "../../../risc-pvm/interpreter/host/types";

const DEST = 0x18000;

function prog(): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7, 0xff,0xff,0xff,0xff,
    Opcodes.load_imm, 8, DEST&255, DEST>>8&255, DEST>>16&255, DEST>>24&255,
    Opcodes.ecalli, 4,
    Opcodes.trap
  );
}


const sa: EncodableAccount = {
  storage: new Map(),
  preimages: new Map(),
  lookupStorage: new Map(),
  rootCodeHash   : 0x1234n,
  balance        : 7n,
  gasAccumulate  : 0n,
  gasOnTransfer  : 0n,
  cores          : new Uint8Array(0),
  selectorMap    : new Map(),
  ticketNext     : 0n,
  coresOffset    : 0,
  ticketIndex    : 0
};

const SERVICE_ID = 0xFFFF_FFFF_FFFF_FFFFn;   // BigInt


const bitmask = Uint8Array.of(0b0100_0001,0b0101_0000);

const blob = buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
  instr:prog(), jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

  const EXPECT = encodeInfoHelper(sa);



describe("ΩI info handler", () => {
  it("writes info blob, r7=OK", () => {
    const env = makeHostEnv({
      accounts : new Map([[NONE, sa]]),
    });
    env.encodeInfo = encodeInfoHelper;
    const st = runBlob(blob,100,{ env, memInit:new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(OK);
    expect(st.memory.slice(DEST,DEST+ EXPECT.length)).toEqual(EXPECT
    );
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("no info -> r7=NONE", () => {
    const st = runBlob(blob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(NONE);
  });

  it("unknown service -> r7=WHO", () => {
    const bad = Uint8Array.from(prog()); bad[2]=1;
    const badBlob = buildBlob({meta:Uint8Array.of(0),jumpTbl:Uint8Array.of(0),z:1,
      instr:bad,jumpEntries:[Uint8Array.of(0)],bitmaskBits:bitmask});
    const st = runBlob(badBlob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(WHO);
  });

  it("dest unmapped -> Panic", () => {
    const bad = Uint8Array.from(prog()); bad[8]=0; bad[9]=0; // dest inside code
    const badBlob = buildBlob({meta:Uint8Array.of(0),jumpTbl:Uint8Array.of(0),z:1,
      instr:bad,jumpEntries:[Uint8Array.of(0)],bitmaskBits:bitmask});
    const st = runBlob(badBlob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  
  
});

describe("ΩI info handler with newer encodeInfoHelper", () => {
// This test uses the newer encodeInfoHelper that returns a typed Uint8Array


const ENV = makeHostEnv({
  accounts: new Map([[SERVICE_ID, sa]]), 
});

ENV.getInfo = (id: bigint) => ENV.getService(id);


ENV.encodeInfo = encodeInfoHelper;   // already typed correctly

const EXPECT = encodeInfoHelper(sa); 

it("newer encodeInfoHelper: writes info blob, r7 = OK", () => {
  const mem = new Uint8Array(1 << 20);
  const st  = runBlob(blob, 100, { env: ENV, memInit: mem });

  expect(st.registers[7]).toBe(OK);
  expect(st.memory.slice(DEST, DEST + EXPECT.length)).toEqual(EXPECT);
  expect(st.exit?.type).toBe(ExitReasonType.Panic);
});

}); 