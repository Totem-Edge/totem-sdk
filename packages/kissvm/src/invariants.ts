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
  return `ASSERT MULTISIG(${n} ${keys.map((k) => `0x${k.replace(/^0x/i, '')}`).join(' ')})`;
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
