/**
 * AppRegistry and AgentRegistry for the lookup node.
 *
 * SQLite-backed stores for SignedManifest announcements.
 *
 * Signature verification:
 *   - Ed25519 signatures are verified on ingest using WebCrypto.
 *   - By default (`requireSignature: true`), announcements without a valid
 *     signature are REJECTED. Set `requireSignature: false` only for
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
import type { SendFn } from './handlers.js';
import type { SqliteStore, AppRow, AgentRow } from './storage.js';

// ---------------------------------------------------------------------------
// Ed25519 signature verification (WebCrypto, portable: Node 18+, browsers)
// ---------------------------------------------------------------------------

async function verifyEd25519(
  data: Uint8Array,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const subtle = globalThis.crypto.subtle;
    const pubKeyBytes = Uint8Array.from(Buffer.from(publicKeyHex, 'hex'));
    const sigBytes = Uint8Array.from(Buffer.from(signatureHex, 'hex'));
    const key = await subtle.importKey(
      'raw',
      pubKeyBytes,
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['verify'],
    );
    return await subtle.verify(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      key,
      sigBytes,
      data as unknown as ArrayBuffer,
    );
  } catch {
    return false;
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
    const { appId, manifest, expiresAt, publicKey, signature, authorAddress, isFree } = msg.payload;

    if (publicKey && signature) {
      const valid = await verifyEd25519(manifest, signature, publicKey);
      if (!valid) {
        // Reject silently — malicious, corrupted, or replayed announcement
        return;
      }
    } else if (this._requireSignature) {
      // Missing signature in required mode — reject
      return;
    }

    const row: AppRow = {
      appId,
      manifest: Buffer.from(manifest),
      nodeId,
      expiresAt,
      publicKey,
      signature,
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
    const { capabilityId, manifest, expiresAt, publicKey, signature, tags, pricePerCall, latencyMs } = msg.payload;

    if (publicKey && signature) {
      const valid = await verifyEd25519(manifest, signature, publicKey);
      if (!valid) {
        return;
      }
    } else if (this._requireSignature) {
      return;
    }

    const row: AgentRow = {
      capabilityId,
      manifest: Buffer.from(manifest),
      nodeId,
      expiresAt,
      publicKey,
      signature,
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
