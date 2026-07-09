/**
 * Port interfaces for @totemsdk/edge.
 *
 * All ports are interfaces only. Callers inject implementations at runtime.
 * @totemsdk/edge ships no proof creation/verification implementations.
 */

import type { EdgeOperationResult } from './types.js';

export interface EdgePaymentPort {
  pay(params: {
    recipient: string;
    amount: string;
    tokenId?: string;
    memo?: string;
  }): Promise<EdgeOperationResult<{ txpowId?: string }>>;
}

export interface EdgeLiquidityPort {
  getBalance(address: string): Promise<EdgeOperationResult<{ balance: string; tokenId: string }>>;
  getUtxos(address: string): Promise<EdgeOperationResult<{ utxos: unknown[] }>>;
}

export interface EdgeProofPort {
  createProof(params: {
    subject: string;
    claims: unknown[];
    context?: Record<string, unknown>;
  }): Promise<EdgeOperationResult<{ proofId: string; proof: unknown }>>;

  verifyProof(params: {
    proof: unknown;
    subject?: string;
  }): Promise<EdgeOperationResult<{ valid: boolean; reason?: string }>>;
}

export interface EdgeLookupPort {
  lookup(params: {
    query: string;
    kind?: string;
  }): Promise<EdgeOperationResult<{ results: unknown[] }>>;

  watch(params: {
    address: string;
    onUpdate: (data: unknown) => void;
  }): Promise<EdgeOperationResult<{ unsubscribe: () => void }>>;

  /**
   * Query the lookup network for registered apps or agents.
   * Returns an empty array if no lookup port is configured on the node.
   */
  query(params:
    | {
        kind: 'app';
        category?: string[];
        authorAddress?: string;
        minVersion?: number;
        freeOnly?: boolean;
        limit?: number;
      }
    | {
        kind: 'agent';
        capabilityName?: string;
        tags?: string[];
        maxPricePerCall?: number;
        maxLatencyMs?: number;
        limit?: number;
      }
  ): Promise<EdgeOperationResult<{ results: Array<{ id: string; manifest: Uint8Array; nodeId: string }> }>>;

  announce(params:
    | {
        kind: 'app';
        /** WOTS-signed manifest (SignedManifest from @totemsdk/manifest). */
        signed: unknown;
        appId: string;
        expiresAt: number;
        authorAddress?: string;
        isFree?: boolean;
      }
    | {
        kind: 'agent';
        /** WOTS-signed manifest (SignedManifest from @totemsdk/manifest). */
        signed: unknown;
        capabilityId: string;
        expiresAt: number;
        tags?: string[];
        pricePerCall?: number;
        latencyMs?: number;
      }
  ): Promise<EdgeOperationResult>;
}

export interface EdgePolicyPort {
  check(params: {
    action: string;
    subject: string;
    context?: Record<string, unknown>;
  }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>>;
}

export interface EdgeIdentityPort {
  resolve(identityId: string): Promise<EdgeOperationResult<{ identity: unknown }>>;
  verify(proof: unknown): Promise<EdgeOperationResult<{ valid: boolean; address?: string }>>;
}

export interface EdgeManifestPort {
  sign(manifest: unknown, seed: Uint8Array, keyIndex: number): Promise<EdgeOperationResult<{ signed: unknown }>>;
  verify(signed: unknown): Promise<EdgeOperationResult<{ valid: boolean; reason?: string }>>;
}

/**
 * Port for WOTS key-lease coordination.
 *
 * Implementations must ensure that a WOTS key index is reserved exclusively
 * before any signing operation consumes it. This prevents double-spend of a
 * one-time WOTS key slot in concurrent or distributed environments.
 *
 * Wire this port to @totemsdk/wots-lease's LocalLeaseProvider or any
 * distributed provider in the lease chain.
 */
export interface EdgeKeyLeasePort {
  /** Reserve a key index for signing. Returns a reservation token. */
  reserve(keyIndex: number): Promise<{ reservationId: string }>;
  /** Commit the reservation — the key has been used successfully. */
  commit(reservationId: string): Promise<void>;
  /** Burn the reservation without using the key (on error or cancellation). */
  burn(reservationId: string): Promise<void>;
}

export interface EdgeRuntimePorts {
  payment?: EdgePaymentPort;
  liquidity?: EdgeLiquidityPort;
  proof?: EdgeProofPort;
  lookup?: EdgeLookupPort;
  policy?: EdgePolicyPort;
  identity?: EdgeIdentityPort;
  manifest?: EdgeManifestPort;
  /** WOTS key-lease coordination — required before any signing operation. */
  keyLease?: EdgeKeyLeasePort;
}
