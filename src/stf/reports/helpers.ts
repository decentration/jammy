import { arrayEqual, toHex } from '../../utils';
import { BlockItem } from '../types'; 

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
