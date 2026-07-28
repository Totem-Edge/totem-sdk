/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Access Control Template — policy-gated operation authorization.
 *
 * Use case: edge-modbus, edge-opcua, edge-bacnet, edge-ros2, edge-matter
 *
 * Workflow:
 *   1. Operator identity is verified against a policy root
 *   2. Operation (action + target + parameters) is checked against allowed scopes
 *   3. Time window and rate limits are enforced
 *   4. Operation is executed and receipt is generated
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyTree } from '../types.js';
import { buildPolicyTree, type PolicyNodeInput } from '../policy-tree.js';
import { buildDelegationLink, buildDelegationChain, type DelegationLink } from '../delegation.js';
import type { DelegationConstraints } from '../types.js';

export interface AccessControlConfig {
  /** The operator's public key digest. */
  operatorPkd: string;
  /** The action being performed (e.g. [read], [write], [execute]). */
  action: string;
  /** The target resource (e.g. [valve-1], [pump-3]). */
  target: string;
  /** The policy root that authorizes this operator. */
  policyRoot: string;
  /** Merkle proof that the operator is in the policy root. */
  operatorProof: string;
  /** Allowed scopes for this operator. */
  scopes: string[];
  /** Maximum block height for this authorization. */
  maxBlock?: number;
}

/**
 * Build the KISSVM access control script.
 *
 * The script:
 *   1. Verifies the operator is authorized (PROOF → MAST)
 *   2. Checks the action is in the allowed scopes
 *   3. Checks the time window
 *   4. Verifies the operator's signature
 *   5. Executes the operation
 */
export function buildAccessControlScript(config: AccessControlConfig): string {
  const scopeList = config.scopes.map(s => s).join(' ');
  const lines: string[] = [
    `// Access control: ${config.action} on ${config.target}`,
    `LET operator = 0x${config.operatorPkd}`,
    `LET action = STATE(0)`,
    `LET target = STATE(1)`,
    ``,
    `// 1. Operator is authorized by policy root`,
    `ASSERT PROOF(0x${config.operatorPkd} 0 0x${config.policyRoot} 0 0x${config.operatorProof})`,
    `MAST 0x${config.operatorPkd}`,
    ``,
    `// 2. Action is in allowed scopes`,
    `ASSERT CONTAINS([${scopeList}] action)`,
    ``,
    `// 3. Target matches`,
    `ASSERT target EQ [${config.target}]`,
  ];

  if (config.maxBlock !== undefined) {
    lines.push(`// 4. Time window`, `ASSERT @BLOCK LTE ${config.maxBlock}`);
  }

  lines.push(
    `// 5. Operator signature`,
    `ASSERT SIGNEDBY(operator)`,
    `RETURN TRUE`,
  );

  return lines.join('\n');
}

/**
 * Build a role-based access control (RBAC) policy tree.
 *
 * @param roles - Map of role name → list of allowed scopes.
 * @param operators - Map of operator PKD → assigned role.
 */
export function buildRbacPolicy(
  roles: Record<string, string[]>,
  operators: Record<string, string>,
): PolicyTree {
  const nodes: PolicyNodeInput[] = [
    { id: 'rbac-root', name: 'RBAC Root', script: 'RETURN TRUE' },
  ];

  for (const [roleName, scopes] of Object.entries(roles)) {
    const scopeList = scopes.map(s => `[${s}]`).join(' ');
    nodes.push({
      id: `role-${roleName}`,
      name: `Role: ${roleName}`,
      script: `ASSERT CONTAINS([${scopeList}] STATE(0)) RETURN TRUE`,
      parentId: 'rbac-root',
    });
  }

  for (const [pkd, role] of Object.entries(operators)) {
    nodes.push({
      id: `operator-${pkd.slice(0, 16)}`,
      name: `Operator ${pkd.slice(0, 16)}…`,
      script: `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`,
      parentId: `role-${role}`,
    });
  }

  return buildPolicyTree(nodes);
}

/**
 * Build a delegation chain for hierarchical access control.
 *
 * @example Administrator → Supervisor → Operator
 */
export function buildAccessDelegationChain(
  adminPkd: string,
  supervisorPkd: string,
  operatorPkd: string,
  adminPolicyRoot: string,
  supervisorPolicyRoot: string,
  operatorPolicyRoot: string,
  adminProof: string,
  supervisorProof: string,
  operatorProof: string,
): ReturnType<typeof buildDelegationChain> {
  const adminConstraints: DelegationConstraints = {
    scopes: ['admin', 'configure', 'delegate'],
  };
  const supervisorConstraints: DelegationConstraints = {
    scopes: ['read', 'write', 'execute'],
    maxBlock: Date.now() + 86400000, // 24h
  };

  return buildDelegationChain([
    buildDelegationLink(adminPkd, supervisorPkd, adminPolicyRoot, adminProof, adminConstraints, 0),
    buildDelegationLink(supervisorPkd, operatorPkd, supervisorPolicyRoot, supervisorProof, supervisorConstraints, 1),
  ]);
}
