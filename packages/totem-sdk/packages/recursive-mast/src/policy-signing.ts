/**
 * Policy Signing Coordination — signing request/response envelopes and
 * witness assembly for recursive MAST policy execution.
 *
 * The coordinator is not trusted — it merely assembles data. Every signer
 * independently verifies the transaction before signing, so the coordinator
 * cannot silently change the firmware hash, outputs or policy path.
 *
 * Workflow:
 *   1. Coordinator creates a PolicySigningRequest for each required role
 *   2. Each signer independently verifies the request and signs
 *   3. Coordinator collects responses via collectSigningResponses()
 *   4. Coordinator builds the witness plan via buildRecursiveWitnessPlan()
 *   5. The witness is materialized via @totemsdk/recursive-mast/kissvm
 */

import { sha3_256, bytesToHex, hexToBytes } from '@totemsdk/core';
import type { PolicyAction, PolicyRole } from './policy-manifest.js';

// ─── Request / Response ────────────────────────────────────────────────────

export interface PolicyPathDescriptor {
  /** Ordered chain of policy roots from anchor to action. */
  roots: string[];
  /** The action being executed. */
  action: string;
  /** The executing MAST root. */
  executionRoot: string;
}

export interface ScriptDisclosure {
  /** The script hash. */
  scriptHash: string;
  /** The KISS VM script text. */
  script: string;
  /** MMR proof that this script is in the policy root. */
  mmrProof: string;
}

export interface SignedEvidence {
  /** Evidence identifier. */
  evidenceId: string;
  /** Type of evidence (e.g. "credential", "work-order", "calibration"). */
  type: string;
  /** The evidence data. */
  data: string;
  /** The signer's public key digest. */
  signerPkd: string;
  /** Signature over the evidence. */
  signature: string;
}

export interface SignedIdentityClaim {
  /** The identity document ID. */
  identityId: string;
  /** The claimed identity (e.g. "did:totem:..."). */
  identity: string;
  /** The issuer's public key digest. */
  issuerPkd: string;
  /** The issuer's signature. */
  issuerSignature: string;
  /** The subject's public key digest. */
  subjectPkd: string;
  /** The subject's signature. */
  subjectSignature: string;
}

export interface ExpectedInput {
  /** Coin ID. */
  coinId: string;
  /** Required address. */
  address?: string;
  /** Required amount. */
  amount?: string;
  /** Required token ID. */
  tokenId?: string;
}

export interface ExpectedOutput {
  /** Recipient address. */
  address: string;
  /** Output amount. */
  amount: string;
  /** Token ID. */
  tokenId?: string;
  /** State variables to set. */
  state?: Record<number, string>;
}

export interface PolicySigningRequest {
  /** Unique request identifier. */
  requestId: string;
  /** The policy manifest ID. */
  policyId: string;
  /** Policy version. */
  policyVersion: number;
  /** Current policy epoch. */
  policyEpoch: number;

  /** The action being executed. */
  action: string;
  /** The subject being acted upon. */
  subjectId: string;
  /** The role being requested to sign. */
  requestedRole: string;

  /** The canonical transaction digest to sign. */
  transactionDigest: string;
  /** The transaction template (serialised Minima TX). */
  transactionTemplate: Uint8Array;

  /** The policy path from anchor to action. */
  selectedPath: PolicyPathDescriptor;
  /** Disclosed scripts for verification. */
  disclosedScripts: ScriptDisclosure[];
  /** Supporting evidence. */
  evidence: SignedEvidence[];

  /** Expected inputs. */
  expectedInputs: ExpectedInput[];
  /** Expected outputs. */
  expectedOutputs: ExpectedOutput[];

  /** When the request was created. */
  requestedAt: number;
  /** When the request expires. */
  expiresAt: number;
  /** Where to send the response. */
  replyEndpoint: string;

  /** The requester's identity claim. */
  requesterIdentity: SignedIdentityClaim;
  /** The requester's signature over the request. */
  requesterSignature: string;
}

export interface PolicySigningResponse {
  requestId: string;
  responseId: string;
  status: 'approved' | 'rejected' | 'needs-information';
  signerIdentityId: string;
  actingAddress: string;
  role: string;
  signature?: string;
  identityProof?: SignedIdentityClaim;
  approvalEvidence?: string;
  reason?: string;
  signedAt: number;
}

// ─── Request creation ──────────────────────────────────────────────────────

export interface CreateSigningRequestConfig {
  policyId: string;
  policyVersion: number;
  policyEpoch: number;
  action: string;
  subjectId: string;
  requestedRole: string;
  transactionDigest: string;
  transactionTemplate: Uint8Array;
  selectedPath: PolicyPathDescriptor;
  disclosedScripts: ScriptDisclosure[];
  evidence: SignedEvidence[];
  expectedInputs: ExpectedInput[];
  expectedOutputs: ExpectedOutput[];
  replyEndpoint: string;
  requesterIdentity: SignedIdentityClaim;
  expirySeconds?: number;
}

/**
 * Create a canonical signing request.
 */
export async function createSigningRequest(
  config: CreateSigningRequestConfig,
  requesterSignFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
): Promise<PolicySigningRequest> {
  const now = Date.now();
  const request: PolicySigningRequest = {
    requestId: `req-${bytesToHex(sha3_256(new TextEncoder().encode(`${now}-${config.policyId}-${config.action}`))).slice(0, 16)}`,
    policyId: config.policyId,
    policyVersion: config.policyVersion,
    policyEpoch: config.policyEpoch,
    action: config.action,
    subjectId: config.subjectId,
    requestedRole: config.requestedRole,
    transactionDigest: config.transactionDigest,
    transactionTemplate: config.transactionTemplate,
    selectedPath: config.selectedPath,
    disclosedScripts: config.disclosedScripts,
    evidence: config.evidence,
    expectedInputs: config.expectedInputs,
    expectedOutputs: config.expectedOutputs,
    requestedAt: now,
    expiresAt: now + (config.expirySeconds ?? 300) * 1000,
    replyEndpoint: config.replyEndpoint,
    requesterIdentity: config.requesterIdentity,
    requesterSignature: '',
  };

  const canonical = canonicalRequest(request);
  const sigResult = await requesterSignFn(new TextEncoder().encode(canonical));
  const sig = sigResult instanceof Uint8Array ? sigResult : sigResult;
  request.requesterSignature = bytesToHex(sig);
  return request;
}

function canonicalRequest(req: PolicySigningRequest): string {
  const templateHash = req.transactionTemplate
    ? bytesToHex(sha3_256(req.transactionTemplate))
    : '';
  const scriptHashes = req.disclosedScripts.map(ds => ds.scriptHash).sort();
  const evidenceHashes = req.evidence.map(e => e.evidenceId).sort();

  const canonical = {
    requestId: req.requestId,
    policyId: req.policyId,
    policyVersion: req.policyVersion,
    policyEpoch: req.policyEpoch,
    action: req.action,
    subjectId: req.subjectId,
    requestedRole: req.requestedRole,
    transactionDigest: req.transactionDigest,
    transactionTemplateHash: templateHash,
    selectedPath: req.selectedPath,
    disclosedScriptHashes: scriptHashes,
    evidenceHashes,
    expectedInputs: req.expectedInputs,
    expectedOutputs: req.expectedOutputs,
    requestedAt: req.requestedAt,
    expiresAt: req.expiresAt,
    replyEndpoint: req.replyEndpoint,
    requesterIdentity: req.requesterIdentity,
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

// ─── Response creation ─────────────────────────────────────────────────────

export interface CreateSigningResponseConfig {
  requestId: string;
  status: 'approved' | 'rejected' | 'needs-information';
  signerIdentityId: string;
  actingAddress: string;
  role: string;
  signature?: string;
  identityProof?: SignedIdentityClaim;
  approvalEvidence?: string;
  reason?: string;
}

export function createSigningResponse(config: CreateSigningResponseConfig): PolicySigningResponse {
  const now = Date.now();
  const responseId = `resp-${bytesToHex(sha3_256(new TextEncoder().encode(
    `${config.requestId}:${config.signerIdentityId}:${config.role}:${config.status}:${now}`
  ))).slice(0, 16)}`;

  return {
    requestId: config.requestId,
    responseId,
    status: config.status,
    signerIdentityId: config.signerIdentityId,
    actingAddress: config.actingAddress,
    role: config.role,
    signature: config.signature,
    identityProof: config.identityProof,
    approvalEvidence: config.approvalEvidence,
    reason: config.reason,
    signedAt: now,
  };
}

// ─── Response collection ───────────────────────────────────────────────────

export interface SigningRoundResult {
  complete: boolean;
  signatures: Record<string, string>;
  approved: PolicySigningResponse[];
  rejected: PolicySigningResponse[];
  needsInfo: PolicySigningResponse[];
  pending: string[];
  errors: string[];
}

export function collectSigningResponses(
  requiredRoles: string[],
  responses: PolicySigningResponse[],
  options?: {
    requestId?: string;
    allowOneSignerMultipleRoles?: boolean;
  },
): SigningRoundResult {
  const signatures: Record<string, string> = {};
  const approved: PolicySigningResponse[] = [];
  const rejected: PolicySigningResponse[] = [];
  const needsInfo: PolicySigningResponse[] = [];
  const pending: string[] = [];
  const errors: string[] = [];

  const respondedRoles = new Set<string>();
  const signersSeen = new Set<string>();
  const responseKeys = new Set<string>();

  for (const resp of responses) {
    const responseKey = `${resp.requestId}:${resp.signerIdentityId}:${resp.role}`;
    if (responseKeys.has(responseKey)) {
      errors.push(`Duplicate response from ${resp.signerIdentityId} for role ${resp.role}`);
      continue;
    }
    responseKeys.add(responseKey);

    if (options?.requestId && resp.requestId !== options.requestId) {
      errors.push(`Response requestId ${resp.requestId} does not match expected ${options.requestId}`);
      continue;
    }

    if (!options?.allowOneSignerMultipleRoles && signersSeen.has(resp.signerIdentityId)) {
      errors.push(`Signer ${resp.signerIdentityId} already responded for another role`);
      continue;
    }
    signersSeen.add(resp.signerIdentityId);

    respondedRoles.add(resp.role);

    if (resp.status === 'approved' && resp.signature) {
      signatures[resp.role] = resp.signature;
      approved.push(resp);
    } else if (resp.status === 'rejected') {
      rejected.push(resp);
    } else {
      needsInfo.push(resp);
    }
  }

  for (const role of requiredRoles) {
    if (!respondedRoles.has(role)) {
      pending.push(role);
    }
  }

  if (rejected.length > 0) {
    errors.push(`${rejected.length} response(s) rejected`);
  }

  return {
    complete: Object.keys(signatures).length >= requiredRoles.length && errors.length === 0,
    signatures,
    approved,
    rejected,
    needsInfo,
    pending,
    errors,
  };
}

// ─── Witness assembly ──────────────────────────────────────────────────────

/**
 * Build a recursive MAST witness plan from collected signatures and
 * disclosed scripts. The plan describes what the witness should contain;
 * use materializeRecursiveWitness() from @totemsdk/recursive-mast/kissvm
 * to produce the canonical KISSVM ScriptWitness.
 *
 * @param selectedPath - The policy path from anchor to action.
 * @param disclosedScripts - The disclosed MAST branch scripts.
 * @param collectedSignatures - Signatures by role.
 * @returns A witness plan (mastBranches + signatures) ready for materialization.
 */
export function buildRecursiveWitnessPlan(
  selectedPath: PolicyPathDescriptor,
  disclosedScripts: ScriptDisclosure[],
  collectedSignatures: Map<string, string>,
): { mastBranches: Map<string, string>; signatures: Map<string, string> } {
  const mastBranches = new Map<string, string>();
  for (const ds of disclosedScripts) {
    mastBranches.set(ds.scriptHash, ds.script);
  }

  return { mastBranches, signatures: collectedSignatures };
}

/**
 * Verify a signing request before signing it.
 *
 * A signer's software should:
 *   1. Resolve the current policy manifest.
 *   2. Check the anchor coin and current policy epoch.
 *   3. Verify that the supplied branch belongs to the correct root.
 *   4. Simulate the transaction.
 *   5. Inspect expected outputs and state changes.
 *   6. Verify the firmware or action manifest.
 *   7. Confirm that the request genuinely requires their role.
 *
 * @returns { valid, reason } — whether the request passes verification.
 */
export interface SigningRequestVerificationOptions {
  currentEpoch: number;
  trustRequester: boolean;
  now?: number;
  anchorCoin?: {
    coinId: string;
    policyRoot: string;
    epoch: number;
    manifestHash: string;
  };
  policyManifest?: {
    policyRoot: string;
    version: number;
    epoch: number;
    actions: Array<{ action: string; requiredRoles: string[] }>;
  };
  branchVerifier?: (scriptHash: string, policyRoot: string) => boolean;
  replayStore?: {
    hasBeenProcessed(requestId: string): boolean;
    markProcessed(requestId: string): void;
  };
  currentBlock?: number;
  transactionDigestVerifier?: (template: Uint8Array, digest: string) => boolean;
}

export interface SigningRequestVerificationReport {
  valid: boolean;
  checks: {
    notExpired: boolean;
    epochCurrent: boolean;
    requesterTrusted: boolean;
    digestPresent: boolean;
    digestMatchesTemplate?: boolean;
    scriptsBelongToRoots?: boolean;
    pathStartsAtAnchor?: boolean;
    roleRequired?: boolean;
    outputsMatch?: boolean;
    notReplayed?: boolean;
  };
  errors: string[];
}

export function verifySigningRequest(
  request: PolicySigningRequest,
  options: SigningRequestVerificationOptions,
): SigningRequestVerificationReport {
  const errors: string[] = [];
  const checks: SigningRequestVerificationReport['checks'] = {
    notExpired: true,
    epochCurrent: true,
    requesterTrusted: true,
    digestPresent: true,
  };

  if (options.now && options.now > request.expiresAt) {
    checks.notExpired = false;
    errors.push('Request has expired');
  }

  if (request.policyEpoch < options.currentEpoch) {
    checks.epochCurrent = false;
    errors.push(`Policy epoch ${request.policyEpoch} is behind current epoch ${options.currentEpoch}`);
  }

  if (!options.trustRequester) {
    checks.requesterTrusted = false;
    errors.push('Requester identity not trusted');
  }

  if (!request.transactionDigest || request.transactionDigest.length === 0) {
    checks.digestPresent = false;
    errors.push('Missing transaction digest');
  }

  if (options.transactionDigestVerifier && request.transactionTemplate && request.transactionDigest) {
    const digestMatches = options.transactionDigestVerifier(
      request.transactionTemplate,
      request.transactionDigest,
    );
    checks.digestMatchesTemplate = digestMatches;
    if (!digestMatches) {
      errors.push('Transaction digest does not match transaction template');
    }
  }

  if (options.anchorCoin) {
    if (request.policyEpoch !== options.anchorCoin.epoch) {
      checks.epochCurrent = false;
      errors.push(`Policy epoch ${request.policyEpoch} does not match anchor coin epoch ${options.anchorCoin.epoch}`);
    }
  }

  if (options.policyManifest) {
    const action = options.policyManifest.actions.find(a => a.action === request.action);
    if (action && !action.requiredRoles.includes(request.requestedRole)) {
      checks.roleRequired = false;
      errors.push(`Role "${request.requestedRole}" is not required for action "${request.action}"`);
    } else {
      checks.roleRequired = true;
    }
  }

  if (options.branchVerifier) {
    const allScriptsValid = request.disclosedScripts.every(ds =>
      options.branchVerifier!(ds.scriptHash, request.selectedPath.executionRoot),
    );
    checks.scriptsBelongToRoots = allScriptsValid;
    if (!allScriptsValid) {
      errors.push('One or more disclosed scripts do not belong to the stated roots');
    }
  }

  if (options.replayStore) {
    const replayed = options.replayStore.hasBeenProcessed(request.requestId);
    checks.notReplayed = !replayed;
    if (replayed) {
      errors.push('Request has already been processed');
    }
  }

  return {
    valid: errors.length === 0,
    checks,
    errors,
  };
}