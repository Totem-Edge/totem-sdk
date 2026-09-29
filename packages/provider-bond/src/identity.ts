import { resolveIdentityGraph } from '@totemsdk/identity';
import type { IdentityGraph } from '@totemsdk/identity';
import { verifyManifest } from '@totemsdk/manifest';
import type {
  ProviderBondManifest,
  ProviderBondVerifyResult,
  BindProviderManifestToIdentityParams,
  VerifyProviderManifestIdentityParams,
  VerifyProviderBondAddressesParams,
  AssertProviderControlsAddressParams,
} from './types.js';

interface AuthorisedIdentity {
  rootAddress: string;
  controllerAddress: string;
  /** root/controller + delegates with manifest:sign or * scope. */
  authorised: string[];
  /** root/controller + any signature-verified delegate. */
  controlled: string[];
}

type ResolveResult = { ok: true; identity: AuthorisedIdentity } | { ok: false; reason: string };

/**
 * RFC-020 C4: never trust an attacker-supplied identity graph. Claims are
 * signature-verified through `@totemsdk/identity`'s resolver, and a non-active
 * identity (revoked/rotated) is rejected.
 */
function resolveAuthorised(identityGraph: unknown): ResolveResult {
  if (!identityGraph || typeof identityGraph !== 'object') {
    return { ok: false, reason: 'Invalid identity graph' };
  }
  try {
    const { resolved } = resolveIdentityGraph(identityGraph as IdentityGraph);
    if (!resolved) return { ok: false, reason: 'Identity graph could not be resolved' };
    if (resolved.status !== 'active') {
      return { ok: false, reason: `Identity is ${resolved.status}` };
    }
    return {
      ok: true,
      identity: {
        rootAddress: resolved.rootAddress,
        controllerAddress: resolved.controllerAddress,
        authorised: [resolved.rootAddress, resolved.controllerAddress, ...resolved.authorizedAddresses],
        controlled: [resolved.rootAddress, resolved.controllerAddress, ...resolved.controlledAddresses],
      },
    };
  } catch (err) {
    return { ok: false, reason: `Identity graph failed to resolve: ${(err as Error).message}` };
  }
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

  const auth = resolveAuthorised(identityGraph);
  if (!auth.ok) {
    return { ok: false, reason: auth.reason, code: 'IDENTITY_NOT_AUTHORISED' };
  }

  const signed = manifest.signedEdgeService;
  if (!signed) {
    return { ok: false, reason: 'No signed edge-service manifest', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  // RFC-020 C4: cryptographically verify the manifest signature, then require
  // the verified signer to be an authorized manifest signer.
  const verify = verifyManifest(signed);
  if (!verify.valid) {
    return { ok: false, reason: `Manifest signature invalid: ${verify.reason ?? 'unknown'}`, code: 'BOND_PROOF_INVALID' };
  }

  if (!auth.identity.authorised.includes(signed.authorAddress)) {
    return { ok: false, reason: 'Manifest signer is not authorised by identity', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  return { ok: true, code: 'OK' };
}

export function verifyProviderBondAddresses(params: VerifyProviderBondAddressesParams): ProviderBondVerifyResult {
  const { manifest, identityGraph } = params;

  const auth = resolveAuthorised(identityGraph);
  if (!auth.ok) {
    return { ok: false, reason: auth.reason, code: 'IDENTITY_NOT_AUTHORISED' };
  }

  const controlled = auth.identity.controlled;
  const pb = manifest.providerBond;

  const checks: Array<{ address: string | undefined; code: string; label: string }> = [
    { address: pb.bondOwnerAddress, code: 'BOND_OWNER_NOT_AUTHORISED', label: 'bond owner' },
    { address: pb.bondRecoveryAddress, code: 'BOND_RECOVERY_NOT_AUTHORISED', label: 'bond recovery' },
    { address: pb.probeSignerAddress, code: 'PROBE_SIGNER_NOT_AUTHORISED', label: 'probe signer' },
    { address: pb.incidentSignerAddress, code: 'INCIDENT_SIGNER_NOT_AUTHORISED', label: 'incident signer' },
    { address: pb.scoreSignerAddress, code: 'SCORE_SIGNER_NOT_AUTHORISED', label: 'score signer' },
  ];

  for (const check of checks) {
    if (check.address && !controlled.includes(check.address)) {
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
  const { address, identityGraph } = params;

  const auth = resolveAuthorised(identityGraph);
  if (!auth.ok) {
    return { ok: false, reason: auth.reason, code: 'IDENTITY_NOT_AUTHORISED' };
  }

  if (!auth.identity.controlled.includes(address)) {
    return { ok: false, reason: 'Address is not authorised by identity', code: 'IDENTITY_NOT_AUTHORISED' };
  }

  return { ok: true, code: 'OK' };
}
