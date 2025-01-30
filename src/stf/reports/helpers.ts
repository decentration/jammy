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


  