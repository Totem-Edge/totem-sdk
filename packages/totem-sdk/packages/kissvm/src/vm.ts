import { KissvmLimitError } from './errors.js';
import type { Value, Scalar, ScriptWitness, TxContext, ASTNode } from './types.js';

export const LIMITS = {
  MAX_INSTRUCTIONS: 1024,
  MAX_STACK_DEPTH: 64,
  MAX_PARAMS: 32,
  MAX_STRING_BYTES: 65536,
  MAX_SHIFT_BITS: 256,
} as const;

export interface UserFunction {
  params: string[];
  body: ASTNode[];
  closureEnv: Map<string, Value>;
}

export interface MastBranch {
  hash: string;
  body: ASTNode[];
}

export class VMState {
  /** Instruction counter shared across all frames (including recursive MAST) */
  instructionCount = 0;

  /**
   * Variable environment stack.
   * KISSVM uses flat (script-level) scoping: LET updates the nearest enclosing
   * binding rather than shadowing it.  A NEW frame is only pushed for user-
   * defined function calls (pushCallFrame).  Block constructs (IF/FOR/SWITCH)
   * use pushBlockScope which only increments the depth counter without creating
   * a new env frame.
   */
  private envStack: Map<string, Value>[] = [new Map()];

  /** Call-stack depth guard */
  private callDepth = 0;

  /** User-defined functions */
  readonly funcs: Map<string, UserFunction> = new Map();

  /** Execution trace lines */
  readonly trace: string[] = [];

  /**
   * Branches stored by the most recent MAST { … } definition block.
   * Used by EXEC MAST to select and run a branch.
   */
  mastBlock?: MastBranch[];

  constructor(
    public readonly witness: ScriptWitness,
    public readonly txCtx: TxContext,
  ) {}

  // ─── Scope helpers ────────────────────────────────────────────────────────

  get(name: string): Value | undefined {
    for (let i = this.envStack.length - 1; i >= 0; i--) {
      const v = this.envStack[i].get(name);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  /**
   * LET semantics: if the variable already exists in ANY enclosing scope,
   * update it there (flat/upward assignment).  Otherwise create in current scope.
   */
  set(name: string, value: Value): void {
    for (let i = this.envStack.length - 1; i >= 0; i--) {
      if (this.envStack[i].has(name)) {
        this.envStack[i].set(name, value);
        return;
      }
    }
    this.envStack[this.envStack.length - 1].set(name, value);
  }

  /** Push a new scope for a function call */
  pushCallFrame(): void {
    this.callDepth++;
    if (this.callDepth > LIMITS.MAX_STACK_DEPTH) {
      throw new KissvmLimitError(`Call stack depth exceeded (max ${LIMITS.MAX_STACK_DEPTH})`);
    }
    this.envStack.push(new Map());
  }

  popCallFrame(): void {
    this.callDepth = Math.max(0, this.callDepth - 1);
    if (this.envStack.length > 1) this.envStack.pop();
  }

  /**
   * Block-level scope used only to enforce the depth limit for deeply nested
   * IF/FOR/SWITCH blocks.  Does NOT push a new env frame (flat scoping).
   */
  pushBlockScope(): void {
    this.callDepth++;
    if (this.callDepth > LIMITS.MAX_STACK_DEPTH) {
      throw new KissvmLimitError(`Stack depth exceeded (max ${LIMITS.MAX_STACK_DEPTH})`);
    }
  }

  popBlockScope(): void {
    this.callDepth = Math.max(0, this.callDepth - 1);
  }

  // ─── Instruction counting ─────────────────────────────────────────────────

  tick(n = 1): void {
    this.instructionCount += n;
    if (this.instructionCount > LIMITS.MAX_INSTRUCTIONS) {
      throw new KissvmLimitError(`Instruction limit exceeded (max ${LIMITS.MAX_INSTRUCTIONS})`);
    }
  }

  addTrace(msg: string): void {
    this.trace.push(msg);
  }

  // ─── Snapshot current scope for closures ─────────────────────────────────

  snapshotEnv(): Map<string, Value> {
    const snap = new Map<string, Value>();
    for (const frame of this.envStack) {
      for (const [k, v] of frame) snap.set(k, v);
    }
    return snap;
  }
}
