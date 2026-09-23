/**
 * RFC-011 §4.5 — definition and schema versioning.
 *
 * A definition change must never silently reinterpret an in-flight proposal.
 * Each definition carries a monotonic `version` and a `schemaHash`; callers bind
 * a proposal to a version and `prepare` fails closed if the resolved definition
 * no longer matches.
 */

import { hashCanonical } from '@totemsdk/core';
import type { ActionSchema } from './types.js';
import type { IndustrialActionDefinition } from './edge-adapter.js';
import { ActionDefinitionError } from './errors.js';

/** Effective definition version (defaults to 1). */
export function definitionVersion(def: { version?: number }): number {
  return def.version ?? 1;
}

/**
 * Canonical hash of a schema's structural fields (names, types, required flags,
 * quantity constraints). `validation` callbacks and `defaultValue`s are not
 * part of the schema contract and are excluded.
 */
export function computeSchemaHash(schema: ActionSchema): string {
  return hashCanonical('TOTEM_INDUSTRIAL_ACTION_SCHEMA_V1', {
    parameters: schema.parameters.map((p) => ({
      name: p.name,
      type: p.type,
      required: p.required,
      dimension: p.dimension ?? null,
      unit: p.unit ?? null,
      min: p.min ?? null,
      max: p.max ?? null,
      step: p.step ?? null,
    })),
    context: schema.context.map((c) => ({
      name: c.name,
      type: c.type,
      required: c.required,
      maxAgeMs: c.maxAgeMs ?? null,
    })),
  });
}

export interface VersionedActionRegistry {
  register(def: IndustrialActionDefinition): void;
  /** Resolve a specific version, or the latest when `version` is omitted. */
  resolve(kind: string, version?: number): IndustrialActionDefinition | undefined;
  latest(kind: string): IndustrialActionDefinition | undefined;
  versions(kind: string): number[];
}

export function createVersionedActionRegistry(): VersionedActionRegistry {
  const byKind = new Map<string, Map<number, IndustrialActionDefinition>>();

  function latest(kind: string): IndustrialActionDefinition | undefined {
    const versions = byKind.get(kind);
    if (!versions || versions.size === 0) return undefined;
    return versions.get(Math.max(...versions.keys()));
  }

  return {
    register(def) {
      const version = definitionVersion(def);
      let versions = byKind.get(def.kind);
      if (!versions) {
        versions = new Map();
        byKind.set(def.kind, versions);
      }
      if (versions.has(version)) {
        throw new ActionDefinitionError(`definition '${def.kind}@${version}' is already registered`);
      }
      versions.set(version, def);
    },
    resolve(kind, version) {
      if (!byKind.has(kind)) return undefined;
      return version === undefined ? latest(kind) : byKind.get(kind)?.get(version);
    },
    latest,
    versions(kind) {
      const versions = byKind.get(kind);
      return versions ? [...versions.keys()].sort((a, b) => a - b) : [];
    },
  };
}
