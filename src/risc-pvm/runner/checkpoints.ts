export type Checkpoint =
  | { kind: "host"; name: string; seq: number; args: unknown[]; ret?: unknown }
  | { kind: "tick"; step: number; pc: bigint }
  | { kind: "ledger"; hash: string; items: number };

export class Journal {
  private out: (c: Checkpoint) => void;
  private hostSeq = 0;
  private lastArgs = new Map<number, unknown[]>();

  constructor(out: (c: Checkpoint) => void) { this.out = out; }

  onHostEnter(name: string, args: unknown[]) {
    const seq = ++this.hostSeq;
    this.lastArgs.set(seq, args);
    this.out({ kind: "host", name, seq, args });
  }

  onHostExit(name: string, ret: unknown) {
    const seq = this.hostSeq;
    const args = this.lastArgs.get(seq) ?? [];
    this.out({ kind: "host", name, seq, args, ret });
  }

  onTick(step: number, pc: bigint) {
    if (step % 100_000 === 0) this.out({ kind: "tick", step, pc });
  }

  onLedger(hash: string, items: number) {
    this.out({ kind: "ledger", hash, items });
  }
}
