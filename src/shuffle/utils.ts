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
 *   Rotate (or re-map) the basePermutation by chunkCount,
 * 
 *   where chunkCount = floor((slot % epochLength)/ rotationPeriod).
 *   The rotation is done modulo totalCores.
 * 
 *  If we were using validator indices instead of cores, we would rotate
 *  to the left by chunkCount * chunkSize.
 */
export function rotatePermutation(
  basePermutation: number[],
  slot: number,
  epochLength: number,
  rotationPeriod: number,
  totalCores: number // C
): number[] {
  const epochPhase = slot % epochLength;
  const chunkCount = Math.floor(epochPhase / rotationPeriod);  // n 

  if (chunkCount === 0) {
    console.log("rotatePermutation: no rotation needed");
    return basePermutation;
  }

  // the formula R(c, n) says, for each element x in c => (x + n) mod C
  // so offset = chunkCount, and we do (x + chunkCount) mod totalCores
  const result = [];
  for (let i = 0; i < basePermutation.length; i++) {
    result.push((basePermutation[i] + chunkCount) % totalCores);
  } // or use map TODO

  console.log("rotatePermutation: result", result);

  return result;
}

