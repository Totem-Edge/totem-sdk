/**
 * Implementations for Layers 3–5 of the WotsLeaseProvider hierarchy.
 *
 * Layer 3 (PersonalLeaseNodeProvider) — HTTP client for a personal @totemsdk/lookup-node
 *   that has lease coordination enabled ({ lease: { enabled: true } }).
 *   The node exposes REST endpoints under /v1/lease/*.
 *
 * Layers 4–5 (P2PQuorumLeaseProvider, OnchainWatermarkProvider) — implemented in
 *   quorum.ts and onchain.ts; re-exported here for backward compatibility.
 */

import type {
  WotsLeaseProvider,
  ReserveParams,
  LeaseReservation,
  LeaseCertificate,
  LocalWatermark,
  SyncResult,
  PersonalLeaseNodeConfig,
} from './types.js';

export { P2PQuorumLeaseProvider } from './quorum.js';
export { OnchainWatermarkProvider } from './onchain.js';

// ---------------------------------------------------------------------------
// PersonalLeaseNodeProvider — Layer 3
// ---------------------------------------------------------------------------

interface NodeReserveResponse {
  reservation: LeaseReservation;
  certificate: LeaseCertificate;
}

interface NodeLeaseOkResponse {
  ok: boolean;
  error?: string;
}

/**
 * Layer 3 — personal lookup-node lease coordinator.
 *
 * Calls the HTTP REST API exposed by a running @totemsdk/lookup-node that has
 * lease coordination enabled. All write operations are forwarded to the node's
 * LeaseCoordinator so the node acts as the source-of-truth watermark journal
 * for high-value transactions.
 *
 * Wrap with HybridLeaseProvider so local reservations always succeed even when
 * the personal node is temporarily unreachable:
 *
 * ```ts
 * const provider = new HybridLeaseProvider({
 *   local: new LocalLeaseProvider(storage),
 *   node:  new PersonalLeaseNodeProvider({ nodeUrl, nodePubkey }),
 *   threshold: 10, // escalate to node for txns >= 10 MIN
 * });
 * ```
 */
export class PersonalLeaseNodeProvider implements WotsLeaseProvider {
  private readonly baseUrl: string;
  private readonly nodePubkey: string;
  private readonly authToken?: string;

  constructor(config: PersonalLeaseNodeConfig) {
    this.baseUrl = config.nodeUrl.replace(/\/$/, '');
    this.nodePubkey = config.nodePubkey;
    this.authToken = config.authToken;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    return h;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PersonalLeaseNodeProvider: ${path} HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PersonalLeaseNodeProvider: GET ${path} HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    const data = await this.post<NodeReserveResponse>('/v1/lease/reserve', {
      treeId: params.treeId,
      branchId: params.branchId,
      deviceId: params.deviceId,
      ttlMs: params.ttlMs,
      payloadHash: params.payloadHash,
      purpose: params.purpose,
    });
    return { ...data.reservation, certificate: data.certificate };
  }

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    const data = await this.post<NodeLeaseOkResponse>('/v1/lease/commit', { reservationId, txId });
    if (!data.ok) throw new Error(`PersonalLeaseNodeProvider: commit failed — ${data.error ?? 'unknown'}`);
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    const data = await this.post<NodeLeaseOkResponse>('/v1/lease/burn', { reservationId, reason });
    if (!data.ok) throw new Error(`PersonalLeaseNodeProvider: burn failed — ${data.error ?? 'unknown'}`);
  }

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    return this.get<LocalWatermark>(`/v1/lease/watermark/${encodeURIComponent(treeId)}`);
  }

  async publishWatermark(treeId: string): Promise<void> {
    await this.post<NodeLeaseOkResponse>(`/v1/lease/watermark/${encodeURIComponent(treeId)}/publish`, {});
  }

  async syncLeaseJournal(): Promise<SyncResult> {
    return this.get<SyncResult>('/v1/lease/journal/sync');
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (!cert) return false;
    if (cert.issuedBy !== this.nodePubkey) return false;
    if (cert.expiresAt <= Date.now()) return false;
    if (typeof cert.signature !== 'string' || cert.signature.length === 0) return false;
    return true;
  }
}
