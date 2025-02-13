import { blake2b } from "blakejs";

/**
 * randomExpandBlockwise:
 *   A blockwise approach to partial-offset expansions from (F.2)
 * 1) If seed is not 32 bytes, throw an error
 * 2) Create an empty array out of length `length`
 * 3) For each block of 8 random ints:
 *  a) Build a 36-byte preimage => seed + 4-byte LE(block)
 *  b) Compute 32-byte digest using blake2b
 *  c) Parse 4 bytes from digest as little-endian
 *  d) Store the 4 bytes in out
 * 4) Return out
 
 * @param seed   A 32-byte Uint8Array
 * @param length Number o f 32-bit random ints to produce
 * @returns      number[] of length `length`
 */
export function randomExpandBlockwise(seed: Uint8Array, length: number): number[] {
  if (seed.length !== 32) {
    throw new Error(`randomExpandBlockwise: seed must be 32 bytes, got ${seed.length}`);
  }

  console.log("[randomExpandBlockwise] Enter => length:", length);

  const out: number[] = new Array(length);

  // how many blocks of 8 we need
  const totalBlocks = Math.floor((length - 1) / 8);
  for (let block = 0; block <= totalBlocks; block++) {
    // build a 36-byte preimage => seed + 4-byte LE(block)
    const preimage = new Uint8Array(36);
    preimage.set(seed, 0);

    preimage[32] = (block & 0xff);
    console.log("block:", block);
    preimage[33] = (block >>> 8) & 0xff;
    console.log("block >>> 8:", (block >>> 8) & 0xff);
    preimage[34] = (block >>> 16) & 0xff;
    console.log("block >>> 16:", (block >>> 16) & 0xff);
    preimage[35] = (block >>> 24) & 0xff;
    console.log("block >>> 24:", (block >>> 24) & 0xff);

    // compute 32-byte digest
    const digest = blake2b(preimage, undefined, 32);

    const startI = block * 8;
    const endI = Math.min((block + 1) * 8, length);

    for (let i = startI; i < endI; i++) {
      const offset = (4 * i) % 32;
      // parse 4 bytes from digest as little-endian
      const w =
        (digest[offset + 0]) |
        (digest[offset + 1] << 8) |
        (digest[offset + 2] << 16) |
        (digest[offset + 3] << 24) >>> 0;

      out[i] = w;
    }
  }

  console.log("[randomExpandBlockwise] => random ints:", out);
  return out;
}

/**
 * shuffle:
 *  The recursive pick/pop approach, (F.1) in GP:
 * 1) If s is empty, return empty array
 * 2) If r is empty, throw an error
 * 3) Pick a random integer val from r
 * 4) Compute index = val % length(s)
 * 5) Pick head = s[index]
 * 6) Remove s[index] by swapping with last
 * 7) Recurse with s' = s[0..n-2] and r' = r[1..n-1]
 * 8) Return [head, ...shuffle(s', r')]
 *
 * @param s The array to shuffle, e.g. [0..n-1]
 * @param r The random integers from randomExpandBlockwise
 * @returns The final shuffled array
 */
export function shuffle(s: number[], r: number[]): number[] {

  // base case, s array
  if (s.length === 0) {
    return [];
  }
  // not enough random ints, r is random ints array
  if (r.length === 0) {
    throw new Error(`shuffle... not enough random ints => s.length=${s.length}`);
  }

  const l = s.length;
  const val = r[0] >>> 0; // ensure unsigned
  const index = val % l; // modulo to get index
  const head = s[index]; 

  // remove s[index] by swapping with last
  const copy = s.slice();
  copy[index] = copy[l - 1];
  copy.pop();

  const recursiveShuffle =  [head, ...shuffle(copy, r.slice(1))];
  return recursiveShuffle;
}

/**
 * getPermutation:
 *   Combines (F.2) + (F.1) => (F.3)
 * 1) Create base array s=[0..n-1]
 * 2) Expand the seed into random integers
 * 3) Shuffle the base array using the random integers
 * 4) Return the final permutation array
 *
 * @param seed   32-byte Uint8Array
 * @param length size of the array => s=[0..length-1]
 * @returns the final permutation array
 */
export function getPermutation(seed: Uint8Array, length: number): number[] {

  // create base array s=[0..n-1]
  const s = Array.from({ length }, (_, i) => i);

  // expand the seed into random integers
  const r = randomExpandBlockwise(seed, length);

  const final = shuffle(s, r);
  console.log("[getPermutation] => final permutation:", final);
  return final;
}


/**
 * getPermutation:
 *   Builds the "repeated cores" array of length totalVal (like [0,0,0,1,1,1]),
 *   then uses the randomExpandBlockwise + Fisher-Yates to shuffle it.
 *
 * @param seed          32-byte random seed
 * @param totalValidators     total number of validators
 * @param totalCores    number of cores
 * @returns             array of length totalVal, where
 *                      result[v] = which core that validator v is assigned to
 */
export function getPermutationSeed(
  seed: Uint8Array,
  totalValidators: number,
  totalCores: number
): number[] {
  // 1) Build the repeated-cores array, e.g. [0,0,0,1,1,1] for 6/2
  const s = buildRepeatedCores(totalCores, totalValidators);
  // 2) Expand the seed into random integers
  const r = randomExpandBlockwise(seed, totalValidators);
  // 3) Shuffle the repeated-cores array
  return shuffle(s, r);
}


/**
 * buildRepeatedCores
 * 
 * Builds an array of length totalValidators in which each core index
 * is repeated (totalValidators/totalCores) times. For example:
 *   buildRepeatedCores(2, 6) => [0,0,0,1,1,1]
 */
function buildRepeatedCores(totalCores: number, totalValidators: number): number[] {
  if (totalValidators % totalCores !== 0) {
    throw new Error(`Total validators must be a multiple of totalCores.`);
  }
  const repeats = totalValidators / totalCores;
  const arr: number[] = [];
  for (let c = 0; c < totalCores; c++) {
    for (let i = 0; i < repeats; i++) {
      arr.push(c);
    }
  }
  return arr;
}
