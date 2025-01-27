import { AuthorizationsState, AuthorizationsInput, AuthorizationsOutput } from "./types";
import { CORES_COUNT, AUTH_POOL_MAX_SIZE, AUTH_QUEUE_SIZE } from "../../consts";
import { arrayEqual, convertToReadableFormat } from "../../utils";

/**
 * applyAuthorizationsStf
 *
 * - For each core in [0..CORES_COUNT):
 *   1) If it is (explicitly) listed in input.auths => remove that exact auth_hash (a Uint8Array).
 *   2) Else => remove the oldest (leftmost) if any.
 *   3) Then push auth_queues[core][slot] to the right of the pool, andensuring we don't exceed AUTH_POOL_MAX_SIZE.
 * - Validates slot < AUTH_QUEUE_SIZE, core < CORES_COUNT, etc.
 */
export function applyAuthorizationsStf(
  preState: AuthorizationsState,
  input: AuthorizationsInput
): { output: AuthorizationsOutput; postState: AuthorizationsState } {
  // 1) Log the preState for debugging
  console.log(
    "applyAuthorizationsStf: preState:\n",
    JSON.stringify(convertToReadableFormat(preState), null, 2)
  );

  // 2) Clone preState => postState
  const postState = structuredClone(preState) as AuthorizationsState;
  const { auth_pools, auth_queues } = postState;
  const { slot, auths } = input;

  // 3) Basic validation
  if (slot >= AUTH_QUEUE_SIZE) {
    throw new Error(
      `Invalid slot=${slot}. Must be < AUTH_QUEUE_SIZE=${AUTH_QUEUE_SIZE}.`
    );
  }

  // Build a map of (core -> usedHash)
  // If input.auths is empty => no entries => remove-leftmost for all
  const usedHashesByCore = new Map<number, Uint8Array>();
  if (Array.isArray(auths)) {
    for (const { core, auth_hash } of auths) {
      if (core >= CORES_COUNT) {
        throw new Error(
          `Invalid core=${core}; must be < CORES_COUNT=${CORES_COUNT}`
        );
      }
      usedHashesByCore.set(core, auth_hash);
    }
  }

  // 4) For each core in [0..CORES_COUNT)
  for (let c = 0; c < CORES_COUNT; c++) {
    const pool = auth_pools[c];
    // a) Remove
    if (usedHashesByCore.has(c)) {
      // remove the exact auth_hash from the pool
      const targetHash = usedHashesByCore.get(c)!;
      const idx = pool.findIndex((candidate) => arrayEqual(candidate, targetHash));
      if (idx >= 0) {
        pool.splice(idx, 1);
      } else {
        console.warn(
          `applyAuthorizationsStf: core=${c} - used hash not found in pool: ${Buffer.from(targetHash).toString(
            "hex"
          )}`
        );
      }
    } else {
      // remove the leftmost if any
      if (pool.length > 0) {
        pool.shift();
      }
    }

    // b) Append new from queue
    const newHash = auth_queues[c][slot];
    pool.push(newHash);

    // c) If pool size > AUTH_POOL_MAX_SIZE => remove extras from left. Becuase can be less than max size.  
    while (pool.length > AUTH_POOL_MAX_SIZE) {
      pool.shift();
    }
  }

  console.log(
    "applyAuthorizationsStf: postState:\n",
    JSON.stringify(convertToReadableFormat(postState), null, 2)
  );

  // 5) The tests expect output=null
  const output: AuthorizationsOutput = null;
  return { output, postState };
}
