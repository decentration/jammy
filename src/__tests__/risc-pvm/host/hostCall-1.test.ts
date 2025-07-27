import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { HUH, NONE, OK, OOB, WHAT } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

// create a blob that runs a blob which includes the host, in first example call ΩG (selector 0)
// This blob will call the host-call ΩG (selector 0) which is expected to
//   - load the remaining gas into register 7
//   - panic–stop the VM with a trap instruction
const makeBlob = (code: Uint8Array, bitmask: Uint8Array) => {
    return buildBlob({
    meta: Uint8Array.of(0),
    jumpTbl: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
};

const INITIAL_GAS = 50;
const HEAP_START = 0x10000;
const GAS        = 100;

describe("ΩG GAs Host‑call (selector 0)", () => {

  it("stores remaining gas in register 7", () => {

    const code = Uint8Array.of(
      Opcodes.ecalli, 0x00,   // selector 0  (ΩG)
      Opcodes.trap            // panic–stop so the VM terminates
    );

    const bitmask  = Uint8Array.of(0b000_0101);          // byte 0 opcode
    const blob  = makeBlob(code, bitmask )

    const testEnv = makeHostEnv();
    
    const state = runBlob(blob, INITIAL_GAS, { env: testEnv }); // 

    expect(state.registers[7]).toBe(BigInt(INITIAL_GAS - 10)); // value beforetrap
    expect(state.gas).toBe(INITIAL_GAS - 11);                  // final gas counter
    expect(state.exit?.type).toBe(ExitReasonType.Panic);       // trap caused panic
  });
});


it("ΩY Fetch Host‑call: writes WHAT to r7 and charges 10 gas", () => {

  const code = Uint8Array.of(
    Opcodes.load_imm, 10, 99, 0, 0, 0,

    Opcodes.ecalli, 18,      // selector = 1
    Opcodes.trap               // terminate
  );

  const bitmask  = Uint8Array.of(0b0100_0001, 0b00000001);          // byte 0 opcode
  const blob  = makeBlob(code, bitmask);
  const state = runBlob(blob, INITIAL_GAS);

  // after ΩY (‑10 gas) and trap (‑1 gas)
  expect(state.registers[7]).toBe(WHAT);
  expect(state.gas).toBe(INITIAL_GAS - 12);    // 39
  expect(state.exit?.type).toBe(ExitReasonType.Panic); // trap executed
});
  
describe("Host‑call fallback (unknown selector)", () => {
  it("sets r7 = WHAT, charges 10 gas, exits Panic", () => {

    const code = Uint8Array.of(
      Opcodes.ecalli, 0x99  // 0x99, plucked a number out of thin air to test unknown selector
    );
    const bitmask = Uint8Array.of(0b00000001);

    const blob  = makeBlob(code, bitmask);
    const state = runBlob(blob, INITIAL_GAS);

    expect(state.registers[7]).toBe(WHAT);
    expect(state.gas).toBe(INITIAL_GAS - 10);   // only the ecalli cost
    expect(state.exit?.type).toBe(ExitReasonType.Panic);
    expect(state.exit?.detail).toMatch(/unknown-host-call/);
  });
});


// describe("ΩR / ΩW host‑calls", () => {
//   it("ΩW writes a byte & ΩR reads it back", () => {

//     const code = Uint8Array.of(
//       Opcodes.load_imm, 0x0A,       // r10 <- 0xAB
//       0xAB, 0, 0, 0,

//       Opcodes.load_imm, 0x08,       // r8 <- HEAP_ADDR (low byte)
//       HEAP_START & 0xFF, (HEAP_START >> 8) & 0xFF,
//       (HEAP_START >> 16) & 0xFF, (HEAP_START >> 24) & 0xFF,

//       Opcodes.load_imm, 0x09,       // r9 <- 1 (byte length)
//       1, 0, 0, 0,

//       Opcodes.ecalli, 3,       // ΩW  selector 3
//       Opcodes.ecalli, 2,       // ΩR  selector 2
//       Opcodes.trap
//     );

//     const bitmask = Uint8Array.of(0b01000001, 0b00010000, 0b01010100); 
//     const blob  = makeBlob(code, bitmask)
//     const state = runBlob(blob, GAS);

//     expect(state.registers[7]).toBe(OK);            // last call OK
//     expect(state.registers[10]).toBe(171n);        // 0xAB read value
//     expect(state.memory[HEAP_START]).toBe(171);          // 0xAB and 0x40 is decimal of §
//     expect(state.exit?.type).toBe(ExitReasonType.Panic); // trap
//   });


//   // it("ΩR on invalid page -> PageFault, r7 untouched (WHAT)", () => {
//   //   const code = Uint8Array.of(
//   //     Opcodes.load_imm, 0x08, 0x00,0x00,0x20,0,     // r8  = 0x200000 (>1 MiB)
//   //     Opcodes.load_imm, 0x09, 0x01,0,0,0,           // len = 1
//   //     Opcodes.ecalli,   0x02                        // read
//   //   );
//   //   const bitmask = Uint8Array.of(0b01000001, 0b00010000); 
//   //   const blob  = makeBlob(code, bitmask);
//   //   const state = runBlob(blob, GAS);

//   //   expect(state.exit?.type).toBe(ExitReasonType.PageFault);
//   //   expect(state.registers[7]).toBe(0n);  // unchanged from default
//   // });

// });

// r8 = addr, r9 = len, ecalli selector, trap
const buildBlobForZandV = (selector: number, addr = HEAP_START, len = 4) => {
  const code = Uint8Array.of(
    Opcodes.load_imm, 0x08,
      addr & 0xFF, (addr>>8)&0xFF, (addr>>16)&0xFF, (addr>>24)&0xFF, // r8 <- addr
    Opcodes.load_imm, 0x09,
      len, 0, 0, 0, // r9 <- len
    Opcodes.ecalli, selector,
    Opcodes.trap
  );

  const bitmask = Uint8Array.of(0b01000001,0b01010000);
  return makeBlob(code, bitmask);
};

it("ΩZ zero‑fills mapped memory & returns OK", () => {
  // prime memory with non‑zero pattern
  const blob = buildBlobForZandV(23, HEAP_START, 4);
  const state0 = runBlob(blob, GAS); // first run writes zeros
  // re‑read memory through a second run of ΩR to verify
  expect(state0.memory.slice(HEAP_START, HEAP_START+4)).toEqual(Uint8Array.of(0,0,0,0));
  expect(state0.registers[7]).toBe(OK);
  expect(state0.exit?.type).toBe(ExitReasonType.Panic); // trap
});

it("ΩZ on unmapped page PageFault & r7 = OOB", () => {
  const BAD_ADDR = 0x200000; // > 1 MiB default mem
  const blob = buildBlobForZandV(23, BAD_ADDR, 1);
  const state = runBlob(blob, GAS);
  expect(state.exit?.type).toBe(ExitReasonType.PageFault);
  expect(state.registers[7]).toBe(OOB);
});

it("ΩV behaves like ΩZ for now (zero + OK)", () => {
  const blob = buildBlobForZandV(24);
  const state = runBlob(blob, GAS);
  expect(state.memory[HEAP_START]).toBe(0);
  expect(state.registers[7]).toBe(OK);
});

it("ΩO poke returns WHAT in r7 if inner-PVM is not available", () => {
  const code = Uint8Array.of(
    Opcodes.ecalli, 22, 
    Opcodes.trap
  );
  const bitmask = Uint8Array.of(0b00000101);
  const blob = makeBlob(code, bitmask);
  const state = runBlob(blob, GAS);
  expect(state.registers[7]).toBe(WHAT);
  expect(state.exit?.type).toBe(ExitReasonType.Panic);
});

it("ΩP peek returns WHAT in r7 if inner-PVM is not available", () => {
  const code = Uint8Array.of(
    Opcodes.ecalli, 21,
    Opcodes.trap
  );
  const bitmask = Uint8Array.of(0b00000101);
  const blob = makeBlob(code, bitmask);
  const state = runBlob(blob, GAS);
  expect(state.registers[7]).toBe(WHAT);
  expect(state.exit?.type).toBe(ExitReasonType.Panic);
});


// describe("ΩL host‑call (lookup‑preimage)", () => {
//   it("returns NONE when store unimplemented", () => {

//     const code = Uint8Array.of(
//       Opcodes.load_imm, 10, 99, 0, 0, 0,

//       Opcodes.ecalli, 1,
//       Opcodes.trap
//     );
//     const mask = Uint8Array.of(0b0100_0001, 0b00000001);
//     const blob = makeBlob(code, mask);
//     const state = runBlob(blob, GAS);

//     expect(state.registers[7]).toBe(NONE);
//     expect(state.exit?.type).toBe(ExitReasonType.Panic)
//   });
// });


it("ΩE (selector 19) returns OK", () => {
  const code     = Uint8Array.of(Opcodes.ecalli, 19, Opcodes.trap);
  const bitmask = Uint8Array.of(0b00000101); 
  const state = runBlob(makeBlob(code, bitmask), 50);

  expect(state.registers[7]).toBe(OK);
  expect(state.exit?.type).toBe(ExitReasonType.Panic);
});

it("ΩF (selector 15) returns HUH", () => {
  const code = Uint8Array.of(Opcodes.ecalli, 15, Opcodes.trap);
  const bitmask = Uint8Array.of(0b00000101);
  const state = runBlob(makeBlob(code, bitmask), 50);

  expect(state.registers[7]).toBe(HUH);
  expect(state.exit?.type).toBe(ExitReasonType.Panic);
});


// placeholders stubs for the rest of the functions, then we move on to spec ready functions. 
const STUB_SELECTORS = [
  5,6,7,8,9,10,11,12,13,14,16,20,25,26,27
] as const;


describe("Track‑1 stub host‑calls", () => {
  test.each(STUB_SELECTORS)("selector %i => WHAT + gas‑10", (sel) => {
    const code = Uint8Array.of(Opcodes.ecalli, sel, Opcodes.trap);
    const bitmask = Uint8Array.of(0b00000101); 

    const state = runBlob(makeBlob(code, bitmask), GAS);

    expect(state.registers[7]).toBe(WHAT);         // r7 set
    expect(state.gas).toBe(GAS - 10 - 1);  // 10 for host, 1 for trap
    expect(state.exit?.type).toBe(ExitReasonType.Panic);
  });
});
