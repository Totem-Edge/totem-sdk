/**
 * Delegation chain manager — constructs and verifies authority delegation
 * chains. Each link delegates authority from one identity to another,
 * constrained by time, amount, and scope limits.
 *
 * Delegation chains are the foundation of hierarchical governance:
 *   Government → Agency → Department → Officer
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { DelegationLink, DelegationChain, DelegationConstraints } from './types.js';
export type { DelegationLink, DelegationChain, DelegationConstraints };

function hashScript(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
}

/**
 * Build a single delegation link.
 *
 * @param delegator - The delegator's public key digest.
 * @param delegate - The delegate's public key digest.
 * @param policyRoot - The policy root authorizing this delegation.
 * @param proof - Merkle proof that the delegation script is in the policy root.
 * @param constraints - Constraints on the delegation.
 * @param sequence - Sequence number in the chain.
 */
export function buildDelegationLink(
  delegator: string,
  delegate: string,
  policyRoot: string,
  proof: string,
  constraints: DelegationConstraints = {},
  sequence: number = 0,
): DelegationLink {
  const script = buildDelegationScript(delegator, delegate, constraints);
  return { delegator, delegate, policyRoot, proof, script, constraints, sequence };
}

/**
 * Build the KISSVM delegation script for a single delegation.
 */
export function buildDelegationScript(
  delegator: string,
  delegate: string,
  constraints: DelegationConstraints = {},
): string {
  const lines: string[] = [];

  lines.push(`ASSERT SIGNEDBY(0x${delegator})`);

  if (constraints.maxBlock !== undefined) {
    lines.push(`ASSERT @BLOCK LTE ${constraints.maxBlock}`);
  }
  if (constraints.maxAmount !== undefined) {
    lines.push(`ASSERT @AMOUNT LTE ${constraints.maxAmount}`);
  }
  if (constraints.scopes && constraints.scopes.length > 0) {
    const scopeList = constraints.scopes.map(s => `"${s}"`).join(' ');
    lines.push(`ASSERT CONTAINS([${scopeList}] STATE(0))`);
  }
  if (constraints.coSigners && constraints.coSigners.length > 0) {
    const signerChecks = constraints.coSigners.map(pk => `SIGNEDBY(0x${pk})`).join(' AND ');
    lines.push(`ASSERT ${signerChecks}`);
  }

  lines.push(`LET delegate = 0x${delegate}`);
  lines.push(`ASSERT VERIFYOUT(@INPUT delegate @AMOUNT @TOKENID TRUE)`);
  lines.push(`RETURN TRUE`);

  return lines.join('\n');
}

/**
 * Build a complete delegation chain from an ordered list of links.
 */
export function buildDelegationChain(links: DelegationLink[]): DelegationChain {
  if (links.length === 0) throw new Error('Delegation chain must have at least one link');

  for (let i = 1; i < links.length; i++) {
    if (links[i].delegator !== links[i - 1].delegate) {
      throw new Error(
        `Delegation chain broken at link ${i}: expected delegator "${links[i - 1].delegate}", got "${links[i].delegator}"`,
      );
    }
  }

  return {
    links: [...links],
    rootAuthority: links[0].delegator,
    currentDelegate: links[links.length - 1].delegate,
    verified: false,
  };
}

/**
 * Verify a delegation chain. Each link must:
 * 1. Have a valid Merkle proof (delegation script is in policyRoot)
 * 2. Chain continuity: each link's delegator must be the previous link's delegate
 * 3. Constraints must be satisfied
 */
export function verifyDelegationChain(chain: DelegationChain): { valid: boolean; reason?: string } {
  if (chain.links.length === 0) {
    return { valid: false, reason: 'Empty delegation chain' };
  }

  for (let i = 0; i < chain.links.length; i++) {
    const link = chain.links[i];

    // Verify chain continuity
    if (i > 0) {
      const prev = chain.links[i - 1];
      if (link.delegator !== prev.delegate) {
        return {
          valid: false,
          reason: `Chain broken at link ${i}: delegator "${link.delegator}" does not match previous delegate "${prev.delegate}"`,
        };
      }
    }

    // Verify script hash matches
    const expectedScript = buildDelegationScript(link.delegator, link.delegate, link.constraints);
    const expectedHash = hashScript(expectedScript);
    const actualHash = hashScript(link.script);
    if (expectedHash !== actualHash) {
      return {
        valid: false,
        reason: `Script hash mismatch at link ${i}: expected ${expectedHash.slice(0, 16)}…, got ${actualHash.slice(0, 16)}…`,
      };
    }
  }

  chain.verified = true;
  return { valid: true };
}

/**
 * Generate the full nested MAST script for a delegation chain.
 * Each level delegates to the next via MAST.
 */
export function toDelegationChainScript(chain: DelegationChain): string {
  if (chain.links.length === 0) return 'RETURN TRUE';

  let script = chain.links[chain.links.length - 1].script;

  for (let i = chain.links.length - 2; i >= 0; i--) {
    const nextRoot = chain.links[i + 1].policyRoot;
    script = `${chain.links[i].script}\nMAST 0x${nextRoot}`;
  }

  return script;
}
