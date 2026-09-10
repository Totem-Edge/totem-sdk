/**
 * purchasing/session.ts — PurchaseSession helpers.
 */

import { createEdgeReceipt } from '../receipts.js';
import type { EdgeReceipt } from '../types.js';
import type { PurchaseSession, TradeAgreement, UsageEvent } from './types.js';

export interface SessionOptions {
  id: string;
  agreement: TradeAgreement;
  usageEvents?: UsageEvent[];
  onUsage?: (event: UsageEvent) => void;
  onClose?: () => void;
}

/**
 * Create a PurchaseSession backed by an in-memory usage event list.
 * Production deployments should source usage from a resource adapter or
 * verifiable meter — not from arbitrary callers.
 */
export function createPurchaseSession(opts: SessionOptions): PurchaseSession {
  const events: UsageEvent[] = opts.usageEvents ?? [];
  let status: PurchaseSession['status'] = 'active';

  return {
    id: opts.id,
    agreement: opts.agreement,
    get status() {
      return status;
    },
    usage: async () => {
      return [...events];
    },
    spent: async () => ({
      amount: opts.agreement.terms.price,
      tokenId: opts.agreement.terms.tokenId,
    }),
    close: async (): Promise<EdgeReceipt> => {
      status = 'completed';
      opts.onClose?.();
      return createEdgeReceipt({
        kind: 'purchase',
        payload: {
          agreementId: opts.agreement.agreementId,
          resource: opts.agreement.terms.quantity?.unit ?? '',
          amount: opts.agreement.terms.price,
          tokenId: opts.agreement.terms.tokenId,
        },
        relatedManifestId: opts.agreement.manifestId,
      });
    },
  };
}
