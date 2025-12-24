import { checkAccess, createPageTable } from "../../../risc-pvm/interpreter/memory";
import { ARGS_BASE, STACK_START, STACK_TOP, ZI, ZZ } from "../../../risc-pvm/interpreter/host/consts";

describe("A.7 high-bands access rules", () => {
  test("panic zone < 2^16 is blocked", () => {
    const pt = createPageTable(1);
    // any addr below ZZ (2^16) returns 0 (bad page)
    expect(checkAccess(pt, ZZ - 1, 1, false)).toBe(0);
    expect(checkAccess(pt, ZZ - 1, 1, true)).toBe(0);
  });

  test("stack band allows R/W", () => {
    const pt = createPageTable(1);
    const addr = STACK_START + 8; // inside [STACK_START, STACK_TOP)
    expect(checkAccess(pt, addr, 16, false)).toBeUndefined();
    expect(checkAccess(pt, addr, 16, true)).toBeUndefined();
    // end boundary still ok if fully within
    expect(checkAccess(pt, STACK_TOP - 8, 8, true)).toBeUndefined();
  });

  test("args band allows R only, denies W", () => {
    const pt = createPageTable(1);
    const addr = ARGS_BASE + 32; // inside args band
    expect(checkAccess(pt, addr, 64, false)).toBeUndefined(); // read ok
    expect(checkAccess(pt, addr, 64, true)).toBeDefined();    // write denied
    // boundary: last byte still read-ok
    expect(checkAccess(pt, ARGS_BASE + ZI - 1, 1, false)).toBeUndefined();
  });
});
