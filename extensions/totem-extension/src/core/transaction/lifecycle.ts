/**
 * Transaction Lifecycle Manager
 * Integrates lease persistence, watermark updates, error handling, and receipts
 * 
 * Updated 2026-02-05 for Per-Address TreeKey Architecture
 */

import { TransactionService, type PrepareResponse, type FinalizeResponse } from './service';
import { leaseStore, watermarkStore, transactionReceiptStore } from '../stores';
import type { SigningIndices } from '../stores/WatermarkStore';
import { validateWatermarkBeforePrepare } from '../validation/watermark';

export class TransactionLifecycleError extends Error {
  constructor(
    message: string,
    public code: number,
    public userMessage: string
  ) {
    super(message);
    this.name = 'TransactionLifecycleError';
  }
}

export class TransactionLifecycle {
  async prepare(
    params: { to: string; amount: string; tokenId?: string; burn?: string },
    rootPublicKey: string
  ): Promise<PrepareResponse & { metadata: { to: string; amount: string; tokenId: string } }> {
    try {
      await validateWatermarkBeforePrepare(rootPublicKey);
    } catch (error: any) {
      throw new TransactionLifecycleError(
        error.message,
        409,
        'All signatures have been used. Please create a new wallet.'
      );
    }

    try {
      const result = await TransactionService.prepare(params, rootPublicKey);

      const indices: SigningIndices = {
        addressIndex: result.addressIndex,
        l1: result.l1,
        l2: result.l2,
      };

      await leaseStore.save({
        leaseId: result.leaseId,
        leaseToken: result.leaseToken,
        indices,
        expiresAt: Date.now() + (result.leaseTTL * 1000),
        status: 'active',
        createdAt: Date.now(),
        txId: result.txId,
        leaseTTL: result.leaseTTL
      });

      console.log('[TransactionLifecycle] ✓ Lease persisted:', result.leaseId);
      
      return {
        ...result,
        metadata: {
          to: params.to,
          amount: params.amount,
          tokenId: params.tokenId || '0x00'
        }
      };

    } catch (error: any) {
      const errorResponse = this.parseAxiaError(error);
      throw new TransactionLifecycleError(
        error.message,
        errorResponse.code,
        errorResponse.userMessage
      );
    }
  }

  async finalize(
    leaseToken: string,
    signedHex: string,
    metadata: { to: string; amount: string; tokenId: string }
  ): Promise<FinalizeResponse> {
    const lease = leaseStore.getByToken(leaseToken);
    if (!lease) {
      throw new TransactionLifecycleError(
        'Lease not found',
        404,
        'Transaction lease not found. Please try again.'
      );
    }

    try {
      const result = await TransactionService.finalize({
        leaseToken,
        signedHex
      });

      await watermarkStore.markUsed(lease.indices);
      await watermarkStore.advanceWatermark(lease.indices);

      await transactionReceiptStore.initialize();
      
      await transactionReceiptStore.add({
        txpowid: result.txpowid,
        timestamp: Date.now(),
        to: metadata.to,
        amount: metadata.amount,
        tokenId: metadata.tokenId,
        indices: lease.indices,
        status: 'confirmed',
        txId: lease.txId,
        leaseId: lease.leaseId
      });

      await leaseStore.updateStatus(lease.leaseId, 'finalized');
      await leaseStore.delete(lease.leaseId);

      console.log('[TransactionLifecycle] ✓ Transaction finalized:', result.txpowid);
      console.log('[TransactionLifecycle] ✓ Watermark advanced and receipt stored');

      return result;

    } catch (error: any) {
      const errorResponse = this.parseAxiaError(error);
      throw new TransactionLifecycleError(
        error.message,
        errorResponse.code,
        errorResponse.userMessage
      );
    }
  }

  async cancelLease(leaseToken: string): Promise<void> {
    const lease = leaseStore.getByToken(leaseToken);
    if (lease) {
      await leaseStore.updateStatus(lease.leaseId, 'cancelled');
      await leaseStore.delete(lease.leaseId);
      console.log('[TransactionLifecycle] ✓ Lease cancelled:', lease.leaseId);
    }
  }

  private parseAxiaError(error: any): { code: number; userMessage: string } {
    const message = error.message || error.toString();

    if (error?.code === 429) {
      const limit = error.limit ?? 10;
      return {
        code: 429,
        userMessage: `Daily signing limit reached (${limit}/day). Resets at midnight UTC.`
      };
    }

    if (message.includes('403') || error.code === 403) {
      return {
        code: 403,
        userMessage: 'Access denied. Your project may not have permission for this operation.'
      };
    }

    if (message.includes('409') || error.code === 409) {
      return {
        code: 409,
        userMessage: 'WOTS indices exhausted. Please create a new wallet.'
      };
    }

    if (message.includes('410') || error.code === 410) {
      return {
        code: 410,
        userMessage: 'Transaction lease expired. Please try again.'
      };
    }

    if (message.includes('502') || error.code === 502) {
      return {
        code: 502,
        userMessage: 'Failed to post transaction to network. Please try again.'
      };
    }

    return {
      code: 500,
      userMessage: 'An error occurred. Please try again.'
    };
  }
}

export const transactionLifecycle = new TransactionLifecycle();
