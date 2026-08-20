/**
 * OnchainWatermarkProvider — Layer 5: on-chain watermark anchoring.
 *
 * Safety model
 * ────────────
 * The local provider remains the authoritative watermark. This provider adds
 * a verifiable public record: a dedicated watermark coin whose STATE(0) holds
 * the flat watermark cursor. Every publish spends the coin back to itself
 * with an advanced cursor, so any third party can read the on-chain state and
 * prove that a given signing slot was consumed — without trusting this device.
 *
 * The watermark coin script is `RETURN SIGNEDBY(0x<digest>)` — the same
 * single-sig pattern used by statechain reclaim addresses. The signer is the
 * WOTS key owner; the digest is the 32-byte public key digest.
 *
 * Failure semantics
 * ─────────────────
 * - publishWatermark fails loudly (OnchainWatermarkError) when the chain
 *   rejects the TX — the local watermark is never rolled back.
 * - syncLeaseJournal merges the on-chain cursor into the local watermark
 *   monotonically (remote ahead → advance; remote behind → conflict record).
 */

import type {
  WotsLeaseProvider,
  ReserveParams,
  LeaseReservation,
  LeaseCertificate,
  LocalWatermark,
  SyncResult,
  OnchainWatermarkProviderConfig,
} from './types.js';
import type { LocalLeaseProvider } from './local.js';
import { flatIndex } from './watermark.js';
import { OnchainWatermarkError } from './errors.js';
import {
  sha3_256,
  bytesToHex,
  hexToBytes,
  parseMxAddress,
  serializeTransaction,
  computeTransactionDigest,
  precomputeTransactionCoinID,
  writeMiniNumber,
} from '@totemsdk/core';
import { serializeTxPoW } from '@totemsdk/txpow';
import { signCertificate, certificateSignatureVerified } from './certificate.js';

const MAX_L = 64;
const WATERMARK_COIN_STORAGE_KEY = 'wots-lease:onchain:watermark-coin';

function multiConcat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 0) return new Uint8Array(0);
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = concatBytes(result, parts[i]);
  }
  return result;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function addressToHex(address: string): string {
  const upper = address.startsWith('0x') || address.startsWith('0X') ? address.slice(2) : address;
  return upper.toUpperCase().startsWith('MX')
    ? bytesToHex(parseMxAddress(address))
    : address.replace(/^0x/i, '');
}

function flatToHex(flat: number): string {
  let hex = BigInt(flat).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex || '00';
}

function hexToFlat(hex: string): number {
  const clean = (hex.startsWith('0x') ? hex.slice(2) : hex).replace(/^0+/, '') || '0';
  return Number(BigInt('0x' + clean));
}

interface CoinStateEntry {
  port: number;
  data?: string;
  value?: string | number | bigint;
  type?: string;
}

function readStateCursor(state: unknown[], statePort: number): number | null {
  for (const raw of state) {
    const entry = raw as CoinStateEntry;
    if (typeof entry !== 'object' || entry === null) continue;
    if (entry.port !== statePort) continue;
    if (typeof entry.data === 'string') return hexToFlat(entry.data);
    if (entry.value !== undefined) return Number(entry.value);
  }
  return null;
}

function stateVarJson(port: number, hexValue: string): { port: number; svtype: string; data: string } {
  return { port, svtype: 'hex', data: hexValue };
}

function buildWitnessBytes(sigs: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [writeMiniNumber(BigInt(sigs.length), 0)];
  for (const sig of sigs) parts.push(sig);
  parts.push(writeMiniNumber(0n, 0));
  parts.push(writeMiniNumber(0n, 0));
  return multiConcat(parts);
}

export class OnchainWatermarkProvider implements WotsLeaseProvider {
  private readonly chain: OnchainWatermarkProviderConfig['chain'];
  private readonly initialWatermarkCoinId: string;
  private currentCoinId: string;
  private readonly watermarkAddress: string;
  private readonly tokenId: string;
  private readonly amount: string;
  private readonly local: LocalLeaseProvider;
  private readonly signer: OnchainWatermarkProviderConfig['signer'];
  private readonly statePort: number;
  private readonly minBlocksBetweenPublishes: number;
  private readonly storage?: OnchainWatermarkProviderConfig['storage'];
  private _initialized = false;
  private _lastPublishBlock = -1;

  constructor(config: OnchainWatermarkProviderConfig) {
    this.chain = config.chain;
    this.initialWatermarkCoinId = config.watermarkCoinId;
    this.currentCoinId = config.watermarkCoinId;
    this.watermarkAddress = config.watermarkAddress;
    this.tokenId = config.tokenId ?? '0x00';
    this.amount = config.amount ?? '1';
    this.local = config.local;
    this.signer = config.signer;
    this.statePort = config.statePort ?? 0;
    this.minBlocksBetweenPublishes = config.minBlocksBetweenPublishes ?? 1;
    this.storage = config.storage;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    // Recover the advanced watermark coin identity across restarts.
    if (this.storage) {
      try {
        const saved = await this.storage.get<{ coinId: string; lastPublishBlock: number }>(
          WATERMARK_COIN_STORAGE_KEY,
        );
        if (saved?.coinId) this.currentCoinId = saved.coinId;
        if (typeof saved?.lastPublishBlock === 'number') {
          this._lastPublishBlock = saved.lastPublishBlock;
        }
      } catch {
        // Storage unavailable — fall back to the configured coin.
      }
    }
    await this.local.initialize();
    this._initialized = true;
  }

  private async ensureInit(): Promise<void> {
    if (!this._initialized) await this.initialize();
  }

  // -------------------------------------------------------------------------
  // Reserve / commit / burn — local authoritative
  // -------------------------------------------------------------------------

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    await this.ensureInit();
    const reservation = await this.local.reserveKeyUse(params);
    const certificate: LeaseCertificate = {
      reservationId: reservation.reservationId,
      treeId: params.treeId,
      branchId: params.branchId,
      deviceId: params.deviceId,
      indices: reservation.indices,
      purpose: params.purpose,
      payloadHash: params.payloadHash,
      issuedBy: 'onchain-watermark',
      issuedAt: Date.now(),
      expiresAt: reservation.expiresAt,
      signature: '',
    };
    certificate.signature = await signCertificate(this.signer, certificate);
    return { ...reservation, certificate };
  }

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    await this.ensureInit();
    await this.local.commitKeyUse(reservationId, txId);
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    await this.ensureInit();
    await this.local.burnReservation(reservationId, reason);
  }

  // -------------------------------------------------------------------------
  // Watermark — local read, on-chain publish
  // -------------------------------------------------------------------------

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    await this.ensureInit();
    return this.local.getLocalWatermark(treeId);
  }

  /**
   * Publish the local watermark cursor on-chain by spending the watermark
   * coin back to itself with STATE(statePort) = flat cursor.
   *
   * Rate-limited by minBlocksBetweenPublishes using the chain tip.
   */
  async publishWatermark(treeId: string): Promise<void> {
    await this.ensureInit();

    const wm = await this.local.getLocalWatermark(treeId);
    const newFlat = flatIndex({
      addressIndex: wm.addressCursor,
      l1: wm.l1Cursor,
      l2: wm.l2Cursor,
    });

    // Rate limit: skip when the last publish was too recent.
    try {
      const tip = await (this.chain as { getTip?: () => Promise<{ block: number }> }).getTip?.();
      if (tip && this._lastPublishBlock >= 0 && tip.block - this._lastPublishBlock < this.minBlocksBetweenPublishes) {
        return;
      }
      if (tip) this._lastPublishBlock = tip.block;
    } catch {
      // Tip unavailable — proceed without rate limiting.
    }

    // Read the current on-chain cursor so the input state matches the coin
    // anchored by the CURRENT watermark coin (which advances on every spend).
    const coin = await this.chain.getCoin(this.currentCoinId);
    if (!coin) {
      throw new OnchainWatermarkError(`Watermark coin not found: ${this.currentCoinId}`);
    }

    const currentState = coin.state ?? [];
    const currentFlat = readStateCursor(currentState, this.statePort);
    if (currentFlat !== null && currentFlat >= newFlat) {
      // On-chain cursor already at or ahead of local — nothing to publish.
      return;
    }

    const inputCoin = {
      coinid: this.currentCoinId,
      address: addressToHex(this.watermarkAddress),
      amount: this.amount,
      tokenid: this.tokenId,
      storestate: true,
      state: currentState,
    };
    const outputCoin = {
      address: addressToHex(this.watermarkAddress),
      amount: this.amount,
      tokenid: this.tokenId,
      storestate: true,
      state: [stateVarJson(this.statePort, flatToHex(newFlat))],
    };

    const tx = {
      linkhash: '0x00',
      inputs: [inputCoin],
      outputs: [outputCoin],
      state: [],
    };

    const txBytes = serializeTransaction(JSON.stringify(tx));
    precomputeTransactionCoinID(txBytes, 0);
    const digest = computeTransactionDigest(txBytes);
    const sig = await this.signer.sign(digest);

    const witnessBytes = buildWitnessBytes([sig]);
    const prng = sha3_256(
      new TextEncoder().encode(`watermark:${treeId}:${this.currentCoinId}:${newFlat}`),
    );
    const txHex = Buffer.from(serializeTxPoW(txBytes, witnessBytes, { prng })).toString('hex');

    const result = await this.chain.broadcastTxPoW(txHex);
    if (!result.success) {
      throw new OnchainWatermarkError(
        `Watermark publish rejected: ${result.message ?? 'unknown error'}`,
      );
    }

    // Rollover: the spent watermark coin is destroyed and replaced by a fresh
    // coin with a new coin ID (output 0 of this spend). Track and persist the
    // ADVANCED identity so the next publish spends the live coin, not the
    // consumed one.
    const newCoinId = '0x' + bytesToHex(
      precomputeTransactionCoinID(hexToBytes(this.currentCoinId), 0),
    );
    this.currentCoinId = newCoinId;
    if (this.storage) {
      try {
        await this.storage.set(WATERMARK_COIN_STORAGE_KEY, {
          coinId: newCoinId,
          lastPublishBlock: this._lastPublishBlock,
        });
      } catch {
        // Storage unavailable — in-memory rollover still applies this session.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Sync — merge on-chain cursor into local watermark
  // -------------------------------------------------------------------------

  async syncLeaseJournal(): Promise<SyncResult> {
    await this.ensureInit();
    const conflicts: SyncResult['conflicts'] = [];
    let advancedTo: SyncResult['advancedTo'];

    for (const treeId of this.local.listTrees()) {
      const localWm = await this.local.getLocalWatermark(treeId);
      const localFlat = flatIndex({
        addressIndex: localWm.addressCursor,
        l1: localWm.l1Cursor,
        l2: localWm.l2Cursor,
      });

      let onchainFlat: number | null = null;
      try {
        const coin = await this.chain.getCoin(this.currentCoinId);
        if (coin) onchainFlat = readStateCursor(coin.state ?? [], this.statePort);
      } catch {
        // Chain unreachable — skip.
      }

      if (onchainFlat === null) continue;

      if (onchainFlat > localFlat) {
        const addressIndex = Math.floor(onchainFlat / (MAX_L * MAX_L));
        const rem = onchainFlat % (MAX_L * MAX_L);
        const l1 = Math.floor(rem / MAX_L);
        const l2 = rem % MAX_L;
        const advanced = await this.local.advanceToRemoteWatermark(treeId, {
          addressCursor: addressIndex,
          l1Cursor: l1,
          l2Cursor: l2,
        });
        if (advanced) {
          advancedTo = { addressIndex, l1, l2 };
        }
      } else if (onchainFlat < localFlat) {
        conflicts.push({
          treeId,
          localIndex: localFlat,
          remoteIndex: onchainFlat,
          timestamp: Date.now(),
        });
      }
    }

    return { synced: conflicts.length === 0, conflicts, advancedTo };
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (!cert) return false;
    if (cert.expiresAt <= Date.now()) return false;
    if (!(await certificateSignatureVerified(cert, this.signer))) return false;
    return cert.issuedBy === 'onchain-watermark';
  }
}
