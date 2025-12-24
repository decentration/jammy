// src/risc-pvm/runner/withHostTracing.ts
export type HostEnter = (nameOrId: string, args?: unknown) => void;
export type HostExit  = (nameOrId: string, ret?: unknown, gasUsed?: bigint) => void;

/** Wrap an env so calls on it get traced (optional). */
export function withEnvTracing<T extends object>(
  env: T,
  onEnter: HostEnter,
  onExit: HostExit,
): T {
  return new Proxy(env, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (typeof val !== "function") return val;
      const name = String(prop);
      return (...args: unknown[]) => {
        onEnter(name, args);
        const ret = (val as Function).apply(target, args);
        onExit(name, ret);
        return ret;
      };
    },
  });
}

/** Wrap the HostDispatcher to trace host-call enter/exit + gas delta. */
import type { HostDispatcher } from "../interpreter/host/types";
import type { InterpreterState } from "../interpreter/types";

export function withHostDispatcherTracing(
  base: HostDispatcher,
  onEnter: (id: number, name?: string) => void,
  onExit:  (id: number, name: string | undefined, gasUsed: bigint) => void,
  idToName?: (id: number) => string | undefined,
): HostDispatcher {
  return (state: InterpreterState, env: any) => {
    const id = Number(state.exit?.id ?? -1);
    const name = idToName?.(id);
    onEnter(id, name);
    const gasBefore = state.gas;
    const next = base(state, env);
    const gasAfter = next.gas;
    onExit(id, name, gasBefore - gasAfter);
    return next;
  };
}
