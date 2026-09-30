/**
 * Proof chain builder — constructs and verifies multi-level recursive MAST
 * proof chains. Each link proves that a script is authorized by a policy
 * root, and the script may delegate to the next policy root.
 *
 * Proof verification delegates to the canonical MMR verifier in
 * mast-compiler.ts. The sorted-pair Merkle hashing previously used here
 * has been removed — all verification now uses Minima-compatible MMR proofs.
 */

import { MiniNumber } from '../MiniNumber.js';
import { verifyScriptMembership, computeCanonicalScriptHash } from './mast-compiler.js';
import { parseScript } from '../parser.js';
import type { ASTNode } from '../types.js';
import type { ProofLink, ProofChain, VerificationResult } from './types.js';
export type { ProofLink, ProofChain, VerificationResult };

// RFC-016 P2: script hashes are canonical MMR leaf hashes, matching the PROOF
// verification path — not raw SHA3(utf8).
function hashScript(script: string): string {
  return computeCanonicalScriptHash(script);
}

export function buildProofChain(links: ProofLink[]): ProofChain {
  if (links.length === 0) throw new Error('Proof chain must have at least one link');

  for (const link of links) {
    const computedHash = hashScript(link.script);
    if (computedHash !== link.scriptHash) {
      throw new Error(`Script hash mismatch for "${link.label ?? 'unnamed'}": expected ${link.scriptHash}, got ${computedHash}`);
    }
  }

  return {
    links: [...links],
    depth: links.length,
    verified: false,
    leafScriptHash: links[links.length - 1].scriptHash,
  };
}

export function verifyProofChain(
  chain: ProofChain,
  expectedLeafScriptHash?: string,
  options?: { expectedRoot?: string },
): VerificationResult {
  if (chain.links.length === 0) {
    return { valid: false, reason: 'Empty proof chain' };
  }

  // RFC-020 RM-PROOF-001: bind the chain to the caller's expected root, so a
  // self-consistent chain under an attacker-controlled root is rejected.
  if (options?.expectedRoot !== undefined) {
    const norm = (h: string) => h.replace(/^0x/i, '').toLowerCase();
    if (norm(chain.links[0].policyRoot) !== norm(options.expectedRoot)) {
      return {
        valid: false,
        failedAt: 0,
        reason: `Root mismatch: expected ${options.expectedRoot.slice(0, 16)}…, got ${chain.links[0].policyRoot.slice(0, 16)}…`,
      };
    }
  }

  for (let i = 0; i < chain.links.length; i++) {
    const link = chain.links[i];

    const result = verifyScriptMembership(link.script, link.proof, link.policyRoot);
    if (!result.valid) {
      return {
        valid: false,
        failedAt: i,
        reason: `MMR proof verification failed at level ${i} ("${link.label ?? 'unnamed'}"): ${result.reason}`,
      };
    }

    if (i < chain.links.length - 1) {
      const nextLink = chain.links[i + 1];
      const mastRef = `MAST 0x${nextLink.policyRoot}`;
      if (!link.script.includes(mastRef) && !link.script.includes(`MAST ${nextLink.policyRoot}`)) {
        return {
          valid: false,
          failedAt: i,
          reason: `Delegation verification failed at level ${i} ("${link.label ?? 'unnamed'}"): script does not contain MAST referencing next root ${nextLink.policyRoot.slice(0, 16)}…`,
        };
      }
    }
  }

  if (expectedLeafScriptHash) {
    const leaf = chain.links[chain.links.length - 1];
    if (leaf.scriptHash !== expectedLeafScriptHash) {
      return {
        valid: false,
        failedAt: chain.links.length - 1,
        reason: `Leaf script hash mismatch: expected ${expectedLeafScriptHash.slice(0, 16)}…, got ${leaf.scriptHash.slice(0, 16)}…`,
      };
    }
  }

  chain.verified = true;
  return { valid: true, chain };
}

/** How a PROOF leaf preimage is rendered as a KISSVM argument. */
export type ProofDataType = 'script' | 'hex';

export interface ProofExpressionOptions {
  /**
   * Force the leaf-preimage argument type. Defaults to inference: a `0x…`
   * value is treated as HEX, anything else as a SCRIPT literal.
   */
  dataType?: ProofDataType;
}

function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, '');
}

/**
 * Render a PROOF leaf preimage as a KISSVM argument.
 *
 * Minima's `PROOF` (`org.minima.kissvm.functions.sha.PROOF`) accepts its data
 * argument either as a HEX value (`0x…`, hashed from the raw bytes) or as a
 * SCRIPT literal (`[ … ]`, hashed from the script's `MiniString`). Scripts MUST
 * be wrapped in square brackets: `ScriptTokenizer` only treats a `[…]` token as
 * a `StringValue`, so an unbracketed script is mis-tokenised (or rejected).
 */
function formatProofData(preimage: string, dataType: ProofDataType): string {
  if (dataType === 'hex') {
    return /^0x/i.test(preimage) ? preimage : `0x${preimage}`;
  }
  return preimage.startsWith('[') && preimage.endsWith(']') ? preimage : `[${preimage}]`;
}

/**
 * Generate a canonical Minima 5-argument PROOF expression:
 *
 *   PROOF(data leafSum rootHash rootSum proofHex)
 *
 * `PROOF` hashes its **data** argument into the leaf via
 * `MMRData.CreateMMRDataLeafNode`, so `data` must be the leaf preimage — the
 * script / raw data — **not** the precomputed leaf hash (passing the hash would
 * double-hash and verify a different leaf than `compileMastTree` produced).
 *
 * Defaults to `link.script` and auto-formats it as a `[ … ]` SCRIPT literal
 * (or, for `0x…` data, as HEX). When the preimage is a script at leaf-sum 0 the
 * call fails closed unless it hashes to `link.scriptHash`, so an unverifiable
 * PROOF cannot be emitted.
 *
 * @throws when there is no preimage, when `data` is the precomputed
 * `scriptHash`, or when a script preimage does not hash to `link.scriptHash`.
 */
export function toMinimaProofExpression(
  link: ProofLink,
  data?: string,
  options?: ProofExpressionOptions,
): string {
  const preimage = data ?? link.script;
  if (!preimage) {
    throw new Error(
      'toMinimaProofExpression: PROOF data (the leaf preimage, not the leaf hash) is required.',
    );
  }

  const dataType: ProofDataType =
    options?.dataType ?? (/^0x[0-9a-fA-F]+$/.test(preimage) ? 'hex' : 'script');

  const preimageHex = stripHexPrefix(preimage).toLowerCase();
  const scriptHashHex = stripHexPrefix(link.scriptHash ?? '').toLowerCase();
  if (scriptHashHex && preimageHex === scriptHashHex) {
    throw new Error(
      'toMinimaProofExpression: PROOF hashes its data into the leaf; passing the leaf hash double-hashes. Pass the script/preimage.',
    );
  }

  const leafSum = link.leafSum ?? MiniNumber.ZERO;
  const rootSum = link.rootSum ?? MiniNumber.ZERO;

  // Fail closed if a script preimage does not match the leaf it claims to
  // authorize. Only meaningful at leaf-sum 0, the SDK's canonical case.
  const zeroSum = link.leafSum === undefined || link.leafSum.unscaled === 0n;
  if (dataType === 'script' && zeroSum && scriptHashHex) {
    const computed = stripHexPrefix(computeCanonicalScriptHash(preimage)).toLowerCase();
    if (computed !== scriptHashHex) {
      throw new Error(
        `toMinimaProofExpression: script preimage does not hash to the link leaf (expected ${scriptHashHex.slice(0, 16)}…, got ${computed.slice(0, 16)}…).`,
      );
    }
  }

  const root = stripHexPrefix(link.policyRoot);
  const proof = stripHexPrefix(link.proof);
  return `PROOF(${formatProofData(preimage, dataType)} ${leafSum} 0x${root} ${rootSum} 0x${proof})`;
}

/**
 * @deprecated Use toMinimaProofExpression(). Canonical Minima PROOF takes
 * five arguments: data, leafSum, rootHash, rootSum, proofHex.
 */
export function toTotemProofExpression(link: ProofLink): string {
  return toMinimaProofExpression(link);
}

/**
 * @deprecated Use toMinimaProofExpression(). Canonical Minima PROOF takes
 * five arguments: data, leafSum, rootHash, rootSum, proofHex.
 */
export function toProofExpression(link: ProofLink): string {
  return toMinimaProofExpression(link);
}

/**
 * Generate the full nested MAST KISSVM script for a proof chain.
 *
 * Each level uses `MAST 0x<root>` to auto-load the next script from the
 * transaction witness. The VM looks up the witness ScriptProof whose
 * calculated address equals the given root, parses it, and executes it
 * in the same contract context.
 *
 * VM limits: 64 stack depth, 1,024 instructions shared across all frames.
 *
 * @returns KISSVM script with nested MAST expressions.
 */
/**
 * Strip a terminal `RETURN TRUE` so an appended terminal `MAST` is reachable.
 * RFC-018 RM-COMPOSE-001: MAST is terminal, so a layer ending in `RETURN` makes
 * the appended `MAST <child>` dead. Only `RETURN TRUE` may be stripped; any other
 * terminal `RETURN` (e.g. `RETURN FALSE`) fails closed rather than silently
 * becoming a delegation.
 */
function stripTerminalReturnTrue(script: string): string {
  let t = script.replace(/\s+$/, '');
  // Drop trailing blank / comment-only lines so an inline RETURN is terminal.
  t = t.replace(/(?:\n[ \t]*(?:\/\/[^\n]*)?)+$/, '');
  const retTrue = t.match(/(?:^|\s)RETURN\s+TRUE\s*(?:\/\/[^\n]*)?$/i);
  if (retTrue) {
    t = t.slice(0, retTrue.index).replace(/\s+$/, '');
  } else {
    const anyRet = t.match(/(?:^|\s)RETURN\b[^\n]*$/i);
    if (anyRet) {
      throw new Error('toNestedMastScript: refusing to compose a layer with a terminal RETURN that is not RETURN TRUE');
    }
  }
  // RFC-020 RM-COMPOSE-002: a RETURN nested in a taken branch (e.g. inside an
  // IF) is not terminal at the text level but still makes the appended MAST
  // unreachable. Parse the layer and reject any surviving RETURN.
  let ast: ASTNode[];
  try {
    ast = parseScript(t);
  } catch (err) {
    throw new Error(`toNestedMastScript: layer does not parse: ${(err as Error).message}`);
  }
  if (walkHasReturn(ast)) {
    throw new Error('toNestedMastScript: layer contains a RETURN before the appended MAST');
  }
  return t;
}

export function walkHasReturn(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(walkHasReturn);
  if (!node || typeof node !== 'object') return false;
  if ((node as { type?: string }).type === 'RETURN') return true;
  return Object.entries(node as Record<string, unknown>).some(
    ([key, value]) => key !== 'span' && walkHasReturn(value),
  );
}

export function toNestedMastScript(chain: ProofChain): string {
  // RFC-016 I4: an empty chain must fail construction, not compile to allow-all.
  if (chain.links.length === 0) {
    throw new Error('toNestedMastScript: empty proof chain');
  }

  let script = chain.links[chain.links.length - 1].script;

  for (let i = chain.links.length - 2; i >= 0; i--) {
    const nextRoot = chain.links[i + 1].policyRoot;
    // RFC-018 RM-COMPOSE-001: strip a trailing RETURN TRUE so the child MAST runs.
    script = `${stripTerminalReturnTrue(chain.links[i].script)}\nMAST 0x${nextRoot}`;
  }

  return script;
}
