import { arrayEqual, convertToReadableFormat, toHex } from '../../utils';
import { BlockItem } from '../types'; 
import { ReporterItem } from './types';
import { hexStringToBytes } from '../../codecs';

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


/**
 * finalizeReporters:
 * - Returns a list of unique pubEdKeys from the given ReporterItems. sorted lexicographically
 * @param items 
 * @returns 
 */
export function finalizeReporters(items: ReporterItem[]): Uint8Array[] {

  // const currArray = items.filter(it => it.set === "curr");
  // const prevArray = items.filter(it => it.set === "prev");

  // currArray.sort((a, b) => a.validatorIndex - b.validatorIndex);
  // prevArray.sort((a, b) => a.validatorIndex - b.validatorIndex);

  // const combined = [...currArray, ...prevArray];

  // items.sort((a, b) => a.validatorIndex - b.validatorIndex);

  items.sort((a, b) => {
    const aHex = toHex(a.pubEdKey);
    const bHex = toHex(b.pubEdKey);
    // Compare them lexicographically.
    if (aHex < bHex) return -1;
    if (aHex > bHex) return 1;
    return 0;
  });

  console.log("finalizeReporters sorted items", convertToReadableFormat(items));


  const finalList: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
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

  /**
   * inRecentBlocksOrNew:
   * - Returns true if hash is found in newPackages or in any block's "reported" array in recent_blocks.
   * @param hash 
   * @param recentBlocks 
   * @param newPackages 
   * @returns 
   */
  export function inRecentBlocksOrNew(
    hash: string, 
    recentBlocks: BlockItem[], 
    newPackages: Map<string, {exportsRoot: Uint8Array}>
  ): boolean {
    if (newPackages.has(hash)) return true;  // in extrinsic
    return alreadyInRecentBlocks(hexStringToBytes(hash), recentBlocks);
  }


/**
 * findExportsRoot:
 * - Returns the exports_root if pkgHash is found in newPackages or in any block's "reported" array in recent_blocks.
 * @param pkgHash 
 * @param recentBlocks 
 * @param newPackages 
 * @returns 
 */
 export function findExportsRoot(
    pkgHash: string,
    recentBlocks: BlockItem[],
    newPackages: Map<string, { exportsRoot: Uint8Array }>
  ): Uint8Array | null {
    // 1) Check new extrinsic items
    if (newPackages.has(pkgHash)) {
      return newPackages.get(pkgHash)?.exportsRoot ?? null;
    }
    // 2) Check chain's reported 
    const found = findExportedPackage(recentBlocks, hexStringToBytes(pkgHash));
    return found ? found.exports_root : null;
  }
  
  