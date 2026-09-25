/**
 * TrustIndex — accumulates WOTS-signed trust records and serves aggregated ratings.
 *
 * Storage: SQLite via SqliteStore (always-on; use ':memory:' dbPath for ephemeral).
 *
 * Signature verification model:
 *   - With `requireVerifiedSignature: true` (default, fail closed): a record is
 *     persisted only when `verifyReviewerSignature` is configured and approves.
 *     When a session key is available it must equal `reviewerAddress`. A missing
 *     verifier, a reviewer/session-key mismatch, or a verifier rejection drops
 *     the record.
 *   - With `requireVerifiedSignature: false`: a non-empty signature is accepted
 *     without cryptographic verification. Use only on private/trusted networks.
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
  private readonly _config?: TrustIndexConfig;
  private readonly _requireVerifiedSignature: boolean;

  /**
   * @param store  SQLite backing store
   * @param config Trust index configuration. When `requireVerifiedSignature` is
   *   true (default), `config.verifyReviewerSignature` must be provided and must
   *   approve the record, otherwise the record is rejected (fail closed).
   */
  constructor(store: SqliteStore, config?: TrustIndexConfig) {
    this._store = store;
    this._config = config;
    // Default: fail closed — require a real cryptographic verifier.
    this._requireVerifiedSignature = config?.requireVerifiedSignature !== false;
  }

  /**
   * Persist a reviewer's trust record.
   *
   * @param msg                    TRUST_RECORD message
   * @param authenticatedPublicKey Public key bound to the authenticated session,
   *   used to bind `reviewerAddress` to the connection that submitted the record.
   * @returns true when the record was accepted and persisted, false otherwise.
   */
  async record(msg: TrustRecordMessage, authenticatedPublicKey?: string): Promise<boolean> {
    const { subjectId, rating, comment, reviewerAddress, signature } = msg.payload;

    if (this._requireVerifiedSignature) {
      const verifier = this._config?.verifyReviewerSignature;
      // Fail closed: no verifier configured means no record is trusted.
      if (!verifier) return false;
      if (typeof signature !== 'string' || signature.trim().length === 0) return false;

      // Bind the reviewer identity to the authenticated session key. When the
      // session exposes a key, the record must be signed by that same identity.
      if (authenticatedPublicKey !== undefined && reviewerAddress !== authenticatedPublicKey) {
        return false;
      }

      const approved = await verifier(
        { subjectId, rating, comment, reviewerAddress, signature },
        authenticatedPublicKey,
      );
      if (!approved) return false;
    } else {
      // Legacy/trusted-network mode: keep the structural signature check.
      if (!isValidHexSignature(signature) && (!signature || signature.trim().length === 0)) {
        return false;
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
    return true;
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
