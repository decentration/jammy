import { makeMemory } from "../../../risc-pvm/interpreter/memory";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";

const IO_BASE = 0xfe_fe_0000 >>> 0;

test("FEFE IO window maps into env.ioBuffer", () => {
  const heap = new Uint8Array(1 << 20); // 1 MiB
  const env  = makeHostEnv();
  const mem  = makeMemory(heap, env);

  mem.setU32(IO_BASE, 0xdeadbeef);

  expect(env.ioBuffer![0]).toBe(0xef);
  expect(env.ioBuffer![1]).toBe(0xbe);
  expect(env.ioBuffer![2]).toBe(0xad);
  expect(env.ioBuffer![3]).toBe(0xde);

  // heap should still be untouched at that (huge) address
  expect(heap[0]).toBe(0);
});