// bit accessor, using the most memory efficient way possible with bitwise and bitshift 
export const bit = (key: Uint8Array, i: number): boolean => { 
    if (                   // we want to get the the byte and the bit index then check if its 0 or 1 adn return boolean accordingly
         (key[i >>> 3]     // shift right by 3 (div 8) to get byte index
         & (1 << (i & 7))) // mask with 7 to get bit index 
         !== 0             // check if bit is set
       ) return true 
    return false 
}