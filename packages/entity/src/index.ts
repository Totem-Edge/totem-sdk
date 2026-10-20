/**
 * `@totemsdk/entity` — disclosure-bounded entity resolution and projection
 * (RFC-056).
 *
 * Pure, local-first. No network, signing, custody, authority evaluation or
 * money movement. Absence of disclosure is reported as `unknown`, never as
 * `invalid` or `false`.
 */
export type {
  EntityAuthorityGrant,
  EntityChildProofView,
  EntityClaimsView,
  EntityDisclosureLevel,
  EntityIdentityView,
  EntityManifestBindingView,
  EntityManifestView,
  EntityProjectionMode,
  EntityProjectionRequest,
  EntityPurpose,
  EntityResolution,
  EntityResolverOptions,
  EntityRootView,
  EntitySection,
  EntitySectionState,
  EntitySources,
  EntityView,
} from './types.js';

export {
  ENTITY_PURPOSE_SECTIONS,
  ENTITY_RESOLUTION_VERSION,
  ENTITY_SECTIONS,
  ENTITY_SECTION_LEVELS,
  ENTITY_VIEW_VERSION,
} from './types.js';

export {
  ENTITY_DIGEST_DOMAINS,
  computeEntityRef,
  computeEntityViewDigest,
} from './digest.js';

export { resolveEntity } from './resolve.js';
export { projectEntity } from './project.js';

export {
  EntityValidationError,
  assertEntityProjectionRequest,
  assertEntityResolverOptions,
  assertEntitySources,
  isEntitySection,
} from './validate.js';
