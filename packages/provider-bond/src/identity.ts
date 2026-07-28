import type {
  ProviderBondManifest,
  ProviderBondVerifyResult,
  BindProviderManifestToIdentityParams,
  VerifyProviderManifestIdentityParams,
  VerifyProviderBondAddressesParams,
  AssertProviderControlsAddressParams,
} from './types.js';

function isIdentityGraph(value: unknown): value is {
  document: { rootAddress: string; controllerAddress: string };
  claims: Array<{
    claim: { type: string; issuer: string; subject: string; object: string };
    proof: { address: string };
  }>;
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

export function bindProviderManifestToIdentity(params: BindProviderManifestToIdentityParams): unknown {
  return {
    manifestId: params.manifest.edgeServiceManifestId,
    identityGraph: params.identityGraph,
    bound: true,
  };
}

export function verifyProviderManifestIdentity(params: VerifyProviderManifestIdentityParams): ProviderBondVerifyResult {
  const { manifest, identityGraph } = params;

  if (!isIdentityGraph(identityGraph)) {
    return { ok: false, reason: 'Invalid identity graph', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  const signerAddress = manifest.signedEdgeService?.authorAddress;
  if (!signerAddress) {
    return { ok: false, reason: 'No signer address in manifest', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  const authorised = getAuthorisedAddresses(identityGraph);
  if (!authorised.includes(signerAddress)) {
    return { ok: false, reason: 'Manifest signer is not authorised by identity', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  return { ok: true, code: 'OK' };
}

export function verifyProviderBondAddresses(params: VerifyProviderBondAddressesParams): ProviderBondVerifyResult {
  const { manifest, identityGraph } = params;

  if (!isIdentityGraph(identityGraph)) {
    return { ok: false, reason: 'Invalid identity graph', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  const authorised = getAuthorisedAddresses(identityGraph);
  const pb = manifest.providerBond;

  const checks: Array<{ address: string | undefined; code: string; label: string }> = [
    { address: pb.bondOwnerAddress, code: 'BOND_OWNER_NOT_AUTHORISED', label: 'bond owner' },
    { address: pb.bondRecoveryAddress, code: 'BOND_RECOVERY_NOT_AUTHORISED', label: 'bond recovery' },
    { address: pb.probeSignerAddress, code: 'PROBE_SIGNER_NOT_AUTHORISED', label: 'probe signer' },
    { address: pb.incidentSignerAddress, code: 'INCIDENT_SIGNER_NOT_AUTHORISED', label: 'incident signer' },
    { address: pb.scoreSignerAddress, code: 'SCORE_SIGNER_NOT_AUTHORISED', label: 'score signer' },
  ];

  for (const check of checks) {
    if (check.address && !authorised.includes(check.address)) {
      return {
        ok: false,
        reason: `${check.label} address is not authorised by identity`,
        code: check.code,
      };
    }
  }

  return { ok: true, code: 'OK' };
}

export function assertProviderControlsAddress(params: AssertProviderControlsAddressParams): ProviderBondVerifyResult {
  const { manifest, address, identityGraph } = params;

  if (!isIdentityGraph(identityGraph)) {
    return { ok: false, reason: 'Invalid identity graph', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  const authorised = getAuthorisedAddresses(identityGraph);
  if (!authorised.includes(address)) {
    return { ok: false, reason: 'Address is not authorised by identity', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  return { ok: true, code: 'OK' };
}
