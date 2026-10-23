/**
 * Disclosure-bounded entity projection (RFC-056 §4.4).
 *
 * Projection never invents data: a section is disclosed only when the
 * resolution marks it `known`. Sections excluded by policy are listed as
 * `withheld` without any existence signal.
 */
import type { SignedManifest } from '@totemsdk/manifest';
import type {
  EntityClaimsView,
  EntityDisclosureLevel,
  EntityIdentityView,
  EntityManifestBindingView,
  EntityManifestView,
  EntityProjectionMode,
  EntityProjectionRequest,
  EntityResolution,
  EntitySection,
  EntitySectionState,
  EntityView,
} from './types.js';
import {
  ENTITY_PURPOSE_SECTIONS,
  ENTITY_SECTION_LEVELS,
  ENTITY_SECTIONS,
  ENTITY_VIEW_VERSION,
} from './types.js';
import { computeEntityRef, computeEntityViewDigest } from './digest.js';
import { EntityValidationError, assertEntityProjectionRequest } from './validate.js';

function pickMetadata(
  metadata: Record<string, unknown> | undefined,
  allow: readonly string[] | undefined,
): Record<string, unknown> | undefined {
  if (!metadata || !allow) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of allow) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      out[key] = metadata[key];
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildIdentityView(
  resolution: EntityResolution,
  includeMetadata: readonly string[] | undefined,
): EntityIdentityView | undefined {
  const resolved = resolution.resolved;
  if (!resolved) return undefined;
  const document = resolved.document;
  const metadata = pickMetadata(document.metadata, includeMetadata);
  return {
    id: document.id,
    kind: document.kind,
    version: document.version,
    rootAddress: document.rootAddress,
    controllerAddress: document.controllerAddress,
    createdAt: document.createdAt,
    status: resolved.status,
    ...(metadata ? { metadata } : {}),
  };
}

function buildManifestView(binding: EntityManifestBindingView): EntityManifestView {
  const signed: SignedManifest = binding.signed;
  const raw = signed.manifest as unknown as Record<string, unknown>;

  const name =
    typeof raw.name === 'string'
      ? raw.name
      : typeof raw.capabilityName === 'string'
        ? raw.capabilityName
        : undefined;
  const version = typeof raw.version === 'string' ? raw.version : undefined;
  const capsSource = Array.isArray(raw.capabilities)
    ? raw.capabilities
    : Array.isArray(raw.permissions)
      ? raw.permissions
      : undefined;
  const capabilities = capsSource?.filter((v): v is string => typeof v === 'string');

  return {
    manifestId: binding.binding.manifestId,
    type: typeof raw.type === 'string' ? raw.type : 'unknown',
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    authorAddress: signed.authorAddress,
    signedAt: signed.signedAt,
    ...(capabilities && capabilities.length > 0 ? { capabilities } : {}),
  };
}

function buildClaimsView(resolution: EntityResolution): EntityClaimsView | undefined {
  const resolved = resolution.resolved;
  if (!resolved) return undefined;
  return {
    delegates: resolved.delegates.map((delegate) => ({
      ...delegate,
      scopes: [...delegate.scopes],
    })),
    paymentRecipients: resolved.paymentRecipients.map((recipient) => ({ ...recipient })),
    serviceEndpoints: resolved.serviceEndpoints.map((endpoint) => ({ ...endpoint })),
  };
}

function requestedSections(
  resolution: EntityResolution,
  mode: EntityProjectionMode,
  purposes: readonly string[] | undefined,
): EntitySection[] {
  if (mode === 'minimal') return [];
  if (mode === 'available') return [...ENTITY_SECTIONS];

  const requested = new Set<EntitySection>(['root']);
  for (const purpose of purposes ?? []) {
    const sections = ENTITY_PURPOSE_SECTIONS[purpose as keyof typeof ENTITY_PURPOSE_SECTIONS];
    if (!sections) {
      throw new EntityValidationError([`unknown purpose: ${purpose}`]);
    }
    for (const section of sections) requested.add(section);
  }
  if (requested.size === 1 && !purposes?.length) {
    throw new EntityValidationError(['purpose-bound projection requires at least one purpose']);
  }
  return ENTITY_SECTIONS.filter((section) => requested.has(section));
}

/**
 * Produce a disclosure-bounded view from a resolved entity.
 *
 * Default mode is `minimal` (no sections). `available` discloses every verified
 * section up to `maxDisclosureLevel`. `purpose-bound` discloses only the
 * sections required by the requested purposes.
 */
export function projectEntity(
  resolution: EntityResolution,
  request: EntityProjectionRequest = {},
): EntityView {
  assertEntityProjectionRequest(request);

  if (request.asOf !== undefined && request.asOf !== resolution.asOf) {
    throw new EntityValidationError([
      `projection asOf ${request.asOf} does not match resolution asOf ${resolution.asOf}`,
    ]);
  }
  const mode: EntityProjectionMode = request.mode ?? 'minimal';
  const maxLevel: EntityDisclosureLevel =
    request.maxDisclosureLevel ?? (mode === 'minimal' ? 0 : 5);

  const requested = requestedSections(resolution, mode, request.purposes);
  if (requested.includes('root') && resolution.status.root !== 'known') {
    throw new EntityValidationError(['resolution root section is not known']);
  }
  const effective = requested.filter(
    (section) => ENTITY_SECTION_LEVELS[section] <= maxLevel || section === 'root',
  );
  const effectiveSet = new Set(effective);

  const status: Partial<Record<EntitySection, EntitySectionState>> = {};
  const disclosed: EntitySection[] = [];
  const unknown: EntitySection[] = [];
  const invalid: EntitySection[] = [];

  for (const section of effective) {
    const state = resolution.status[section];
    status[section] = state;
    if (state === 'known') disclosed.push(section);
    else if (state === 'invalid') invalid.push(section);
    else unknown.push(section);
  }

  const withheld = ENTITY_SECTIONS.filter((section) => !effectiveSet.has(section));
  const disclosureLevel = effective.reduce<EntityDisclosureLevel>(
    (highest, section) =>
      Math.max(highest, ENTITY_SECTION_LEVELS[section]) as EntityDisclosureLevel,
    0,
  );

  const children =
    disclosed.includes('children') && resolution.children
      ? {
          rootAddress: resolution.children.rootAddress,
          provenAddresses: [...resolution.children.provenAddresses],
          ...(resolution.children.proofDigest !== undefined
            ? { proofDigest: resolution.children.proofDigest }
            : {}),
        }
      : undefined;

  const identity = disclosed.includes('identity')
    ? buildIdentityView(resolution, request.includeMetadata)
    : undefined;

  const manifest =
    disclosed.includes('manifest') && resolution.manifest?.binding.valid
      ? buildManifestView(resolution.manifest)
      : undefined;

  const claims = disclosed.includes('claims') ? buildClaimsView(resolution) : undefined;

  const authority = disclosed.includes('authority')
    ? resolution.authority.map((grant) => ({
        ...grant,
        capabilities: [...grant.capabilities],
      }))
    : undefined;

  const body: Omit<EntityView, 'digest'> = {
    version: ENTITY_VIEW_VERSION,
    mode,
    asOf: resolution.asOf,
    disclosureLevel,
    ...(disclosed.includes('root')
      ? {
          root: {
            rootAddress: resolution.rootAddress,
            entityRef: computeEntityRef(resolution.rootAddress),
          },
        }
      : {}),
    status,
    disclosed,
    withheld,
    unknown,
    invalid,
    ...(children ? { children } : {}),
    ...(identity ? { identity } : {}),
    ...(manifest ? { manifest } : {}),
    ...(claims ? { claims } : {}),
    ...(authority ? { authority } : {}),
  };

  return {
    ...body,
    digest: computeEntityViewDigest(body),
  };
}
