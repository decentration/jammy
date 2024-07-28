// integerSerialization.test.ts
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
    ];

    testCases.forEach(testCase => {
        test(`should serialize integer ${testCase.value}`, () => {
            const serialized = serializeInteger(testCase.value);
            expect(Array.from(serialized)).toEqual(testCase.expectedSerialized);
        });

        test(`should deserialize integer ${testCase.value}`, () => {
            const deserialized = deserializeInteger(new Uint8Array(testCase.expectedSerialized));
            expect(deserialized).toBe(testCase.value);
        });
    });
});