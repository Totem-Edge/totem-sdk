/**
 * Cross-domain trust bridge — enables one policy space to accept proofs
 * from another policy space. This is the foundation for cross-domain
 * trust: one country's identity system → another country's acceptance rules.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { CrossDomainBridge, CrossDomainConstraints } from './types.js';
export type { CrossDomainBridge, CrossDomainConstraints };

function hashScript(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
}

/**
 * Build a cross-domain trust bridge.
 *
 * @param sourceDomain - Source domain identifier.
 * @param targetDomain - Target domain identifier.
 * @param sourcePolicyRoot - The policy root in the source domain that accepts target proofs.
 * @param targetPolicyRoot - The policy root in the target domain being accepted.
 * @param acceptanceProof - Merkle proof that the acceptance script is in the source policy root.
 * @param constraints - Constraints on accepted proofs.
 */
export function buildCrossDomainBridge(
  sourceDomain: string,
  targetDomain: string,
  sourcePolicyRoot: string,
  targetPolicyRoot: string,
  acceptanceProof: string,
  constraints: CrossDomainConstraints = {},
): CrossDomainBridge {
  const acceptanceScript = buildAcceptanceScript(targetDomain, targetPolicyRoot, constraints);
  return {
    sourceDomain,
    targetDomain,
    sourcePolicyRoot,
    targetPolicyRoot,
    acceptanceProof,
    acceptanceScript,
    constraints,
  };
}

/**
 * Build the KISSVM acceptance script for a cross-domain bridge.
 * This script runs in the source domain and validates that a proof
 * from the target domain satisfies the bridge constraints.
 */
export function buildAcceptanceScript(
  targetDomain: string,
  targetPolicyRoot: string,
  constraints: CrossDomainConstraints = {},
): string {
  const lines: string[] = [];

  lines.push(`// Cross-domain trust bridge: accept proofs from ${targetDomain}`);
  lines.push(`LET targetRoot = 0x${targetPolicyRoot}`);

  if (constraints.maxDepth !== undefined) {
    lines.push(`LET maxDepth = ${constraints.maxDepth}`);
    lines.push(`ASSERT STATE(1) LTE maxDepth`);
  }

  if (constraints.requiredAttributes && constraints.requiredAttributes.length > 0) {
    for (const attr of constraints.requiredAttributes) {
      lines.push(`ASSERT STATE(2) EQ "${attr}"`);
    }
  }

  if (constraints.expiryBlock !== undefined) {
    lines.push(`ASSERT @BLOCK LTE ${constraints.expiryBlock}`);
  }

  lines.push(`MAST 0x${targetPolicyRoot}`);
  lines.push(`RETURN TRUE`);

  return lines.join('\n');
}

/**
 * Build a bidirectional trust bridge (mutual recognition between two domains).
 */
export function buildBidirectionalBridge(
  domainA: string,
  domainB: string,
  rootA: string,
  rootB: string,
  proofAtoB: string,
  proofBtoA: string,
  constraints: CrossDomainConstraints = {},
): [CrossDomainBridge, CrossDomainBridge] {
  return [
    buildCrossDomainBridge(domainA, domainB, rootA, rootB, proofAtoB, constraints),
    buildCrossDomainBridge(domainB, domainA, rootB, rootA, proofBtoA, constraints),
  ];
}

/**
 * Build a trust network — a set of cross-domain bridges forming a
 * connected graph of mutually trusting policy spaces.
 */
export function buildTrustNetwork(
  bridges: CrossDomainBridge[],
): { domains: string[]; bridges: CrossDomainBridge[]; isConnected: boolean } {
  const domains = new Set<string>();
  for (const bridge of bridges) {
    domains.add(bridge.sourceDomain);
    domains.add(bridge.targetDomain);
  }

  // Check connectivity: every domain must be reachable from every other
  const domainList = [...domains];
  const adj = new Map<string, Set<string>>();
  for (const d of domainList) adj.set(d, new Set());
  for (const bridge of bridges) {
    adj.get(bridge.sourceDomain)?.add(bridge.targetDomain);
    adj.get(bridge.targetDomain)?.add(bridge.sourceDomain);
  }

  const visited = new Set<string>();
  function dfs(d: string): void {
    visited.add(d);
    for (const n of adj.get(d) ?? []) {
      if (!visited.has(n)) dfs(n);
    }
  }
  if (domainList.length > 0) dfs(domainList[0]);

  return {
    domains: domainList,
    bridges,
    isConnected: visited.size === domains.size,
  };
}
