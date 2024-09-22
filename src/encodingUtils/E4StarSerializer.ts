
const MAX_6_BIT  =  64;           // 2^6
const MAX_14_BIT =  16384;        // 2^14
const MAX_21_BIT =  2097152;      // 2^21
const MAX_29_BIT =  536870912;    // 2^29 
const MAX_64_BIT = BigInt("18446744073709551616"); // 2^64

export function serializeInteger(x: number | bigint): Uint8Array {
    console.log("serializing integer", x);
    if (x === 0) {
        return new Uint8Array([0]);


    } else if (typeof x === "number") { 
    
        if (x < MAX_6_BIT) {            // 2^6
            return new Uint8Array([x]);
        } else if (x < MAX_14_BIT) {         // 2^14
            console.log("serializing 14-bit integer", x);
            const r = new Uint8Array([(0b10000000 | (x >> 8)), (x & 0xFF)]);
            console.log("result of 14-bit integer", r);
            return r;
        } else if (x < MAX_21_BIT) {       // 2^21
            console.log("serializing 21-bit integer", x);
            const r =  new Uint8Array([(0b11000000 | (x >> 16)), (x >> 8) & 0xFF, x & 0xFF]); // 0xFF is 11111111 
            console.log("result of 21-bit integer", r);
            return r;
        } else if (x < MAX_29_BIT) {     // 2^29 -1
            console.log("serializing 29-bit integer", x);
            const byte1 = (0b11100000 | ((x >> 24) & 0x1F)); console.log("byte1", byte1, "(" + byte1.toString(2).padStart(8, '0') + " in binary)");
            const byte2 = (x >> 16) & 0xFF; console.log("byte2", byte2, "(" + byte2.toString(2).padStart(8, '0') + " in binary)");
            const byte3 = (x >> 8) & 0xFF; console.log("byte3", byte3, "(" + byte3.toString(2).padStart(8, '0') + " in binary)");
            const byte4 = x & 0xFF; console.log("byte4", byte4, "(" + byte4.toString(2).padStart(8, '0') + " in binary)");
            const resultBefore = byte1 + byte2 + byte3 + byte4; console.log("result before", resultBefore, "(" + resultBefore.toString(2).padStart(32, '0') + " in binary)");
            const result = new Uint8Array([byte1, byte2, byte3, byte4]);
            // const r = new Uint8Array([(0b11100000 | ((x >> 24) & 0x0F)), (x >> 16) & 0xFF, (x >> 8) & 0xFF, x & 0xFF]);
            console.log("result of 29-bit integer", result);
            return result;
        }
    }

    
    console.error("INVALID: Value is out of the allowed range or type", x);
    throw new Error("INVALID: Value is out of the allowed range or type");
}

export function deserializeInteger(data: Uint8Array): number | bigint {
    console.log("deserializing integer", data);
    const firstByte = data[0];
    const length = data.length;


    if ((firstByte & 0b11000000) === 0) { // 1-byte
        console.log("deserializing 6-bit integer", firstByte);
        return firstByte & 0x3F;
    } else if ((firstByte & 0b11000000) === 0b10000000 && length === 2) { // 2-byte integer
        console.log("deserializing 14-bit integer", firstByte, data[1]);
        const r = ((firstByte & 0x3F) << 8) | data[1];
        console.log("result of 14-bit integer", r);
        return r;
    } else if ((firstByte & 0b11100000) === 0b11000000) { // 3-byte integer
        console.log("deserializing 21-bit integer", firstByte, data[1], data[2]);
        const r = ((firstByte & 0x1F) << 16) | (data[1] << 8) | data[2];
        console.log("result of 21-bit integer", r);
        return r;
    } else if ((firstByte & 0b11100000) === 0b11100000 && length === 4) { // 4-byte integer (29-bit)
        console.log("deserializing 29-bit integer", "First byte:", firstByte, "(" + firstByte.toString(2).padStart(8, '0') + " in binary)");
        const r = ((firstByte & 0x1F) << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
        console.log("result of 29-bit integer", r, "(" + r.toString(2).padStart(32, '0') + " in binary)");
        return r;
    } else if ((firstByte & 0b11111111) === 0b11111111 && length > 4) { // 64-bit integer for 9-byte
        console.log("deserializing 64-bit integer", data);
        const byte1 = BigInt(firstByte & 0xFF) 
        const byte2 = BigInt(data[1]) << 56n;
        const byte3 = BigInt(data[2]) << 48n;
        const byte4 = BigInt(data[3]) << 40n;
        const byte5 = BigInt(data[4]) << 32n;
        const byte6 = BigInt(data[5]) << 24n;
        const byte7 = BigInt(data[6]) << 16n;        
        const byte8 = BigInt(data[7]) << 8n;
        const byte9 = BigInt(data[8])

        const result = byte1 | byte2 | byte3 | byte4 | byte5 | byte6 | byte7 | byte8 | byte9;
        console.log("result of 64-bit integer", { byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8 }, result.toString());
        return result;
    } else {
        console.log("invalid integer", firstByte);
        throw new Error("Invalid integer encoding");
    }
}



function calculateL(x: bigint): number {
    if (x === 0n) return 0; 

 let l = 0;
    while ((1n << BigInt(8 * (l + 1))) <= x) {
        console.log("l:", l, "1 << 8 * (l + 1):", 1n << BigInt(8 * (l + 1)), "x:", x);
    l++;
    }
    return l + 1;
}