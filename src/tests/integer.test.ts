import { serializeInteger, deserializeInteger } from '../encodingUtils/integer';

describe('Integer Serialization and Deserialization', () => {
    const testCases = [
        { value: 0, expectedSerialized: [0] },
        { value: 1, expectedSerialized: [1] },
        { value: 63, expectedSerialized: [63] },
        { value: 64, expectedSerialized: [0b10000000 | (64 >> 8), 64 & 0xFF] },
        { value: 8191, expectedSerialized: [0b10011111, 0xFF] },
        { value: 8192, expectedSerialized: [0b10000000 | (8192 >> 8), 8192 & 0xFF] },
        { value: 2097151, expectedSerialized: [0b11011111, 0xFF, 0xFF] },
        { value: 2097152, expectedSerialized: [0b11100000 | (2097152 >> 24), (2097152 >> 16) & 0xFF, (2097152 >> 8) & 0xFF, 2097152 & 0xFF] },
        { value: 536870911, expectedSerialized: [0b11111111, 0xFF, 0xFF, 0xFF] },
        { value: BigInt("18446744073709551615"), expectedSerialized: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF] }, // 2^64 - 1 9 bytes ( first byte is the prefix) 
        { value: BigInt("72057594037927935"), expectedSerialized: [0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF] }, // 8 bytes
        { value: BigInt("281474976710655"), expectedSerialized: [0xFC, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF] }, // 7 bytes
        { value: BigInt("1099511627775"), expectedSerialized: [0xF8, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF] }, // 6 bytes
        { value: BigInt("4294967295"), expectedSerialized: [0xF0, 0xFF, 0xFF, 0xFF, 0xFF] }, // 5 bytes
        { value: BigInt("16777215"), expectedSerialized: [0xE0, 0xFF, 0xFF, 0xFF] }, // 4 bytes
        { value: BigInt("65535"), expectedSerialized: [0xC0, 0xFF, 0xFF] }, // 3 bytes
        { value: BigInt("255"), expectedSerialized: [0x80, 0xFF] }, // 2 bytes
        { value: BigInt("0"), expectedSerialized: [0x00] } // 1 byte
    

    ];

    testCases.forEach(testCase => {
        test(`should serialize integer ${testCase.value}`, () => {
            const serialized = serializeInteger(testCase.value);
            expect(Array.from(serialized)).toEqual(testCase.expectedSerialized);
        });

        test(`should deserialize integer ${testCase.value}`, () => {
            const deserialized = deserializeInteger(new Uint8Array(testCase.expectedSerialized));
            if (typeof testCase.value === "bigint") {
                expect(deserialized).toEqual(testCase.value);
            } else {
                expect(deserialized).toBe(testCase.value);
            }
        });
    });
});