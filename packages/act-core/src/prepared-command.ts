/**
 * RFC-022 §5.1 — canonical digest of the actual prepared device command.
 *
 * The commitment binds this digest, so approval covers the resolved target and
 * command content, not only the caller's parameters. Adapters whose wire form
 * is not canonical (maps, floats, ordering) must supply `canonicalizeCommand`.
 */

import { hashCanonical } from '@totemsdk/core';
import type { ResourceProtocol } from './resources.js';

export interface PreparedCommandBinding {
  /** Resolved target resource, when the adapter selected one. */
  readonly resourceId?: string;
  /** Adapter-declared protocol binding. */
  readonly protocol?: ResourceProtocol;
  /** Resolved endpoint, when the adapter can prove it. */
  readonly endpoint?: string;
  readonly definitionVersion: number;
  readonly schemaHash: string;
  /** Canonical adapter-declared form of the prepared command. */
  readonly command: unknown;
}

export function computePreparedCommandHash(binding: PreparedCommandBinding): string {
  return hashCanonical('TOTEM_INDUSTRIAL_ACTION_PREPARED_COMMAND_V1', {
    resourceId: binding.resourceId ?? null,
    protocol: binding.protocol ?? null,
    endpoint: binding.endpoint ?? null,
    definitionVersion: binding.definitionVersion,
    schemaHash: binding.schemaHash,
    command: binding.command ?? null,
  });
}
