/**
 * Policy Manifest — signed metadata describing a recursive MAST policy.
 *
 * A manifest is the discoverable counterpart to an on-chain policy root.
 * It tells counterparties what actions exist, which roles are required,
 * where to send signing requests, and how to verify the policy's currency.
 *
 * Public manifest — safe to publish openly:
 *   policy identifier, version, available actions, roles, endpoints,
 *   anchor location, root commitments, audit references.
 *
 * Restricted branch package — distributed to authorised parties:
 *   actual KISS VM branch scripts, MMR proofs, parameter schemas,
 *   counterparty instructions, sensitive escalation/recovery rules.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';

export interface PolicyAction {
  /** Action identifier (e.g. "firmware.install", "maintenance.restart"). */
  action: string;
  /** Human-readable description. */
  description: string;
  /** Required input fields and their types. */
  inputs: Record<string, string>;
  /** Roles that MUST sign. */
  requiredRoles: string[];
  /** Roles that MAY sign (e.g. fleet-operator, insurer). */
  optionalRoles?: string[];
  /** The MAST root that executes this action. */
  executionRoot: string;
  /** Where to send signing requests for this action. */
  requestEndpoint: string;
  /** Maximum validity of a signing request in seconds. */
  expirySeconds: number;
}

export interface PolicyRole {
  /** Role identifier (e.g. "oem-release-authority", "vehicle-owner"). */
  role: string;
  /** Human-readable description. */
  description: string;
  /** Current root for this role's subtree. */
  currentRoot: string;
  /** How to discover the current signer for this role. */
  discoveryEndpoint?: string;
  /** Whether this role is managed by an independent policy subtree. */
  federated: boolean;
  /** Whether this role persists across policy epochs. */
  persistent: boolean;
}

export interface PolicyEndpoint {
  /** Endpoint identifier. */
  id: string;
  /** Transport type. */
  transport: 'hyperswarm' | 'websocket' | 'mqtt' | 'http' | 'custom';
  /** Connection string or topic. */
  address: string;
  /** Purpose of this endpoint. */
  purpose: 'signing' | 'discovery' | 'announcement' | 'audit' | 'recovery';
}

export interface RecursiveMastPolicyManifest {
  /** Unique policy identifier. */
  policyId: string;
  /** The Merkle root of the policy's MAST script tree. */
  policyRoot: string;
  /** The address of the Policy Anchor Coin. */
  anchorAddress: string;
  /** The coin ID of the Policy Anchor Coin (if on-chain). */
  anchorCoinId?: string;
  /** Policy version number. */
  version: number;
  /** Current policy epoch. */
  epoch: number;
  /** Policy status. */
  status: 'draft' | 'active' | 'superseded' | 'revoked';

  /** The subject being governed. */
  subject: {
    type: 'vehicle' | 'machine' | 'device' | 'site' | 'fleet' | 'building';
    id: string;
  };

  /** Available actions. */
  actions: PolicyAction[];
  /** Roles defined in this policy. */
  roles: PolicyRole[];
  /** Communication endpoints. */
  endpoints: PolicyEndpoint[];

  /** SHA3-256 of the complete policy package (scripts + proofs + metadata). */
  policyPackageHash: string;
  /** Previous version's policyId (for chain verification). */
  previousVersion?: string;
  /** Next version's policyId (if superseded). */
  successorVersion?: string;

  /** Block height from which this policy is valid. */
  validFrom: number;
  /** Block height at which this policy expires (optional). */
  expiresAt?: number;

  /** Signature by the policy's institutional authority. */
  authoritySignature?: string;
  /** The public key digest that signed the manifest. */
  authorityPkd?: string;
  /** Timestamp of signing. */
  signedAt?: number;
}

export interface RestrictedBranchPackage {
  /** The policy ID this branch package belongs to. */
  policyId: string;
  /** The branch's script hash. */
  branchHash: string;
  /** The KISS VM branch script. */
  script: string;
  /** MMR proof that this branch is in the policy root. */
  mmrProof: string;
  /** Parameter schema for the branch. */
  parameterSchema: Record<string, string>;
  /** Instructions for the counterparty. */
  counterpartyInstructions: string;
  /** Encrypted content (optional, for sensitive branches). */
  encryptedContent?: Uint8Array;
  /** Encryption key fingerprint (if encrypted). */
  encryptionKeyFingerprint?: string;
  /** Recipient public key digests. */
  recipientPkds: string[];
}

/**
 * Compute the policy package hash — SHA3-256 of all scripts + proofs + metadata.
 */
export function computePolicyPackageHash(
  scripts: string[],
  proofs: string[],
  metadata: string,
): string {
  const combined = scripts.join('\n') + proofs.join('\n') + metadata;
  return bytesToHex(sha3_256(new TextEncoder().encode(combined)));
}

/**
 * Sign a policy manifest with the authority's key.
 */
export async function signPolicyManifest(
  manifest: Omit<RecursiveMastPolicyManifest, 'authoritySignature' | 'authorityPkd' | 'signedAt'>,
  signFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  authorityPkd: string,
): Promise<RecursiveMastPolicyManifest> {
  const unsigned = { ...manifest, authoritySignature: undefined, authorityPkd: undefined, signedAt: undefined };
  const canonical = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  const sigResult = await signFn(new TextEncoder().encode(canonical));
  const sigBytes = sigResult instanceof Uint8Array ? sigResult : sigResult;
  const signed = {
    ...manifest,
    authoritySignature: bytesToHex(sigBytes),
    authorityPkd,
    signedAt: Date.now(),
  };
  return signed;
}

/**
 * Split a policy manifest into public and restricted components.
 */
export function splitPolicyManifest(
  manifest: RecursiveMastPolicyManifest,
  branchHashes: string[],
): { public_: RecursiveMastPolicyManifest; restricted: string[] } {
  const public_ = { ...manifest };
  public_.actions = public_.actions.filter(a => !branchHashes.includes(a.executionRoot));
  return { public_, restricted: branchHashes };
}