/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Identity Verification Template — verifiable credential verification pipeline.
 *
 * Use case: identity, proof, authority, agent-policy
 *
 * Workflow:
 *   1. Identity document is verified against issuer policy
 *   2. Document is checked for revocation
 *   3. Claims are extracted and verified
 *   4. Cross-domain trust bridge validates foreign credentials
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyTree } from '../types.js';
import { buildPolicyTree, type PolicyNodeInput } from '../policy-tree.js';
import { buildCrossDomainBridge, type CrossDomainBridge } from '../cross-domain.js';
import type { CrossDomainConstraints } from '../types.js';

export interface IdentityVerificationConfig {
  /** The identity document ID. */
  documentId: string;
  /** The issuer's public key digest. */
  issuerPkd: string;
  /** The subject's public key digest. */
  subjectPkd: string;
  /** The policy root that authorizes the issuer. */
  issuerPolicyRoot: string;
  /** Merkle proof that the issuer is in the policy root. */
  issuerProof: string;
  /** State port tracking revocation (0 = valid, non-zero = revoked). */
  revocationPort: number;
  /** Claims to verify. */
  claims: Record<string, string>;
}

/**
 * Build the KISSVM identity verification script.
 *
 * The script:
 *   1. Verifies the issuer is authorized (PROOF → MAST)
 *   2. Verifies the document is not revoked
 *   3. Verifies the issuer's signature over the claims
 *   4. Extracts and validates specific claims
 */
export function buildIdentityVerificationScript(config: IdentityVerificationConfig): string {
  const claimChecks = Object.entries(config.claims).map(([key, value]) =>
    `ASSERT STATE(${key}) EQ [${value}]`,
  );

  return [
    `// Identity verification: ${config.documentId}`,
    `LET issuer = 0x${config.issuerPkd}`,
    `LET subject = 0x${config.subjectPkd}`,
    ``,
    `// 1. Issuer is authorized`,
    `ASSERT PROOF(0x${config.issuerPkd} 0 0x${config.issuerPolicyRoot} 0 0x${config.issuerProof})`,
    `MAST 0x${config.issuerPkd}`,
    ``,
    `// 2. Document is not revoked (state continuity)`,
    `ASSERT PREVSTATE(${config.revocationPort}) EQ 0`,
    ``,
    `// 3. Issuer signature over claims`,
    `ASSERT SIGNEDBY(issuer)`,
    ``,
    `// 4. Claim verification`,
    ...claimChecks,
    ``,
    `RETURN TRUE`,
  ].join('\n');
}

/**
 * Build an identity issuer policy tree.
 *
 * @param issuers - List of authorized issuer public key digests.
 * @param rootName - Human-readable root name.
 */
export function buildIssuerPolicy(issuers: string[], rootName: string): PolicyTree {
  const nodes: PolicyNodeInput[] = [
    { id: 'issuer-root', name: rootName, script: 'RETURN TRUE' },
  ];

  for (let i = 0; i < issuers.length; i++) {
    nodes.push({
      id: `issuer-${i}`,
      name: `Issuer ${i}`,
      script: `ASSERT SIGNEDBY(0x${issuers[i]}) RETURN TRUE`,
      parentId: 'issuer-root',
    });
  }

  return buildPolicyTree(nodes);
}

/**
 * Build a cross-domain identity trust bridge.
 * Accepts identity documents from a foreign domain's issuer policy.
 */
export function buildIdentityTrustBridge(
  localDomain: string,
  foreignDomain: string,
  localPolicyRoot: string,
  foreignIssuerRoot: string,
  acceptanceProof: string,
  constraints: CrossDomainConstraints = {},
): CrossDomainBridge {
  return buildCrossDomainBridge(
    localDomain,
    foreignDomain,
    localPolicyRoot,
    foreignIssuerRoot,
    acceptanceProof,
    {
      maxDepth: 3,
      requiredAttributes: ['name', 'jurisdiction'],
      ...constraints,
    },
  );
}
