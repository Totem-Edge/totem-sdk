/**
 * MMR membership covenant (RFC-048 §12.4) — prove, on-chain, that a runtime leaf
 * is included in a committed MMR root, using the canonical `PROOF` opcode.
 *
 * This is the per-leaf primitive behind **committed-set-root scaling**: rather
 * than emitting one escape branch per party (an O(N) script), the spender commits
 * its leaf and MMR proof to state and the script verifies inclusion against the
 * committed root. The leaf is the signer's own WOTS public-key digest (`0x…`), so
 * `SIGNEDBY(leaf)` binds the identity and `VERIFYOUT(0 leaf …)` pays exactly it.
 *
 * Runtime typing (matches a Minima node): the `data` operand is a HEX leaf when
 * its evaluated value starts with `0x` (hashed from raw bytes) and a SCRIPT leaf
 * otherwise. Here the leaf is supplied via `STATE(leafPort)` as `0x<pubkey>`, so
 * it types as HEX and matches an `MMRTree.fromPublicKeys(...)` root.
 */

export interface MmrMembershipCovenantConfig {
  /** State port holding the committed MMR root (pinned immutable via `SAMESTATE`). */
  rootPort: number;
  /** State port where the spender commits the leaf data (`0x<pubkey>`). */
  leafPort: number;
  /** State port where the spender commits the serialized MMR proof (`0x…`). */
  proofPort: number;
  /** Asset id (hex). Defaults to `0x00` (MINIMA). */
  tokenId?: string;
  /** Leaf sum value (fixed). Default 0. Ignored when `leafSumPort` is set. */
  leafSum?: bigint;
  /** Root sum value (fixed). Default 0. Ignored when `rootSumPort` is set. */
  rootSum?: bigint;
  /**
   * State port where the spender commits the leaf sum (e.g. a committed balance).
   * When set, overrides `leafSum`.
   */
  leafSumPort?: number;
  /**
   * State port where the spender commits the root sum (e.g. total committed).
   * When set, overrides `rootSum`.
   */
  rootSumPort?: number;
  /** Require the signer's key to equal the leaf (default `true`). */
  requireSignature?: boolean;
  /** Pay the whole balance to the leaf identity (default `true`). */
  pay?: boolean;
}

function requirePort(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`MmrMembershipCovenantConfig.${field} must be a byte port (0–255); received ${JSON.stringify(value)}`);
  }
  return value;
}

function requireHex(value: string, field: string): string {
  const raw = value.replace(/^0x/i, '');
  if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`MmrMembershipCovenantConfig.${field} must be a hex string; received ${JSON.stringify(value)}`);
  }
  return raw;
}

/** Build the MMR membership covenant script. */
export function buildMmrMembershipCovenant(config: MmrMembershipCovenantConfig): string {
  const rootPort = requirePort(config.rootPort, 'rootPort');
  const leafPort = requirePort(config.leafPort, 'leafPort');
  const proofPort = requirePort(config.proofPort, 'proofPort');
  const tokenId = config.tokenId ? '0x' + requireHex(config.tokenId, 'tokenId') : '0x00';
  const leafSumExpr = config.leafSumPort !== undefined
    ? `STATE(${requirePort(config.leafSumPort, 'leafSumPort')})`
    : (config.leafSum ?? 0n).toString();
  const rootSumExpr = config.rootSumPort !== undefined
    ? `STATE(${requirePort(config.rootSumPort, 'rootSumPort')})`
    : (config.rootSum ?? 0n).toString();
  const requireSignature = config.requireSignature ?? true;
  const pay = config.pay ?? true;

  const body: string[] = [`ASSERT PROOF(leaf ${leafSumExpr} root ${rootSumExpr} mmrproof)`];
  if (requireSignature) {
    body.push(`IF SIGNEDBY(leaf) THEN`);
    if (pay) body.push(`  ASSERT VERIFYOUT(0 leaf @AMOUNT ${tokenId} FALSE)`);
    body.push(`  RETURN TRUE`);
    body.push(`ENDIF`);
  } else {
    if (pay) body.push(`ASSERT VERIFYOUT(0 leaf @AMOUNT ${tokenId} FALSE)`);
    body.push(`RETURN TRUE`);
  }

  return [
    `// MMR membership covenant (RFC-048 §12.4) — per-leaf inclusion in a committed root`,
    `LET root = PREVSTATE(${rootPort})`,
    `ASSERT SAMESTATE(${rootPort} ${rootPort})`,
    `LET leaf = STATE(${leafPort})`,
    `LET mmrproof = STATE(${proofPort})`,
    ...body,
    `RETURN FALSE`,
  ].join('\n');
}
