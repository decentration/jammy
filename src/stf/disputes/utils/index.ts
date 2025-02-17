import { arrayEqual } from "../../../utils";

export function hashInArray(target: Uint8Array, arr: Uint8Array[]): boolean {
    return arr.some((h) => arrayEqual(h, target));
}