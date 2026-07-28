/**
 * Graph-level verification.
 *
 * verifyProofGraph: iterates proof nodes, recovers SignedProof from node.data,
 * and delegates to @totemsdk/proof's verifyProof for each one.
 * Never reimplements cryptography.
 *
 * verifyGraphProofs: same logic, returns the list of invalid proof IDs (string[]).
 */

import * as proofModule from '@totemsdk/proof';
import type { SignedProof } from '@totemsdk/proof';
import type { ProofGraph, ProofGraphVerifyResult } from './types.js';

/**
 * Verify every proof node stored in the graph.
 *
 * Iterates nodes of type 'proof', casts node.data back to SignedProof,
 * and calls proofModule.verifyProof() from @totemsdk/proof.
 * Returns { valid: true } if ALL proofs pass; otherwise lists the failing proofIds.
 */
export function verifyProofGraph(
  graph: ProofGraph,
  _options?: Record<string, unknown>,
): ProofGraphVerifyResult {
  const invalidProofs: string[] = [];

  for (const node of graph.nodes) {
    if (node.type !== 'proof' || !node.data) continue;

    const signedProof = node.data as unknown as SignedProof;
    const result = proofModule.verifyProof(signedProof);
    if (!result.valid) {
      invalidProofs.push(node.refId);
    }
  }

  return {
    valid: invalidProofs.length === 0,
    invalidProofs,
  };
}

/**
 * Returns the list of invalid proof IDs in the graph.
 * Equivalent to verifyProofGraph(graph).invalidProofs.
 */
export function verifyGraphProofs(graph: ProofGraph): string[] {
  return verifyProofGraph(graph).invalidProofs;
}
