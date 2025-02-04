import { arrayEqual, toHex } from '../../utils';
import { BlockItem } from '../types'; 
import { ReporterItem } from './types';

  /**
   *  areSortedAndUniqueByValidatorIndex:
   * - Returns true if the signatures are sorted by validator_index and unique.
   * @param signatures  The signatures to check 
   * @returns 
   */
export function areSortedAndUniqueByValidatorIndex(signatures: {
    validator_index: number;
  }[]): boolean {
    for (let i = 0; i < signatures.length - 1; i++) {
      if (signatures[i].validator_index >= signatures[i + 1].validator_index) {
        return false;
      }
    }
    return true;
  }


  /**
   * alreadyInRecentBlocks:
   *  - Returns true if pkgHash is found in any block's "reported" array in recent_blocks.
   */
  export function alreadyInRecentBlocks(
    pkgHash: Uint8Array,
    recentBlocks: BlockItem[]
  ): boolean {
    for (const block of recentBlocks) {
      for (const reportedPkg of block.reported) {
        if (arrayEqual(reportedPkg.hash, pkgHash)) {
          return true;  // Found match => we already have it in recent history
        }
      }
    }
    return false;
  }
  

  /**
   * isKnownPackage:
   * - Returns true if pkgHash is found in extrinsicSet or in any block's "reported" array in recent_blocks.
   * @param pkgHash  The hash of the package to check 
   * @param recentBlocks  
   * @param extrinsicSet 
   * @returns 
   */
  export function isKnownPackage(
    pkgHash: Uint8Array, 
    recentBlocks: BlockItem[], 
    extrinsicSet: Set<string>
  ): boolean {
    if (extrinsicSet.has(toHex(pkgHash))) {
      return true;
    }
  
    for (const block of recentBlocks) {
      for (const rep of block.reported) {
        if (arrayEqual(rep.hash, pkgHash)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * findnExportedPackage:
   * - Returns the exports_root if pkgHash is found in any block's "reported" array in recent_blocks.
   * @param recentBlocks 
   * @param packageHash 
   * @returns 
   */
 export  function findExportedPackage(
    recentBlocks: BlockItem[], 
    packageHash: Uint8Array
  ): { exports_root: Uint8Array } | null 
  {
    for (const block of recentBlocks) {
      for (const rep of block.reported) {
        if (arrayEqual(rep.hash, packageHash)) {
          // found it
          return { exports_root: rep.exports_root };
        }
      }
    }
    return null;
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
   * Checks if guarantee.slot is from either the same rotation 
   * or the immediately previous rotation of input.slot.
   * If older than that => report_epoch_before_last
   * If bigger => future_report_slot (already handled)
   *    */
export function whichRotation(guaranteeSlot: number, blockSlot: number, rotationLen: number): "curr" | "prev" | "too_old" {
  const guarRot = Math.floor(guaranteeSlot / rotationLen);
  const blockRot = Math.floor(blockSlot / rotationLen);

  if (guarRot === blockRot) {
    return "curr";
  } else if (guarRot === blockRot - 1) {
    return "prev";
  } else {
    return "too_old";
  } 
}

// probably not needed but order by ascending validatorIndex
export function finalizeReporters(items: ReporterItem[]): Uint8Array[] {

  const currArray = items.filter(it => it.set === "curr");
  const prevArray = items.filter(it => it.set === "prev");

  currArray.sort((a, b) => a.validatorIndex - b.validatorIndex);
  prevArray.sort((a, b) => a.validatorIndex - b.validatorIndex);

  const combined = [...currArray, ...prevArray];
  const finalList: string[] = [];
  const seen = new Set<string>();
  for (const it of combined) {
    const pubEdKeyHex = toHex(it.pubEdKey);
    if (!seen.has(pubEdKeyHex)) {
      seen.add(pubEdKeyHex);
      finalList.push(pubEdKeyHex);
    }
  }
  const finalListUint8 = finalList.map((hexString) => {
    let clean = hexString;
    if (hexString.startsWith("0x")) {
      clean = hexString.slice(2);
    }
    return Uint8Array.from(Buffer.from(clean, "hex"));
  });  
  return finalListUint8
  }
