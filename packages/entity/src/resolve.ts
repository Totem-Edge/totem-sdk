/**
 * Entity resolution (RFC-056 §4.3).
 *
 * Composes local, already-verifiable sources into one resolution with explicit
 * `known` / `unknown` / `invalid` section states. Absence of a source is
 * `unknown`, never `invalid`.
 */
import {
  resolveIdentityGraph,
  verifyManifestIdentity,
} from '@totemsdk/identity';
import type {
  IdentityGraph,
  ManifestIdentityBinding,
  ResolvedIdentity,
} from '@totemsdk/identity';

import type {
  EntityAuthorityGrant,
  EntityChildProofView,
  EntityManifestBindingView,
  EntityResolution,
  EntityResolverOptions,
  EntitySectionState,
  EntitySources,
} from './types.js';
import { ENTITY_RESOLUTION_VERSION, ENTITY_SECTIONS } from './types.js';
import { assertEntityResolverOptions, assertEntitySources } from './validate.js';

function isSafeTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function checkAuthorityGrant(
  grant: EntityAuthorityGrant,
  identity: IdentityGraph,
  asOf: number,
): string | null {
  const subjectOk =
    grant.subject === identity.document.id ||
    grant.subject === identity.document.rootAddress ||
    grant.subject === identity.document.controllerAddress;

  if (grant.verified !== true || grant.verifiedBy !== 'authority') {
    return `authority grant ${String(grant.id)} is not verified by @totemsdk/authority`;
  }
  if (
    !isNonEmptyString(grant.id) ||
    !isNonEmptyString(grant.issuer) ||
    !isNonEmptyString(grant.subject) ||
    !isNonEmptyString(grant.proofId)
  ) {
    return 'authority grant has empty identity fields';
  }
  if (
    !Array.isArray(grant.capabilities) ||
    grant.capabilities.length === 0 ||
    !grant.capabilities.every(isNonEmptyString)
  ) {
    return `authority grant ${grant.id} has invalid capabilities`;
  }
  if (!isSafeTime(grant.validFrom)) {
    return `authority grant ${grant.id} has invalid validFrom`;
  }
  if (grant.expiresAt !== undefined && !isSafeTime(grant.expiresAt)) {
    return `authority grant ${grant.id} has invalid expiresAt`;
  }
  if (grant.expiresAt !== undefined && grant.expiresAt < grant.validFrom) {
    return `authority grant ${grant.id} expires before it starts`;
  }
  if (!subjectOk) {
    return `authority grant ${grant.id} subject does not match the entity`;
  }
  if (grant.validFrom > asOf) {
    return `authority grant ${grant.id} is not valid yet at asOf ${asOf}`;
  }
  if (grant.expiresAt !== undefined && asOf > grant.expiresAt) {
    return `authority grant ${grant.id} expired at ${grant.expiresAt}`;
  }
  return null;
}

function uniqueAddresses(addresses: readonly unknown[]): string[] {
  return [...new Set(addresses.filter(isNonEmptyString))];
}

/**
 * Resolve an entity from local sources at an explicit time.
 *
 * Never fetches the network, signs, or grants authority. The optional
 * `proofVerifier` should be a root-identity verifier; root ancestry is evidence
 * only and never widens authorization.
 */
export async function resolveEntity(
  sources: EntitySources,
  options: EntityResolverOptions = {},
): Promise<EntityResolution> {
  assertEntitySources(sources);
  assertEntityResolverOptions(options);

  const asOf = options.asOf ?? Date.now();
  const identity = sources.identity;
  const { document } = identity;
  const errors: string[] = [];

  const status: Record<(typeof ENTITY_SECTIONS)[number], EntitySectionState> = {
    root: 'known',
    children: 'unknown',
    identity: 'unknown',
    manifest: 'unknown',
    claims: 'unknown',
    authority: 'unknown',
  };

  const resolution = resolveIdentityGraph(identity, { asOf });
  const resolved: ResolvedIdentity | null = resolution.resolved;
  errors.push(...resolution.errors);

  if (resolved) {
    status.identity = resolved.status === 'revoked' ? 'invalid' : 'known';
    if (resolved.status === 'revoked') {
      errors.push(`identity ${document.id} is revoked at asOf ${asOf}`);
    }

    const verifiedClaims =
      resolved.delegates.length +
      resolved.paymentRecipients.length +
      resolved.serviceEndpoints.length;

    if (resolved.status === 'revoked') {
      status.claims = 'invalid';
    } else if (verifiedClaims > 0) {
      status.claims = 'known';
    } else if (identity.claims.length > 0) {
      status.claims = 'invalid';
      errors.push(`no identity claim passed verification at asOf ${asOf}`);
    } else {
      status.claims = 'unknown';
    }
  } else {
    status.identity = 'invalid';
    status.claims = identity.claims.length > 0 ? 'invalid' : 'unknown';
    errors.push('identity graph could not be resolved');
  }

  let children: EntityChildProofView | null = null;
  let rootProofFailed = false;

  if (sources.rootIdentityProof !== undefined) {
    if (!options.proofVerifier) {
      rootProofFailed = true;
      status.children = 'invalid';
      errors.push('rootIdentityProof supplied without a proof verifier');
    } else {
      try {
        const proofResult = await options.proofVerifier.verify(sources.rootIdentityProof, {
          expectedRootAddress: document.rootAddress,
          expectedAddress: document.controllerAddress,
          purpose: 'identity-resolution',
        });
        if (
          proofResult.valid &&
          proofResult.rootAddress === document.rootAddress
        ) {
          const proven = uniqueAddresses(proofResult.provenAddresses ?? []);
          const proofDigest = (proofResult as unknown as { proofDigest?: unknown }).proofDigest;
          children = {
            rootAddress: document.rootAddress,
            provenAddresses: proven,
            ...(typeof proofDigest === 'string' ? { proofDigest } : {}),
          };
          status.children = 'known';
        } else {
          rootProofFailed = true;
          status.children = 'invalid';
          errors.push(
            proofResult.reason ??
              `rootIdentityProof did not prove root ${document.rootAddress}`,
          );
        }
      } catch (err) {
        rootProofFailed = true;
        status.children = 'invalid';
        errors.push(
          `rootIdentityProof verification failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  let manifest: EntityManifestBindingView | null = null;
  if (sources.manifest) {
    try {
      const binding: ManifestIdentityBinding = await verifyManifestIdentity(
        sources.manifest,
        identity,
        {
          asOf,
          ...(options.proofVerifier
            ? { proofVerifiers: { 'root-identity': options.proofVerifier } }
            : {}),
        },
      );
      manifest = { signed: sources.manifest, binding };
      status.manifest = binding.valid ? 'known' : 'invalid';
      if (!binding.valid) {
        errors.push(`manifest binding invalid: ${binding.reason ?? 'unknown'}`);
      }

      if (binding.valid && !rootProofFailed && children === null) {
        const proven = uniqueAddresses(binding.provenAddresses ?? []);
        if (proven.length > 0) {
          children = { rootAddress: document.rootAddress, provenAddresses: proven };
          status.children = 'known';
        }
      }
    } catch (err) {
      status.manifest = 'invalid';
      errors.push(
        `manifest binding failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const authority: EntityAuthorityGrant[] = [];
  if (sources.authority !== undefined && sources.authority.length > 0) {
    const rejected: string[] = [];
    for (const grant of sources.authority) {
      const reason = checkAuthorityGrant(grant, identity, asOf);
      if (reason) rejected.push(reason);
      else authority.push(grant);
    }
    if (authority.length > 0) {
      status.authority = 'known';
      errors.push(...rejected);
    } else {
      status.authority = 'invalid';
      errors.push(...rejected);
    }
  }

  return {
    version: ENTITY_RESOLUTION_VERSION,
    asOf,
    entityId: document.id,
    rootAddress: document.rootAddress,
    resolved,
    children,
    manifest,
    authority,
    status,
    errors,
  };
}
