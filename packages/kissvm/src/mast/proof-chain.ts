/**
 * Proof chain builder — constructs and verifies multi-level recursive MAST
 * proof chains. Each link proves that a script is authorized by a policy
 * root, and the script may delegate to the next policy root.
 *
 * Proof verification delegates to the canonical MMR verifier in
 * mast-compiler.ts. The sorted-pair Merkle hashing previously used here
 * has been removed — all verification now uses Minima-compatible MMR proofs.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import { MiniNumber } from '../MiniNumber.js';
import { verifyScriptMembership } from './mast-compiler.js';
import type { ProofLink, ProofChain, VerificationResult } from './types.js';
export type { ProofLink, ProofChain, VerificationResult };

function hashScript(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
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
): VerificationResult {
  if (chain.links.length === 0) {
    return { valid: false, reason: 'Empty proof chain' };
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

/**
 * Generate a canonical Minima 5-argument PROOF expression.
 *
 * Canonical Minima syntax: PROOF(data, leafSum, rootHash, rootSum, proofHex)
 *
 * @returns Minima expression: `PROOF(0x<scriptHash> <leafSum> 0x<policyRoot> <rootSum> 0x<proof>)`
 */
export function toMinimaProofExpression(link: ProofLink): string {
  const leafSum = link.leafSum ?? MiniNumber.ZERO;
  const rootSum = link.rootSum ?? MiniNumber.ZERO;
  return `PROOF(0x${link.scriptHash} ${leafSum} 0x${link.policyRoot} ${rootSum} 0x${link.proof})`;
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
export function toNestedMastScript(chain: ProofChain): string {
  if (chain.links.length === 0) return 'RETURN TRUE';

  let script = chain.links[chain.links.length - 1].script;

  for (let i = chain.links.length - 2; i >= 0; i--) {
    const nextRoot = chain.links[i + 1].policyRoot;
    script = `${chain.links[i].script}\nMAST 0x${nextRoot}`;
  }

  return script;
}
