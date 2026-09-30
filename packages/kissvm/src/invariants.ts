/**
 * @module @totemsdk/kissvm/invariants
 *
 * The RFC-016 security contract for executable policy scripts, as reusable
 * generator helpers plus a static invariant detector used by the adversarial
 * harness.
 *
 * Four invariants every authorizing script must satisfy:
 *
 *   I1 authorization — every executable branch authenticates a fixed or
 *      previously-committed authority, or explicitly declares itself
 *      permissionless. Authority is never derived solely from mutable `STATE`.
 *   I2 economic — payment/fee/escrow/release/distribution/redemption/withdrawal
 *      binds the actual transaction output with `VERIFYOUT`.
 *   I3 state — immutable commitments use `PREVSTATE`/`SAMESTATE`; transitions
 *      have an exact old → new relation.
 *   I4 fail-closed — authorization is an exhaustive selection with
 *      `ELSE RETURN FALSE`; empty/malformed policies fail construction.
 *
 * Helpers are string builders so they compose into the existing template
 * generators without changing the codegen style.
 */

import { parseScript } from './parser.js';
import type { ASTNode, LetNode, IdentNode, SignedbyNode, ChecksigNode, MultisigNode } from './types.js';

// ── Helpers (build-time) ────────────────────────────────────────────────────

/** I4: fail construction rather than compile to an allow-all script. */
export function assertNonEmpty(items: readonly unknown[], label: string): void {
  if (items.length === 0) {
    throw new Error(`${label}: refusing to build an empty (allow-all) policy`);
  }
}

/**
 * I1: authorize against a **fixed** key or a **previously committed** authority
 * (`PREVSTATE(port)`). Never pass a value read from mutable current `STATE`.
 */
export function authorizeFixed(authority: { key: string } | { prevStatePort: number }): string {
  if ('key' in authority) {
    const key = authority.key.replace(/^0x/i, '');
    return `ASSERT SIGNEDBY(0x${key})`;
  }
  return `ASSERT SIGNEDBY(PREVSTATE(${authority.prevStatePort}))`;
}

/** I1: require n-of-m signatures over a fixed key set. */
export function authorizeMultisig(n: number, keys: readonly string[]): string {
  assertNonEmpty(keys, 'authorizeMultisig.keys');
  // RFC-020 KISSVM-MULTISIG-THRESHOLD-001: enforce a meaningful threshold.
  const normalized = keys.map((k) => k.replace(/^0x/i, '').toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('authorizeMultisig.keys: duplicate keys collapse MULTISIG positions');
  }
  if (!Number.isInteger(n) || n < 1 || n > normalized.length) {
    throw new Error(`authorizeMultisig: n must satisfy 1 <= n <= ${normalized.length}`);
  }
  return `ASSERT MULTISIG(${n} ${normalized.map((k) => `0x${k}`).join(' ')})`;
}

/** I3: an immutable field must be carried forward unchanged. */
export function assertStateUnchanged(port: number): string {
  return `ASSERT STATE(${port}) EQ PREVSTATE(${port})`;
}

/** I3: a transition counter must strictly increase. */
export function assertMonotonic(port: number): string {
  return `ASSERT STATE(${port}) GT PREVSTATE(${port})`;
}

/**
 * I2: bind a payment to the **actual output** (not the input claims).
 * `@AMOUNT`/`@ADDRESS`/`@TOKENID` describe the input coin and are not a payment.
 */
export function payExact(address: string, amount: string, tokenExpr: string = '@TOKENID'): string {
  const addr = address.startsWith('@') || address.startsWith('0x') ? address : `0x${address.replace(/^0x/i, '')}`;
  return `ASSERT VERIFYOUT(@INPUT ${addr} ${amount} ${tokenExpr} TRUE)`;
}

/** I4: exhaustive selection; an unmatched selector returns FALSE. */
export function branch(
  selector: string,
  cases: readonly { when: string; then: readonly string[] }[],
  opts: { elseReturnFalse?: boolean } = {},
): string {
  const lines: string[] = [];
  cases.forEach((c, i) => {
    lines.push(`${i === 0 ? 'IF' : 'ELSEIF'} ${selector} EQ ${c.when} THEN`);
    for (const line of c.then) lines.push(`  ${line}`);
  });
  lines.push('ELSE');
  lines.push(opts.elseReturnFalse === false ? '  RETURN TRUE' : '  RETURN FALSE');
  lines.push('ENDIF');
  return lines.join('\n');
}

// ── Invariant detector (static) ─────────────────────────────────────────────

export type InvariantId = 'I1' | 'I2' | 'I3' | 'I4';

export interface InvariantAuditInput {
  readonly name: string;
  readonly script: string;
  /** I1 applies. */
  readonly expectsAuthorization?: boolean;
  /** I2 applies (payment/escrow/etc.). */
  readonly expectsPayment?: boolean;
  /**
   * I3 applies: ports whose value constrains the spend (lock/rate/recipient/
   * timing) and must therefore be committed (carried unchanged from PREVSTATE).
   */
  readonly immutablePorts?: readonly number[];
  /**
   * The template is intentionally permissionless; I1 is then satisfied by an
   * explicit `RETURN TRUE`-style permissionless marker rather than a signer.
   */
  readonly permissionless?: boolean;
}

export interface InvariantViolation {
  readonly invariant: InvariantId;
  readonly detail: string;
}

const SIGNEDBY_CALL = /SIGNEDBY\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
const STATE_BINDING = /LET\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*STATE\(\s*(\d+)\s*\)/g;

function isAstNode(value: unknown): value is ASTNode {
  return !!value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';
}

/** Collect `LET name = <expr>` bindings so authority can be traced structurally. */
function collectLetBindings(ast: ASTNode[]): Map<string, ASTNode> {
  const bindings = new Map<string, ASTNode>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const c of node) visit(c); return; }
    if (!isAstNode(node)) return;
    if (node.type === 'LET') bindings.set((node as LetNode).name, (node as LetNode).value);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'span') continue;
      visit(value);
    }
  };
  visit(ast);
  return bindings;
}

/**
 * RFC-018 P2-4: does this authority expression read mutable current `STATE`
 * (directly, or through a chain of `LET` bindings)? A `PREVSTATE` anchor or a
 * literal is not mutable-state authority.
 */
function derivesFromMutableState(
  node: ASTNode,
  bindings: Map<string, ASTNode>,
  seen: Set<string> = new Set(),
): boolean {
  if (node.type === 'STATE') return true;
  if (node.type === 'IDENT') {
    const name = (node as IdentNode).name;
    if (seen.has(name)) return false;
    seen.add(name);
    const bound = bindings.get(name);
    return bound ? derivesFromMutableState(bound, bindings, seen) : false;
  }
  return false;
}

/** RFC-020 INV-001: statements after any of these in the same block are dead. */
const TERMINAL_STATEMENTS = new Set(['RETURN', 'EXEC', 'EXEC_MAST', 'MAST_STMT']);

/** RFC-018 P2-4 / RFC-020 P1-6: statements after a terminal op in the same block are dead. */
function findUnreachableStatements(nodes: ASTNode[], out: InvariantViolation[]): void {
  for (let i = 0; i < nodes.length - 1; i++) {
    if (TERMINAL_STATEMENTS.has(nodes[i].type)) {
      out.push({
        invariant: 'I4',
        detail: `unreachable statement after terminal ${nodes[i].type} in the same block`,
      });
      break;
    }
  }
  for (const node of nodes) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'span' || !Array.isArray(value)) continue;
      if (value.length > 0 && value.every(isAstNode)) findUnreachableStatements(value as ASTNode[], out);
    }
  }
}

/**
 * Static, deterministic detector of the RFC-016 invariants. Heuristic: it flags
 * the confirmed anti-patterns (authority from mutable state, missing output
 * binding, unmatched authorizing branches). It is the gate for the adversarial
 * harness, not a substitute for dynamic evaluation.
 */
export function auditScriptInvariants(input: InvariantAuditInput): InvariantViolation[] {
  const { script } = input;
  const violations: InvariantViolation[] = [];

  // I1 — authorization from fixed/prev-state authority.
  if (input.expectsAuthorization && !input.permissionless) {
    if (!/\bSIGNEDBY\(|\bMULTISIG\(/.test(script)) {
      violations.push({ invariant: 'I1', detail: 'no SIGNEDBY/MULTISIG in an authorizing script' });
    }
    // A signer read from mutable current STATE is only acceptable when the
    // script also anchors authority to the committed past (`PREVSTATE`). Without
    // any `PREVSTATE`, a state-derived signer is attacker-chosen.
    const bindings = new Map<string, string>();
    for (const m of script.matchAll(STATE_BINDING)) bindings.set(m[1], m[2]);
    if (!/PREVSTATE\(/.test(script)) {
      for (const m of script.matchAll(SIGNEDBY_CALL)) {
        const port = bindings.get(m[1]);
        if (port === undefined) continue;
        violations.push({
          invariant: 'I1',
          detail: `SIGNEDBY(${m[1]}) derives authority from mutable STATE(${port}) with no PREVSTATE anchor`,
        });
      }
    }
  }

  // I2 — economic binding to the actual output.
  if (input.expectsPayment && !/\bVERIFYOUT\(/.test(script)) {
    violations.push({ invariant: 'I2', detail: 'no VERIFYOUT: payment/escrow claim is not bound to an output' });
  }

  // RFC-018 P2-4: structural AST checks (authority from mutable STATE, dead code).
  let ast: ASTNode[] | undefined;
  try {
    ast = parseScript(script);
  } catch {
    ast = undefined;
  }
  if (ast) {
    if (input.expectsAuthorization && !input.permissionless) {
      const bindings = collectLetBindings(ast);
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) { for (const c of node) visit(c); return; }
        if (!isAstNode(node)) return;
        if (node.type === 'SIGNEDBY') {
          if (derivesFromMutableState((node as SignedbyNode).pubkey, bindings)) {
            violations.push({ invariant: 'I1', detail: 'SIGNEDBY derives authority from mutable STATE' });
          }
        } else if (node.type === 'CHECKSIG') {
          const arg = (node as ChecksigNode).args[0];
          if (arg && derivesFromMutableState(arg, bindings)) {
            violations.push({ invariant: 'I1', detail: 'CHECKSIG derives authority from mutable STATE' });
          }
        } else if (node.type === 'MULTISIG') {
          for (const key of (node as MultisigNode).keys) {
            if (derivesFromMutableState(key, bindings)) {
              violations.push({ invariant: 'I1', detail: 'MULTISIG key derives authority from mutable STATE' });
            }
          }
        }
        for (const [key, value] of Object.entries(node)) {
          if (key === 'span') continue;
          visit(value);
        }
      };
      visit(ast);
    }
    findUnreachableStatements(ast, violations);
  }

  // I3 — immutable/constraint state must be committed (carried from PREVSTATE).
  // RFC-016: a lock/rate/recipient/timing parameter read from mutable STATE can
  // be altered by the spender unless continuity is asserted.
  if (input.immutablePorts && input.immutablePorts.length > 0) {
    for (const port of input.immutablePorts) {
      const readsState = new RegExp(`STATE\\(\\s*${port}\\s*\\)`).test(script);
      const preserves =
        new RegExp(`STATE\\(\\s*${port}\\s*\\)\\s*EQ\\s*PREVSTATE\\(\\s*${port}\\s*\\)`).test(script) ||
        new RegExp(`PREVSTATE\\(\\s*${port}\\s*\\)\\s*EQ\\s*STATE\\(\\s*${port}\\s*\\)`).test(script) ||
        new RegExp(`SAMESTATE\\(\\s*${port}\\s+${port}\\s*\\)`).test(script);
      if (readsState && !preserves) {
        violations.push({
          invariant: 'I3',
          detail: `STATE(${port}) constrains the spend but is not committed (missing STATE(${port}) EQ PREVSTATE(${port}))`,
        });
      }
    }
  }

  // I4 — fail-closed exhaustive branching. Two or more independent conditional
  // branches without an `ELSE RETURN FALSE` can fall through to `RETURN TRUE`.
  const ifCount = (script.match(/\bIF\b/g) ?? []).length;
  const hasElseReturnFalse = /ELSE\b[\s\S]*?RETURN\s+FALSE/i.test(script);
  if (ifCount >= 2 && !hasElseReturnFalse && /RETURN\s+TRUE/i.test(script)) {
    violations.push({
      invariant: 'I4',
      detail: 'independent conditional blocks can fall through to RETURN TRUE without ELSE RETURN FALSE',
    });
  }

  return violations;
}

/** True when a script satisfies every applicable invariant. */
export function satisfiesInvariants(input: InvariantAuditInput): boolean {
  return auditScriptInvariants(input).length === 0;
}
