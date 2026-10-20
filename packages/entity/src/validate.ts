/**
 * Fail-closed validation for entity inputs (RFC-056 §4.6).
 *
 * Types alone do not protect data crossing a wire or storage boundary. These
 * guards reject malformed sources and projection requests before any
 * verification or disclosure happens.
 */
import type {
  EntityProjectionMode,
  EntityProjectionRequest,
  EntityPurpose,
  EntityResolverOptions,
  EntitySources,
} from './types.js';
import { ENTITY_SECTIONS } from './types.js';

export class EntityValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid entity input: ${issues.join('; ')}`);
    this.name = 'EntityValidationError';
    this.issues = issues;
  }
}

const KINDS = new Set([
  'person',
  'device',
  'agent',
  'service',
  'organization',
  'sensor',
  'robot',
  'gateway',
]);

const MODES = new Set<EntityProjectionMode>(['minimal', 'available', 'purpose-bound']);

const PURPOSES = new Set<EntityPurpose>([
  'same-actor',
  'shared-root',
  'identity',
  'capabilities',
  'claims',
  'authority',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSafeTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function checkIdentity(sources: Record<string, unknown>, issues: string[]): void {
  const identity = sources.identity;
  if (!isObject(identity)) {
    issues.push('identity must be an IdentityGraph object');
    return;
  }
  const document = identity.document;
  if (!isObject(document)) {
    issues.push('identity.document must be an object');
  } else {
    if (!isNonEmptyString(document.id)) issues.push('identity.document.id must be a non-empty string');
    if (!KINDS.has(document.kind as string)) issues.push('identity.document.kind is not a valid IdentityKind');
    if (!isNonEmptyString(document.rootAddress)) {
      issues.push('identity.document.rootAddress must be a non-empty string');
    }
    if (!isNonEmptyString(document.controllerAddress)) {
      issues.push('identity.document.controllerAddress must be a non-empty string');
    }
    if (typeof document.version !== 'number' || !Number.isSafeInteger(document.version)) {
      issues.push('identity.document.version must be a safe integer');
    }
    if (typeof document.createdAt !== 'number' || !Number.isSafeInteger(document.createdAt)) {
      issues.push('identity.document.createdAt must be a safe integer');
    }
  }
  if (!Array.isArray(identity.claims)) issues.push('identity.claims must be an array');
}

function checkManifest(sources: Record<string, unknown>, issues: string[]): void {
  const manifest = sources.manifest;
  if (manifest === undefined) return;
  if (!isObject(manifest)) {
    issues.push('manifest must be a SignedManifest object');
    return;
  }
  if (!isObject(manifest.manifest)) issues.push('manifest.manifest must be an object');
  if (!isNonEmptyString(manifest.authorAddress)) {
    issues.push('manifest.authorAddress must be a non-empty string');
  }
  if (!isNonEmptyString(manifest.signerPublicKey)) {
    issues.push('manifest.signerPublicKey must be a non-empty string');
  }
  if (!isNonEmptyString(manifest.signature)) {
    issues.push('manifest.signature must be a non-empty string');
  }
  if (!isSafeTime(manifest.signedAt)) issues.push('manifest.signedAt must be a safe timestamp');
}

export function assertEntitySources(sources: EntitySources): void {
  const issues: string[] = [];
  if (!isObject(sources)) {
    throw new EntityValidationError(['sources must be an object']);
  }
  const raw = sources as unknown as Record<string, unknown>;
  checkIdentity(raw, issues);
  checkManifest(raw, issues);

  if (raw.rootIdentityProof !== undefined && !isNonEmptyString(raw.rootIdentityProof)) {
    issues.push('rootIdentityProof must be a non-empty string when provided');
  }
  if (raw.authority !== undefined && !Array.isArray(raw.authority)) {
    issues.push('authority must be an array when provided');
  }

  if (issues.length > 0) throw new EntityValidationError(issues);
}

export function assertEntityResolverOptions(options: EntityResolverOptions): void {
  const issues: string[] = [];
  if (!isObject(options)) {
    throw new EntityValidationError(['options must be an object']);
  }
  const raw = options as unknown as Record<string, unknown>;
  if (raw.asOf !== undefined && !isSafeTime(raw.asOf)) {
    issues.push('asOf must be a non-negative safe integer');
  }
  if (raw.proofVerifier !== undefined) {
    if (!isObject(raw.proofVerifier) || typeof raw.proofVerifier.verify !== 'function') {
      issues.push('proofVerifier must expose a verify() function');
    }
  }
  if (issues.length > 0) throw new EntityValidationError(issues);
}

export function assertEntityProjectionRequest(request: EntityProjectionRequest): void {
  const issues: string[] = [];
  if (!isObject(request)) {
    throw new EntityValidationError(['request must be an object']);
  }
  const raw = request as unknown as Record<string, unknown>;

  if (raw.mode !== undefined && !MODES.has(raw.mode as EntityProjectionMode)) {
    issues.push(`mode must be one of ${[...MODES].join(', ')}`);
  }
  if (raw.maxDisclosureLevel !== undefined) {
    const level = raw.maxDisclosureLevel;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 5) {
      issues.push('maxDisclosureLevel must be an integer in 0…5');
    }
  }
  if (raw.purposes !== undefined) {
    if (!Array.isArray(raw.purposes)) {
      issues.push('purposes must be an array');
    } else {
      for (const purpose of raw.purposes) {
        if (!PURPOSES.has(purpose as EntityPurpose)) {
          issues.push(`unknown purpose: ${String(purpose)}`);
        }
      }
      if (raw.mode === 'purpose-bound' && raw.purposes.length === 0) {
        issues.push('purpose-bound projection requires at least one purpose');
      }
      if (raw.mode !== 'purpose-bound' && raw.purposes.length > 0) {
        issues.push('purposes are only valid with mode "purpose-bound"');
      }
    }
  }
  if (raw.mode === 'purpose-bound' && raw.purposes === undefined) {
    issues.push('purpose-bound projection requires purposes');
  }
  if (raw.includeMetadata !== undefined) {
    if (!Array.isArray(raw.includeMetadata)) {
      issues.push('includeMetadata must be an array of strings');
    } else {
      for (const key of raw.includeMetadata) {
        if (!isNonEmptyString(key)) issues.push('includeMetadata entries must be non-empty strings');
      }
    }
  }
  if (raw.asOf !== undefined && !isSafeTime(raw.asOf)) {
    issues.push('asOf must be a non-negative safe integer');
  }

  if (issues.length > 0) throw new EntityValidationError(issues);
}

export function isEntitySection(value: unknown): boolean {
  return typeof value === 'string' && (ENTITY_SECTIONS as readonly string[]).includes(value);
}
