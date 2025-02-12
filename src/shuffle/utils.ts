  // assume chunkSize=3 => 3 validators/core
export function assignedCore(
  validatorIndex: number,
  permutation: number[],
  validatorsPerCore: number
): number {
  console.log("[assignedCore]  => Enter");
  console.log("  validatorIndex:", validatorIndex);
  console.log("  perm:", permutation);
  console.log("  validatorsPerCore:", validatorsPerCore);
  // 1) find where validatorIndex occurs in perm
  const pos = permutation.indexOf(validatorIndex);
  if (pos < 0) return -1; // not found => error

  // 2)  "validatorsPerCore" => 1 core
  const coreGroup = Math.floor(pos / validatorsPerCore);
    console.log("  coreGroup:", coreGroup);
  return coreGroup;
}
  

function rotationOfSlot(slot: number, period: number): number {
    return Math.floor(slot / period);
}
  

/**
 * Checks if guarantee.slot is from either the same rotation 
 * or the immediately previous rotation of input.slot.
 * If older than that => "report_epoch_before_last".
 * If bigger => "future_report_slot" (already handled).
 */
export function isWithinOneRotation(guaranteeSlot: number, currentSlot: number, rotationPeriod: number): boolean {
    const gRot = rotationOfSlot(guaranteeSlot, rotationPeriod);
    const cRot = rotationOfSlot(currentSlot, rotationPeriod);
    // If gRot < cRot - 1 => it's 2+ rotations behind => fail
    // If gRot == cRot or gRot == cRot-1 => pass
    return gRot >= cRot - 1;
}
  

/**
 * Checks if "report" (guarantee.slot) is from either the same rotation 
 * or the immediately previous rotation of input.slot.
 * If older than that => report_epoch_before_last
 * If bigger => future_report_slot (already handled)
 * like isWithinOneRotation but returns a string
*/
export function whichRotation(reportSlot: number, blockSlot: number, rotationLen: number): "curr" | "prev" | "too_old" {
  const guarRot = Math.floor(reportSlot / rotationLen);
  const blockRot = Math.floor(blockSlot / rotationLen);

  if (guarRot === blockRot) {
    return "curr";
  } else if (guarRot === blockRot - 1) {
    return "prev";
  } else {
    return "too_old";
  } 
}


export function isPrevRotationInSameEpoch(slot: number, rotationPeriod: number, epochLength: number): boolean {
  const oldSlot = slot - rotationPeriod;
  if (oldSlot < 0) return false;  // definitely prior epoch if negative
  return Math.floor(oldSlot / epochLength) === Math.floor(slot / epochLength);
}

/**
 * rotatePermutation:
 *   Left-rotate an array of length n by offset=chunkCount*chunkSize,
 *   where chunkCount = floor((slot % epochLength)/ rotationPeriod).
 */
export function rotatePermutation(
  basePermutation: number[],
  slot: number,
  epochLength: number,
  rotationPeriod: number,
  chunkSize: number
): number[] {
  const epochPhase = slot % epochLength;
  const chunkCount = Math.floor(epochPhase / rotationPeriod);
  
  console.log("slot, epochPhase, chunkCount, chunkSize", {slot, epochPhase, chunkCount, chunkSize, rotationPeriod});
  
  const offset = chunkCount * chunkSize;
  const n = basePermutation.length;

  // safe if n=0 => no shift
  if (n === 0) return basePermutation;

  const actual = offset % n;
  return basePermutation.slice(actual).concat(basePermutation.slice(0, actual));
}
