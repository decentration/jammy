import { bitmaskToBoolean } from "../../risc-pvm/tiny/bitmask";

type BooleanValue = 0 | 1;

// helper to write expected arrays tersely
const Bits = (...bits: BooleanValue[]) => {
  return bits.map(b => b === 1);
};

describe("bitmaskToBoolean()", () => {
  test("single byte -> 8 booleans, LSB-first", () => {
    // 0b00010001: opcode at bit-0 and bit-4
    const mask   = Uint8Array.of(0b0001_0001);
    const codeByteLen = 8;
    const actual = bitmaskToBoolean(mask, codeByteLen);
    const expected = Bits(1,0,0,0,1,0,0,0);      // <= LSB..MSB little endian 
    expect(actual).toEqual(expected);
  });
  test("two bytes concatenate in correct order", () => {
    const codeByteLen = 16;
    const mask   = Uint8Array.of(0xaa, 0x01); // 0xAA = 10101010 => 0,1,0,1,0,1,0,1 (LSB -> MSB) 0x01 = 00000001 => 1,0,0,0,0,0,0,0         
    const actual = bitmaskToBoolean(mask, codeByteLen);

    const expected = Bits(
      0,1,0,1,0,1,0,1,   // first byte
      1,0,0,0,0,0,0,0    // second byte
    );
    expect(actual).toEqual(expected);
  });
  test("bitmask with trailing bits (|c| = 10 bytes)", () => {
    // |c| = 10 bytes -> bitmask = ceiling(10/8) = 2 bytes
    const mask = Uint8Array.of(0xFF, 0x03); // 0x03 => 00000011 => [1,1,...] (only first two bits used)
    const codeByteLen = 10;

    const actual = bitmaskToBoolean(mask, codeByteLen);
    const expected = Bits(
      1,1,1,1,1,1,1,1, // first 8 bits from 0xFF
      1,1              // first 2 bits from 0x03
    );

    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(codeByteLen);
  });
  test("bitmask correctly handles padding bits", () => {
    const mask = Uint8Array.of(0b00101101); // 8 bits, but only need 6
    const codeByteLen = 6; 
    const actual = bitmaskToBoolean(mask, codeByteLen);
    const expected = [true, false, true, true, false, true]; // LSB-first 0b00101101 -> 101101 padded first 2 LSBs
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(6);
  });
    //   test("bitmask shorter than codeByteLen throws an error", () => {
    //     const mask = Uint8Array.of(0xFF); // only 8 bits available
    //     const codeByteLen = 10;           // requires 2 bytes 16 bits of opcode mask
    //     const actual = bitmaskToBoolean(mask, codeByteLen);
    //     const expected = B(1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0); // 16 bits expected
    //     expect(actual).toEqual(expected);
    //   });

  test("bitmask shorter than needed throws error", () => {
    const mask = Uint8Array.of(0b11110000); // 8 bits total
    const codeByteLen = 9;                  // requesting 9 bits
  
    expect(() => bitmaskToBoolean(mask, codeByteLen)).toThrow('Bitmask length mismatch: bitmask has fewer bits 1, than the required 9');
  });

  test("returned length exactly matches |c|", () => {
    const mask = Uint8Array.of(0xff, 0x00, 0xaa); // 3 bytes = 24 bits
    const codeByteLen = 20; // Requesting exactly 20 bits

    const actual = bitmaskToBoolean(mask, codeByteLen);
    expect(actual).toHaveLength(20);
  });

});