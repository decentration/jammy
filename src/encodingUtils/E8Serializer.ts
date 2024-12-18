if (typeof x === "bigint") {
    console.log("serializing 64-bit integer", x);
    // let bigX = BigInt(x);

    if (x < MAX_64_BIT) {
        console.log("serializing inside 64-bit integer", x);
    
        // Determine the optimal l based on x's value
        const l = calculateL(x); // This function needs to accurately determine l
        console.log("l after calculation is:", l);

        // Compute the Base Value part of the prefix
        const baseValue = 256 - (1 << (8 - l)); // baseValue represents is 2^8 - 2^(8-l)
        console.log("Base Value (256 - 2^(8-l)):", baseValue);

        // Compute the high bits addition part of the prefix
        const highBits = Number((x >> BigInt(8 * l)) & 0xFFn);
        console.log("High Bits (x >> 8l) & 0xFF:", highBits);

        // Combine the parts to form the prefix
        let prefix = (baseValue + highBits) % 256;
        console.log("Combined Prefix before modulo:", baseValue + highBits);
        console.log("Final Prefix (mod 256):", prefix);

        // Setup bytes array
        const bytesNeeded = l + 1; // Including one byte for the prefix
        const bytes = new Uint8Array(bytesNeeded);
        console.log("new array of Bytes Needed:", bytes);
        bytes[0] = prefix;

        // Fill in the bytes from the most significant to the least significant
        for (let i = 0; i < l; i++) {
            bytes[i + 1] = Number((x >> BigInt(8 * (l - 1 - i))) & 0xFFn);
        }

        console.log("Serialized Output:", bytes);
        return bytes;

    } else {
        console.log("INVALID: out of range for 64-bit serialization", x);
        throw new Error("INVALID: out of range for 64-bit serialization");
    }
}