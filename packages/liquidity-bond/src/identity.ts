import type {
  LiquidityBondVerifyResult,
  LiquidityPoolManifest,
  LiquidityCommitment,
  LiquidityReceipt,
  VerifyPoolOperatorIdentityParams,
  VerifyLpIdentityParams,
  VerifyReceiptOwnerIdentityParams,
} from './types.js';

function isIdentityGraph(value: unknown): value is {
  document: { rootAddress: string; controllerAddress: string };
  claims: Array<{ claim: { type: string; issuer: string; subject: string; object: string }; proof: { address: string } }>;
} {
  if (!value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  return typeof g.document === 'object' && g.document !== null && Array.isArray(g.claims);
}

function getAuthorisedAddresses(identityGraph: unknown): string[] {
  if (!isIdentityGraph(identityGraph)) return [];
  const addresses = new Set<string>();
  const doc = identityGraph.document;
  if (doc.rootAddress) addresses.add(doc.rootAddress);
  if (doc.controllerAddress) addresses.add(doc.controllerAddress);
  for (const c of identityGraph.claims) {
    if (c.claim.type === 'delegates_to' && c.proof?.address) {
      addresses.add(c.proof.address);
    }
  }
  return Array.from(addresses);
}

export function verifyPoolOperatorIdentity(params: VerifyPoolOperatorIdentityParams): LiquidityBondVerifyResult {
  const { manifest, identityGraph } = params;
  if (!isIdentityGraph(identityGraph)) {
    return { ok: false, reason: 'Invalid identity graph', code: 'POOL_IDENTITY_NOT_AUTHORISED' };
  }
  if (!manifest.operatorAddress) {
    return { ok: true, code: 'OK' };
  }
  const authorised = getAuthorisedAddresses(identityGraph);
  if (!authorised.includes(manifest.operatorAddress)) {
    return { ok: false, reason: 'Pool operator is not authorised by identity', code: 'POOL_IDENTITY_NOT_AUTHORISED' };
  }
  return { ok: true, code: 'OK' };
}

export function verifyLpIdentity(params: VerifyLpIdentityParams): LiquidityBondVerifyResult {
  const { commitment, identityGraph } = params;
  if (!isIdentityGraph(identityGraph)) {
    return { ok: false, reason: 'Invalid identity graph', code: 'LP_IDENTITY_NOT_AUTHORISED' };
  }
  const authorised = getAuthorisedAddresses(identityGraph);
  if (!authorised.includes(commitment.lpAddress)) {
    return { ok: false, reason: 'LP address is not authorised by identity', code: 'LP_IDENTITY_NOT_AUTHORISED' };
  }
  return { ok: true, code: 'OK' };
}

export function verifyReceiptOwnerIdentity(params: VerifyReceiptOwnerIdentityParams): LiquidityBondVerifyResult {
  const { receipt, identityGraph } = params;
  if (!isIdentityGraph(identityGraph)) {
    return { ok: false, reason: 'Invalid identity graph', code: 'RECEIPT_OWNER_NOT_AUTHORISED' };
  }
  const authorised = getAuthorisedAddresses(identityGraph);
  if (!authorised.includes(receipt.ownerAddress)) {
    return { ok: false, reason: 'Receipt owner is not authorised by identity', code: 'RECEIPT_OWNER_NOT_AUTHORISED' };
  }
  return { ok: true, code: 'OK' };
}
