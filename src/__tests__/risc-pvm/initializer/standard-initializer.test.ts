import { expect, describe, it } from "bun:test";
import { executeProgram } from "../../../risc-pvm/interpreter/host/execute/executeService";
import { initializeStandardProgram } from "../../../risc-pvm/interpreter/initializer/initStandardProgram";
import { PAGE_SIZE, ZZ } from "../../../risc-pvm/interpreter/host/consts";
import { parseProgramContainer } from "../../../risc-pvm/interpreter/initializer/parseProgamContainer";
import { stripManifestHeaderIfPresent } from "../../../risc-pvm/interpreter/host/utils";
import { invalidatePrepared } from "../../../risc-pvm/interpreter/host/execute/helpers";

function buildInnerBlob(instrLen: number): Uint8Array {
  const instr = new Uint8Array(instrLen).fill(0xaa);
  const maskLen = Math.ceil(instrLen / 8);
  const mask = new Uint8Array(maskLen).fill(0); // all "operands" for simplicity

  const E = (n: number) => {
    if (n < 0x80) return Uint8Array.of(n);
    throw new Error("test helper only handles small ints");
  };

  return new Uint8Array([...E(0), 1, ...E(instrLen), ...instr, ...mask]);
}

// Build a minimal standard program container (a.38)
function buildContainerBE(
  readOnly: Uint8Array, // o
  readWrite: Uint8Array, // w
  reservePages: number, // z
  stackSizeBytes: number, // s
  code: Uint8Array // c
): Uint8Array {
  const E3 = (n: number) => Uint8Array.of((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  const E2 = (n: number) => Uint8Array.of((n >>> 8) & 0xff, n & 0xff);
  const E4 = (n: number) =>
    Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

  return new Uint8Array([
    ...E3(readOnly.length),
    ...E3(readWrite.length),
    ...E2(reservePages),
    ...E3(stackSizeBytes),
    ...readOnly,
    ...readWrite,
    ...E4(code.length),
    ...code,
  ]);
}

//add manifest to mimic test vectors 
function addGManifest(payload: Uint8Array): Uint8Array {
  const enc = (s: string) => Uint8Array.from([s.length, ...Buffer.from(s)]);
  const fields = [
    Uint8Array.of(0x47), // G
    Uint8Array.of(0x00), // version
    enc("test-service"),
    enc("0.1.0"),
    enc("Apache-2.0"),
    Uint8Array.of(1),
    enc("Parity <admin@parity.io>"),
  ];
  
  const head = new Uint8Array(fields.reduce((n, f) => n + f.length, 0));
  let o = 0;
  for (const f of fields) {
    head.set(f, o);
    o += f.length;
  }
  const out = new Uint8Array(head.length + payload.length);
  out.set(head, 0);
  out.set(payload, head.length);
  return out;
}


describe("standard program container (initializer) — spec conformance", () => {
  const MEM = 1 << 20; // 1 MiB test memory

  it("parseProgramContainer returns code and fields", () => {
    const code = buildInnerBlob(9);
    const readOnly = new Uint8Array([1, 2, 3, 4]);
    const readWrite = new Uint8Array([5, 6]);
    const reservePages = 2;
    const stackSizeBytes = 4096;

    const container = buildContainerBE(readOnly, readWrite, reservePages, stackSizeBytes, code);
    const parts = parseProgramContainer(container);

    expect(parts).not.toBeNull();
    expect(parts!.code.length).toBe(code.length);
    expect(parts!.reservePages).toBe(reservePages);
    expect(parts!.stackSizeBytes).toBe(stackSizeBytes);
  });

  it("initializeStandardProgram lays out memory per A.42", () => {
    const code = buildInnerBlob(8);
    const readOnly = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const readWrite = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const reservePages = 2; // reserve 2 * 4KiB (ZP) — will be coarsened to PAGE_SIZE
    const stackSizeBytes = 8192;

    const container = buildContainerBE(readOnly, readWrite, reservePages, stackSizeBytes, code);
    const init = initializeStandardProgram(container, new Uint8Array(), MEM);

    // Expected addresses per A.42, with page rounding coarsened to PAGE_SIZE:
    const roStart = ZZ;
    const roPadEnd = roStart + Math.ceil(readOnly.length / PAGE_SIZE) * PAGE_SIZE;

    const rwStart = 2 * ZZ + Math.ceil(readOnly.length / ZZ) * ZZ;
    const rwPadEnd = rwStart + Math.ceil(readWrite.length / PAGE_SIZE) * PAGE_SIZE;

    const zReserveEnd =
      rwPadEnd + Math.ceil((reservePages * (1 << 12)) / PAGE_SIZE) * PAGE_SIZE; // reservePages·ZP

    // RO copied at ZZ
    expect(init.memInit.slice(roStart, roStart + readOnly.length)).toEqual(readOnly);

    // RW copied at 2ZZ + Z(|readOnly|)
    expect(init.memInit.slice(rwStart, rwStart + readWrite.length)).toEqual(readWrite);

    // Heap start equals 2ZZ + Z(|readOnly|)
    expect(init.heapStart).toBe(rwStart);
    expect(init.heapEnd).toBe(zReserveEnd);

    // mapPlan has read true write false for RO and R/W for RW+reserve (coarsened to PAGE_SIZE)
    const page = (addr: number) => (addr / PAGE_SIZE) | 0;
    const roEntry = init.mapPlan.find((e) => e.from === page(roStart));
    const rwEntry = init.mapPlan.find((e) => e.from === page(rwStart));
    expect(roEntry?.read).toBe(true);
    expect(roEntry?.write).toBe(false);
    expect(rwEntry?.read).toBe(true);
    expect(rwEntry?.write).toBe(true);
    expect(roEntry?.to).toBe(page(roPadEnd));
    expect(rwEntry?.to).toBe(page(zReserveEnd));
  });

  it("registers match A.43 (reg0, reg1, reg7, reg8)", () => {
    const args = new Uint8Array([9, 8, 7, 6, 5]); // |a| = 5
    const code = buildInnerBlob(4);
    const container = buildContainerBE(new Uint8Array(), new Uint8Array(), 0, 4096, code);
    const init = initializeStandardProgram(container, args, MEM);

    const u32 = BigInt(2 ** 32);
    expect(init.registers[0]).toBe(u32 - BigInt(1 << 16)); // 2^32 - 2^16
    expect(init.registers[1]).toBe(u32 - BigInt(2 * ZZ + (1 << 24))); // 2^32 - 2·ZZ - ZI
    expect(init.registers[7]).toBe(u32 - BigInt(ZZ + (1 << 24))); // 2^32 - ZZ - ZI
    expect(init.registers[8]).toBe(BigInt(args.length)); // |a|
  });

  it("executeProgram accepts manifest+container and uses initializer (args & heap)", () => {
    const args = new Uint8Array(7).fill(0x5a);
    const code = buildInnerBlob(12);
    const readOnly = new Uint8Array([1, 2, 3]);
    const readWrite = new Uint8Array([4, 5, 6, 7]);
    const reservePages = 1;
    const stackSizeBytes = 4096;

    const container = buildContainerBE(readOnly, readWrite, reservePages, stackSizeBytes, code);
    const wrapped = addGManifest(container); // non-spec manifest
    const codeHash = new Uint8Array(32).fill(0x11); // dummy cache key

    // executeProgram strips manifest, detects container, runs Y(p,a), then Ψ(c)
    const vm = executeProgram({
      codeHash,
      programBlob: wrapped,
      initialGas: 20_000n,
      memSize: MEM,
      args,
    });

    // Expect we actually ran and reached some exit
    expect(vm.exit?.type).toBeDefined();

    // reg8 = |args|
    expect(vm.registers[8]).toBe(BigInt(args.length));

    // heapStart from initializer (2ZZ + Z(|readOnly|))
    const rwStart = 2 * ZZ + Math.ceil(readOnly.length / ZZ) * ZZ;
    if (!vm.context) throw new Error("VM context missing");
    expect(vm.context.heapStart).toBe(rwStart);
  });

  it("cache hit reuses inner code... invalidatePrepared refreshes it", () => {
    const instrLenFromBuiltA2 = (a2: Uint8Array) => a2[2];
    const codeHash = new Uint8Array(32).fill(0x22); // fixed key

    const code1 = buildInnerBlob(9);
    const code2 = buildInnerBlob(33);
    const readOnly = new Uint8Array([0x01]);
    const readWrite = new Uint8Array([0x02]);

    const C1 = buildContainerBE(readOnly, readWrite, 0, 4096, code1);
    const C2 = buildContainerBE(readOnly, readWrite, 0, 4096, code2);

    const vm1 = executeProgram({ codeHash, programBlob: C1, initialGas: 5_000n, memSize: MEM });
    const len1 = vm1.code.length;

    // reuse same codeHash but different container. should get cached inner blob (len1)
    const vm2 = executeProgram({ codeHash, programBlob: C2, initialGas: 5_000n, memSize: MEM });
    expect(vm2.code.length).toBe(len1);

    // after invalidation, new inner blob should be used
    invalidatePrepared(codeHash);
    const vm3 = executeProgram({ codeHash, programBlob: C2, initialGas: 5_000n, memSize: MEM });
    expect(vm3.code.length).toBe(instrLenFromBuiltA2(code2));
});

  it("stripManifestHeaderIfPresent is a pure no-op on non-manifest input", () => {
    const code = buildInnerBlob(5);
    const container = buildContainerBE(new Uint8Array(), new Uint8Array(), 0, 0, code);
    expect(stripManifestHeaderIfPresent(container)).toEqual(container);
  });

  it("initializeStandardProgram rejects raw blobs (requires container)", () => {
    const code = buildInnerBlob(6);
    expect(() => initializeStandardProgram(code, new Uint8Array(), MEM)).toThrow();
  });
});
