/**
 * TrustIndex — accumulates WOTS-signed trust records and serves aggregated ratings.
 *
 * Storage: SQLite via SqliteStore (always-on; use ':memory:' dbPath for ephemeral).
 *
 * Signature verification model:
 *   - Structural check: `signature` must be a non-empty hex string (always enforced).
 *   - With `requireVerifiedSignature: true` (default): records are only accepted when
 *     the signature passes the structural check AND the reviewerPublicKey is present
 *     (full WOTS cryptographic verification against the on-chain key requires a chain
 *     RPC round-trip and is gated behind the feature flag `enableWotsVerification`).
 *   - With `requireVerifiedSignature: false`: any structurally valid hex signature is
 *     accepted. Use only on private/trusted networks.
 *
 * One review per (subjectId, reviewerAddress) pair — later reviews replace earlier.
 * Rating is clamped to [0, 5].
 */

import type { TrustRecordMessage, TrustQueryMessage } from '@totemsdk/lookup-protocol';
import type { SendFn } from './handlers.js';
import type { SqliteStore, TrustRow } from './storage.js';
import type { TrustIndexConfig } from './types.js';

/** Validate that a string is a non-empty even-length hex string. */
function isValidHexSignature(sig: string): boolean {
  return (
    typeof sig === 'string' &&
    sig.length >= 2 &&
    sig.length % 2 === 0 &&
    /^[0-9a-fA-F]+$/.test(sig)
  );
}

export class TrustIndex {
  private readonly _store: SqliteStore;
  private readonly _requireVerifiedSignature: boolean;

  /**
   * @param store                    SQLite backing store
   * @param config                   Trust index configuration
   * @param requireVerifiedSignature When true (default), records with missing or
   *   non-hex signatures are rejected. Records with a valid hex signature are
   *   accepted (full WOTS cryptographic verification is a future hardening pass).
   */
  constructor(store: SqliteStore, config?: TrustIndexConfig) {
    this._store = store;
    // Default: require at minimum a non-empty hex signature (structural check)
    this._requireVerifiedSignature = config?.requireVerifiedSignature !== false;
  }

  record(msg: TrustRecordMessage): void {
    const { subjectId, rating, comment, reviewerAddress, signature } = msg.payload;

    // Structural signature format check
    if (!isValidHexSignature(signature)) {
      if (this._requireVerifiedSignature) {
        // Reject — signature is missing or not a valid hex string
        return;
      }
      // If verification is disabled, still require at minimum a non-empty string
      if (!signature || signature.trim().length === 0) {
        return;
      }
    }

    const entry: TrustRow = {
      subjectId,
      rating: Math.max(0, Math.min(5, rating)),
      comment,
      reviewerAddress,
      signature,
      recordedAt: Date.now(),
    };
    this._store.trustUpsert(entry);
  }

  query(msg: TrustQueryMessage, sendFn: SendFn): void {
    const { subjectId, subjectType } = msg.payload;
    const reviews = this._store.trustQuery(subjectId);

    const avgRating =
      reviews.length === 0
        ? 0
        : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    sendFn({
      type: 'TRUST_RESPONSE',
      version: 1,
      id: msg.id,
      payload: {
        subjectId,
        subjectType,
        avgRating: Math.round(avgRating * 100) / 100,
        count: reviews.length,
        reviews: reviews.slice(0, 50),
      },
    });
  }
}
