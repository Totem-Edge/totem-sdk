/**
 * Hawk transaction backend (RFC-062 Amendment A / RFC-073).
 *
 * Implements the same prepare → proofs → sign → finalize shape as the Axia
 * `TransactionService`, but against the paired local node:
 *
 *   prepare          local watermark reservation (no server lease)
 *   fetchCoinProofs  node `coinexport` (returns the serialized CoinProof)
 *   finalize         node `txnimport` → `txnpost id:… mine:true`
 *   broadcast        node `txnimport` → `txnpost id:… mine:true`
 *
 * The WOTS leaf is marked used before the node submit is attempted. A failed
 * submit never releases the leaf: a signature that may have reached the network
 * must never be reused, even at the cost of one spent leaf.
 */

import type { MinimaRpcClient } from '@totemsdk/chain-provider';
import { resolveActiveNodeRpc } from '../providers/activeNode';
import { watermarkStore } from '../stores/WatermarkStore';
import { leaseStore } from '../stores/LeaseStore';
import { withSigningLock } from '../stores/signingLock';
import { TxSignLogger } from './TxLogger';
import type {
  PrepareRequest,
  PrepareResponse,
  FinalizeRequest,
  FinalizeResponse,
} from './service';

const LEASE_TTL_MS = 120_000;

function randomId(prefix: string): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return `${prefix}-${Date.now()}-${Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

function strip0x(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToHex(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytesToHex(bytes);
}

/**
 * Read the `MiniString` import id at the head of a TxnRow:
 *   uint32 big-endian length || UTF-8 id || Transaction || Witness
 */
function parseTxnRowId(txnRowHex: string): string | null {
  const clean = strip0x(txnRowHex);
  if (clean.length < 8) return null;
  const length = Number.parseInt(clean.slice(0, 8), 16);
  if (!Number.isFinite(length) || length <= 0 || length > 4096) return null;
  const idHex = clean.slice(8, 8 + length * 2);
  if (idHex.length !== length * 2) return null;
  try {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Number.parseInt(idHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function requireNode(): Promise<{ client: MinimaRpcClient; url: string }> {
  const node = await resolveActiveNodeRpc();
  if (!node) {
    throw new Error(
      'Hawk node is not configured or its URL is not consented; configure Network Settings first',
    );
  }
  return node;
}

function signedHexFrom(params: FinalizeRequest): string | null {
  if (params.signedHex && params.signedHex.length > 0) return strip0x(params.signedHex);
  if (params.signedBase64 && params.signedBase64.length > 0) return base64ToHex(params.signedBase64);
  return null;
}

export class HawkTransactionService {
  /** True when a consented local node is configured for transactions. */
  static async isAvailable(): Promise<boolean> {
    return (await resolveActiveNodeRpc()) !== null;
  }

  /**
   * Step 1: reserve local WOTS indices for the input coin's address.
   * Returns the same shape as the Axia prepare response so the caller does not
   * branch on mode.
   */
  static async prepare(params: PrepareRequest, rootPublicKey: string): Promise<PrepareResponse> {
    await requireNode();

    const addressIndex = params.addressIndex;
    if (addressIndex === null || addressIndex === undefined || !Number.isInteger(addressIndex) || addressIndex < 0) {
      throw new Error('Hawk mode requires a valid addressIndex for the input coin');
    }

    // Fail closed if the local watermark cannot be proven at least as advanced
    // as the last Axia-issued index (RFC-013 migration safety).
    const { assertHawkWatermarkSafe } = await import('../providers/watermarkSafety');
    await assertHawkWatermarkSafe();

    await watermarkStore.initialize();
    const indices = await withSigningLock(() =>
      watermarkStore.reserveNextIndicesForAddress(addressIndex),
    );
    if (!indices) {
      throw new Error(`No available signing indices for address ${addressIndex} (exhausted)`);
    }

    const leaseId = randomId('hawk-lease');
    const leaseToken = randomId('hawk-token');
    const txId = params.txId || randomId('tx');
    const now = Date.now();

    await leaseStore.save({
      leaseId,
      leaseToken,
      indices,
      expiresAt: now + LEASE_TTL_MS,
      status: 'active',
      createdAt: now,
      txId,
      leaseTTL: LEASE_TTL_MS,
    });

    TxSignLogger.info('Hawk lease reserved', {
      leaseId,
      addressIndex,
      l1: indices.l1,
      l2: indices.l2,
    });

    return {
      addressIndex,
      l1: indices.l1,
      l2: indices.l2,
      leaseToken,
      digestTx: '',
      digestL2: null,
      digestL3: null,
      txId,
      rootPublicKey,
      paramSet: 'hawk-local-v1',
      leaseId,
      leaseTTL: LEASE_TTL_MS,
    };
  }

  /**
   * Step 1.5: fetch the serialized CoinProof (Coin + MMRProof) for each input
   * from the node. `coinexport` returns it in `response.data` as `0x…` hex,
   * which is exactly the byte form the transaction builder consumes.
   */
  static async fetchCoinProofs(_leaseToken: string, coinIds: string[]): Promise<string[]> {
    const { client } = await requireNode();
    const proofs: string[] = [];

    TxSignLogger.info(`Hawk: fetching ${coinIds.length} CoinProof(s) via coinexport`);
    for (const coinId of coinIds) {
      try {
        const exported = await client.coinExport(coinId);
        const data = exported?.data;
        if (!data) {
          throw new Error(`coinexport returned no proof data for ${coinId}`);
        }
        proofs.push(strip0x(data));
      } catch (error) {
        throw new Error(
          `Failed to fetch CoinProof for ${coinId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return proofs;
  }

  /**
   * Step 5: import the signed TxnRow and mine/post it on the node.
   */
  static async finalize(params: FinalizeRequest): Promise<FinalizeResponse> {
    const { client } = await requireNode();

    const hex = signedHexFrom(params);
    if (!hex) throw new Error('finalize requires signedHex or signedBase64');

    const lease = leaseStore.getByToken(params.leaseToken);
    const leaseId = lease?.leaseId ?? params.leaseToken;
    const id = params.importId || parseTxnRowId(hex) || randomId('txn');

    // The signature exists from this point on. Never release the leaf, even if
    // the node rejects or the response is lost.
    if (lease) {
      await withSigningLock(() => watermarkStore.markUsed(lease.indices));
    }

    try {
      await client.txnImport(hex, id);
      const posted = await client.txnPost({ id, mine: true });
      const txpowid = posted?.txpowid;
      if (!txpowid) throw new Error('txnpost returned no txpowid');
      if (lease) await leaseStore.updateStatus(lease.leaseId, 'finalized');

      TxSignLogger.info('Hawk transaction finalized', { txpowid, leaseId, id });
      return { ok: true, leaseId, txpowid };
    } catch (error) {
      if (lease) await leaseStore.updateStatus(lease.leaseId, 'cancelled');
      throw error;
    }
  }

  /**
   * TOTEM_BROADCAST_HEX: submit a fully-signed TxnRow that was not assembled by
   * this wallet. No lease is involved.
   */
  static async broadcastSignedHex(signedHex: string): Promise<{ txpowid: string }> {
    const { client } = await requireNode();
    const hex = strip0x(signedHex);
    if (!hex) throw new Error('signedHex is empty');

    const id = parseTxnRowId(hex) || randomId('broadcast');

    await client.txnImport(hex, id);

    // `txncheck` is advisory: surface a clear error before spending mining work,
    // but do not block on a checker that cannot see the node's mempool state.
    try {
      await client.txnCheck(id);
    } catch (checkError) {
      const message = checkError instanceof Error ? checkError.message : String(checkError);
      if (/not found/i.test(message)) throw checkError;
      TxSignLogger.warn('Hawk: txncheck warning; continuing to txnpost', { message });
    }

    const posted = await client.txnPost({ id, mine: true });
    const txpowid = posted?.txpowid;
    if (!txpowid) throw new Error('txnpost returned no txpowid');
    return { txpowid };
  }

  /**
   * Explicitly abandon an unused reservation (e.g. the user rejected before
   * signing). Returns the slot to the reusable pool.
   */
  static async cancel(leaseToken: string): Promise<void> {
    const lease = leaseStore.getByToken(leaseToken);
    if (!lease) return;
    await withSigningLock(() => watermarkStore.releaseReservation(lease.indices));
    await leaseStore.updateStatus(lease.leaseId, 'cancelled');
  }
}
