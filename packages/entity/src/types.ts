/**
 * `@totemsdk/entity` — public types (RFC-056).
 *
 * Disclosure-bounded entity resolution and projection. Pure data + local
 * verification; no network, signing, custody or authority evaluation.
 */
import type {
  DelegationClaim,
  IdentityGraph,
  IdentityKind,
  IdentityProofVerifier,
  IdentityStatus,
  ManifestIdentityBinding,
  PaymentRecipientClaim,
  ResolvedIdentity,
  ServiceEndpointClaim,
} from '@totemsdk/identity';
import type { SignedManifest } from '@totemsdk/manifest';

export const ENTITY_RESOLUTION_VERSION = 'entity-resolution/v1' as const;
export const ENTITY_VIEW_VERSION = 'entity-view/v1' as const;

/** Disclosure levels 0 (root only) … 5 (authority). */
export type EntityDisclosureLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type EntityProjectionMode = 'minimal' | 'available' | 'purpose-bound';

export type EntityPurpose =
  | 'same-actor'
  | 'shared-root'
  | 'identity'
  | 'capabilities'
  | 'claims'
  | 'authority';

export type EntitySection =
  | 'root'
  | 'children'
  | 'identity'
  | 'manifest'
  | 'claims'
  | 'authority';

/**
 * `known`   — the source was supplied and verified.
 * `unknown` — the source was not supplied (absence of disclosure, not a negative).
 * `invalid` — the source was supplied but failed verification.
 */
export type EntitySectionState = 'known' | 'unknown' | 'invalid';

export const ENTITY_SECTIONS: readonly EntitySection[] = [
  'root',
  'children',
  'identity',
  'manifest',
  'claims',
  'authority',
];

export const ENTITY_SECTION_LEVELS: Readonly<Record<EntitySection, EntityDisclosureLevel>> = {
  root: 0,
  children: 1,
  identity: 2,
  manifest: 3,
  claims: 4,
  authority: 5,
};

export const ENTITY_PURPOSE_SECTIONS: Readonly<
  Record<EntityPurpose, readonly EntitySection[]>
> = {
  'same-actor': ['root'],
  'shared-root': ['children'],
  identity: ['identity'],
  capabilities: ['manifest'],
  claims: ['claims'],
  authority: ['authority'],
};

/**
 * An authority grant that has already been verified by `@totemsdk/authority`.
 *
 * `@totemsdk/entity` does not verify mandates. It only enforces the subject
 * binding and the `validFrom`/`expiresAt` window at the requested `asOf`.
 */
export interface EntityAuthorityGrant {
  id: string;
  issuer: string;
  subject: string;
  capabilities: string[];
  validFrom: number;
  expiresAt?: number;
  proofId: string;
  verifiedBy: 'authority';
  verified: true;
}

export interface EntitySources {
  /** Required: the actor's identity graph. */
  identity: IdentityGraph;
  /** Optional: a signed manifest to bind to the identity. */
  manifest?: SignedManifest;
  /** Optional: serialized `OwnershipProof`, verified via `proofVerifier`. */
  rootIdentityProof?: string;
  /** Optional: grants already verified by `@totemsdk/authority`. */
  authority?: EntityAuthorityGrant[];
}

export interface EntityResolverOptions {
  /** Explicit resolution time. Defaults to `Date.now()`. */
  asOf?: number;
  /** Injected root-identity verifier (e.g. from `@totemsdk/root-identity`). */
  proofVerifier?: IdentityProofVerifier;
}

export interface EntityChildProofView {
  rootAddress: string;
  provenAddresses: string[];
  proofDigest?: string;
}

export interface EntityManifestBindingView {
  signed: SignedManifest;
  binding: ManifestIdentityBinding;
}

export interface EntityResolution {
  version: typeof ENTITY_RESOLUTION_VERSION;
  asOf: number;
  entityId: string;
  rootAddress: string;
  resolved: ResolvedIdentity | null;
  children: EntityChildProofView | null;
  manifest: EntityManifestBindingView | null;
  authority: EntityAuthorityGrant[];
  status: Record<EntitySection, EntitySectionState>;
  errors: string[];
}

export interface EntityProjectionRequest {
  /** Defaults to `minimal`. */
  mode?: EntityProjectionMode;
  /** Upper bound on disclosure. Defaults to 0 for `minimal`, 5 otherwise. */
  maxDisclosureLevel?: EntityDisclosureLevel;
  /** Required for `purpose-bound`; ignored otherwise. */
  purposes?: EntityPurpose[];
  /** Identity-document metadata key allow-list. Omit to disclose no metadata. */
  includeMetadata?: string[];
  /** If present, MUST equal the resolution `asOf` (prevents replay). */
  asOf?: number;
}

export interface EntityRootView {
  rootAddress: string;
  /** Opaque, domain-separated reference to the root address. */
  entityRef: string;
}

export interface EntityIdentityView {
  id: string;
  kind: IdentityKind;
  version: number;
  rootAddress: string;
  controllerAddress: string;
  createdAt: number;
  status: IdentityStatus;
  metadata?: Record<string, unknown>;
}

export interface EntityManifestView {
  manifestId: string;
  type: string;
  name?: string;
  version?: string;
  authorAddress: string;
  signedAt: number;
  capabilities?: string[];
}

export interface EntityClaimsView {
  delegates: DelegationClaim[];
  paymentRecipients: PaymentRecipientClaim[];
  serviceEndpoints: ServiceEndpointClaim[];
}

export interface EntityView {
  version: typeof ENTITY_VIEW_VERSION;
  mode: EntityProjectionMode;
  asOf: number;
  disclosureLevel: EntityDisclosureLevel;
  root: EntityRootView;
  /** State of the sections that were requested by the projection policy. */
  status: Partial<Record<EntitySection, EntitySectionState>>;
  /** Sections successfully disclosed. */
  disclosed: EntitySection[];
  /** Sections excluded by mode/level/purpose (no existence signal). */
  withheld: EntitySection[];
  /** Requested sections with no supplied source. */
  unknown: EntitySection[];
  /** Requested sections that failed verification. */
  invalid: EntitySection[];
  children?: EntityChildProofView;
  identity?: EntityIdentityView;
  manifest?: EntityManifestView;
  claims?: EntityClaimsView;
  authority?: EntityAuthorityGrant[];
  /** Canonical digest of the view excluding `digest` itself. */
  digest: string;
}
