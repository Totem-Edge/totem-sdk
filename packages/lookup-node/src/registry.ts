/**
 * AppRegistry and AgentRegistry for the lookup node.
 *
 * SQLite-backed stores for SignedManifest announcements.
 *
 * Signature verification (RFC-032):
 *   - The `manifest` bytes are an encoded `SignedManifest` whose payload is
 *     WOTS-signed (see @totemsdk/manifest). It is decoded and verified with
 *     `verifyManifest` on ingest — post-quantum, self-contained, no Ed25519.
 *   - By default (`requireSignature: true`), announcements whose manifest fails
 *     verification are REJECTED. Set `requireSignature: false` only for
 *     private/trusted networks where all peers are known.
 *
 * App query supports filtering by `authorAddress`, `freeOnly`, and `limit`.
 * Agent query supports filtering by `tags`, `capabilityName`, `maxPricePerCall`,
 * and `maxLatencyMs`.
 */

import type {
  AppAnnounceMessage,
  AppQueryMessage,
  AgentAnnounceMessage,
  AgentQueryMessage,
} from '@totemsdk/lookup-protocol';
import { decodeManifest, verifyManifest } from '@totemsdk/manifest';
import type { SendFn } from './handlers.js';
import type { SqliteStore, AppRow, AgentRow } from './storage.js';

// ---------------------------------------------------------------------------
// WOTS-signed manifest verification (RFC-032)
// ---------------------------------------------------------------------------

/**
 * Decode an encoded SignedManifest and verify its WOTS signature. Returns the
 * signer address on success, or null when the manifest is malformed or the
 * signature is invalid.
 */
function verifySignedManifest(manifestBytes: Uint8Array): { valid: boolean; signerAddress?: string } {
  try {
    const signed = decodeManifest(manifestBytes instanceof Uint8Array ? manifestBytes : Uint8Array.from(manifestBytes));
    const result = verifyManifest(signed);
    return result.valid ? { valid: true, signerAddress: result.signerAddress } : { valid: false };
  } catch {
    return { valid: false };
  }
}

// ---------------------------------------------------------------------------
// App Registry
// ---------------------------------------------------------------------------

export class AppRegistry {
  private readonly _store: SqliteStore;
  private readonly _requireSignature: boolean;

  /**
   * @param store          SQLite backing store
   * @param requireSignature When true (default), announcements without a valid
   *   Ed25519 signature are silently rejected. Set false only for development
   *   or private trusted networks.
   */
  constructor(store: SqliteStore, requireSignature = true) {
    this._store = store;
    this._requireSignature = requireSignature;
  }

  async announce(msg: AppAnnounceMessage, nodeId: string): Promise<void> {
    const { appId, manifest, expiresAt, authorAddress, isFree } = msg.payload;

    // RFC-032: verify the WOTS-signed manifest. Reject silently on failure —
    // malicious, corrupted, or replayed announcement.
    const verification = verifySignedManifest(manifest);
    if (this._requireSignature && !verification.valid) {
      return;
    }

    const row: AppRow = {
      appId,
      manifest: Buffer.from(manifest),
      nodeId,
      expiresAt,
      signerAddress: verification.signerAddress,
      authorAddress,
      isFree: isFree === undefined ? undefined : isFree ? 1 : 0,
    };
    this._store.appUpsert(row);
  }

  query(msg: AppQueryMessage, sendFn: SendFn): void {
    const { authorAddress, freeOnly, limit = 20 } = msg.payload;
    const now = Date.now();

    // Apply SQL-level filters — authorAddress and freeOnly are stored columns
    const results = this._store.appQuery(now, authorAddress, freeOnly).slice(0, limit);

    sendFn({
      type: 'APP_RESULT',
      version: 1,
      id: msg.id,
      payload: {
        apps: results.map((e) => ({
          appId: e.appId,
          manifest: e.manifest as unknown as Uint8Array,
          nodeId: e.nodeId,
        })),
      },
    });
  }

  removeExpired(): void {
    this._store.appDeleteExpired(Date.now());
  }

  size(): number {
    return this._store.appQuery(Date.now()).length;
  }
}

// ---------------------------------------------------------------------------
// Agent Registry
// ---------------------------------------------------------------------------

export class AgentRegistry {
  private readonly _store: SqliteStore;
  private readonly _requireSignature: boolean;
  private _expiryTimer?: ReturnType<typeof setInterval>;

  /**
   * @param store          SQLite backing store
   * @param requireSignature When true (default), announcements without a valid
   *   Ed25519 signature are silently rejected.
   */
  constructor(store: SqliteStore, requireSignature = true) {
    this._store = store;
    this._requireSignature = requireSignature;
  }

  async announce(msg: AgentAnnounceMessage, nodeId: string): Promise<void> {
    const { capabilityId, manifest, expiresAt, tags, pricePerCall, latencyMs } = msg.payload;

    // RFC-032: verify the WOTS-signed manifest.
    const verification = verifySignedManifest(manifest);
    if (this._requireSignature && !verification.valid) {
      return;
    }

    const row: AgentRow = {
      capabilityId,
      manifest: Buffer.from(manifest),
      nodeId,
      expiresAt,
      signerAddress: verification.signerAddress,
      tags: tags ? JSON.stringify(tags) : undefined,
      pricePerCall,
      latencyMs,
    };
    this._store.agentUpsert(row);
  }

  query(msg: AgentQueryMessage, sendFn: SendFn): void {
    const { capabilityName, tags, maxPricePerCall, maxLatencyMs, limit = 20 } = msg.payload;
    const now = Date.now();

    let results = this._store.agentQuery(now);

    // Capability tag filtering — at least one of the query tags must match
    if (tags && tags.length > 0) {
      results = results.filter((agent) => {
        if (!agent.tags) return false;
        let agentTags: string[];
        try {
          agentTags = JSON.parse(agent.tags) as string[];
        } catch {
          return false;
        }
        return tags.some((t) => agentTags.includes(t));
      });
    }

    // Capability name substring filter (case-insensitive against capabilityId)
    if (capabilityName) {
      const lc = capabilityName.toLowerCase();
      results = results.filter((a) => a.capabilityId.toLowerCase().includes(lc));
    }

    // Price filter
    if (maxPricePerCall !== undefined) {
      results = results.filter(
        (a) => a.pricePerCall === undefined || a.pricePerCall === null || a.pricePerCall <= maxPricePerCall,
      );
    }

    // Latency filter
    if (maxLatencyMs !== undefined) {
      results = results.filter(
        (a) => a.latencyMs === undefined || a.latencyMs === null || a.latencyMs <= maxLatencyMs,
      );
    }

    results = results.slice(0, limit);

    sendFn({
      type: 'AGENT_RESULT',
      version: 1,
      id: msg.id,
      payload: {
        agents: results.map((e) => ({
          capabilityId: e.capabilityId,
          manifest: e.manifest as unknown as Uint8Array,
          nodeId: e.nodeId,
        })),
      },
    });
  }

  startExpiryLoop(intervalMs: number): void {
    if (this._expiryTimer) return;
    this._expiryTimer = setInterval(() => this.removeExpired(), intervalMs);
  }

  stopExpiryLoop(): void {
    if (this._expiryTimer) {
      clearInterval(this._expiryTimer);
      this._expiryTimer = undefined;
    }
  }

  removeExpired(): void {
    this._store.agentDeleteExpired(Date.now());
  }

  size(): number {
    return this._store.agentQuery(Date.now()).length;
  }
}
