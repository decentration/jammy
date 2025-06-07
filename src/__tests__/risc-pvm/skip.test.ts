import { skip } from "../../risc-pvm/interpreter/utils/skip";

describe("skip function", () => {
  test("immediate next opcode returns 0", () => {
    const opcodeBits = [true, true, false, false]; 
    expect(skip(0, opcodeBits)).toBe(0);
  });

  test("opcode 3 bytes away", () => {
    const opcodeBits = [true, false, false, false, true];
    expect(skip(0, opcodeBits)).toBe(3);
  });

  test("no opcode within 24 bytes returns 24", () => {
    const opcodeBits = [true, ...Array(30).fill(false)]; // no opcode within 24 bytes as per spec
    expect(skip(0, opcodeBits)).toBe(24);
  });

  test("opcode exactly at 24 bytes", () => {
    const opcodeBits = [true, ...Array(24).fill(false), true];
    expect(skip(0, opcodeBits)).toBe(24);
  });

  test("skip handles padding beyond array length gracefully", () => {
    const opcodeBits = [true]; // Short array
    expect(skip(0, opcodeBits)).toBe(0); // Immediate padding '1' ensures next opcode at offset 0
  });
});