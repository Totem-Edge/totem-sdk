/**
 * @module TransactionService
 * Handles WOTS signing flow: prepare → sign → finalize
 *
 * Platform-agnostic implementation using HttpClient adapter.
 *
 * Sign architecture (2026-02): uses per-address TreeKey (depth=3, keysPerLevel=64)
 * matching Minima Wallet.java exactly. Each address has its own TreeKey derived
 * from the wallet seed. Signing produces 3 proofs (Root→L1→L2→DATA).
 */

import type { HttpClient, LoggerAdapter, MetricsAdapter } from '../adapters/index.js';
import { NoopLogger, NoopMetrics } from '../adapters/index.js';
import { createUnifiedChildTreeKey, serializeTreeSignature } from '../treekey.js';
import { serializeMMRProof } from '../mmr.js';
import { fromHex } from '../wots.js';
import type {
  PrepareRequest,
  PrepareResponse,
  SignRequest,
  SignResult,
  HierarchicalWitnessBundle,
  FinalizeRequest,
  FinalizeResponse,
} from './types.js';

export interface TransactionServiceConfig {
  baseUrl: string;
  apiKey: string;
  paramSet?: string;
}

/**
 * @deprecated WotsSigningDependencies is no longer used by TransactionService.sign().
 * The service now derives everything from the seed and indices directly using
 * the built-in TreeKey implementation. This interface is kept for backward compatibility
 * only and will be removed in a future version.
 */
export interface WotsSigningDependencies {
  wotsSign?: (seed: Uint8Array, index: number, message: Uint8Array, paramSet: any) => Uint8Array;
  fromHex?: (hex: string) => Uint8Array;
  getParamSet?: (name: string) => any;
  defaultParamSet?: any;
}

export class TransactionService {
  private readonly http: HttpClient;
  private readonly logger: LoggerAdapter;
  private readonly metrics: MetricsAdapter;
  private readonly config: TransactionServiceConfig;

  constructor(
    http: HttpClient,
    config: TransactionServiceConfig,
    logger: LoggerAdapter = new NoopLogger(),
    metrics: MetricsAdapter = new NoopMetrics()
  ) {
    this.http = http;
    this.config = config;
    this.logger = logger;
    this.metrics = metrics;
  }

  async prepare(params: PrepareRequest, rootPublicKey: string): Promise<PrepareResponse> {
    const startTime = Date.now();
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/v1/wots-hardened/prepare`;
    const txId = params.txId || `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.logger.debug('Requesting lease for transaction...');
    this.logger.debug(`  txId: ${txId}, to: ${params.to}, amount: ${params.amount}`);

    if (typeof params.addressIndex !== 'number' || params.addressIndex < 0 || params.addressIndex >= 64) {
      throw new Error('params.addressIndex is required and must be 0-63');
    }

    try {
      const response = await this.http.post<PrepareResponse>(url, {
        txId,
        rootPublicKey,
        to: params.to,
        amount: params.amount,
        tokenId: params.tokenId || '0x00',
        burn: params.burn || null,
        paramSet: this.config.paramSet || 'v2-spec',
        addressIndex: params.addressIndex,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
      });

      if (response.status === 429) {
        const body = response.data as any;
        const err: any = new Error(body?.error || 'Daily signing limit reached');
        err.code = 429;
        err.limit = body?.limit;
        err.used = body?.used;
        err.retryAfter = body?.retryAfter;
        throw err;
      }

      if (!response.ok) {
        const body = response.data as any;
        const msg = body?.error || body?.message || `HTTP ${response.status}`;
        const err: any = new Error(msg);
        err.code = response.status;
        throw err;
      }

      const result = response.data;
      const elapsed = Date.now() - startTime;
      this.metrics.timing('tx_prepare_duration_ms', elapsed);
      this.metrics.increment('tx_prepare_success');

      this.logger.debug(`Lease acquired (${elapsed}ms)`);
      this.logger.debug(`  leaseId: ${result.leaseId}`);
      this.logger.debug(`  indices: (addressIndex=${result.addressIndex}, l1=${result.l1}, l2=${result.l2})`);
      this.logger.debug(`  TTL: ${result.leaseTTL}ms`);

      return result;
    } catch (error: any) {
      if (error.code === 429 || error.code === 400 || error.code === 403 || error.code === 409) {
        throw error;
      }
      this.metrics.increment('tx_prepare_error');
      this.logger.error('Lease acquisition failed:', error);
      throw error;
    }
  }

  /**
   * Sign a transaction using per-address TreeKey architecture.
   *
   * Produces 3 proofs (Root→L1→L2→DATA) matching Minima's TreeKey.sign() exactly.
   *
   * @param request    - Indices and digestTx from the /prepare response
   * @param seed       - 32-byte wallet base seed (from mnemonic)
   * @param _deps      - Deprecated, unused. Pass null or omit.
   * @param _paramSet  - Deprecated, unused. TreeKey uses its own param set.
   */
  async sign(
    request: SignRequest,
    seed: Uint8Array,
    _deps?: WotsSigningDependencies | null,
    _paramSet?: string
  ): Promise<SignResult> {
    const startTime = Date.now();
    const { addressIndex, l1, l2, digestTx } = request;

    this.logger.debug('Starting per-address TreeKey signing...');
    this.logger.debug(`  indices: (addressIndex=${addressIndex}, l1=${l1}, l2=${l2})`);

    if (addressIndex < 0 || addressIndex >= 64) {
      throw new Error(`Invalid addressIndex: ${addressIndex}. Must be 0-63.`);
    }

    const digestBytes = fromHex(digestTx);
    if (digestBytes.length !== 32) {
      throw new Error(`Invalid digest length: ${digestBytes.length}, expected 32 bytes`);
    }

    // Derive unified child TreeKey for this address index
    this.logger.debug(`  Deriving unified child TreeKey for index ${addressIndex}...`);
    const treeKey = createUnifiedChildTreeKey(seed, addressIndex);

    // Convert (l1, l2) to Java-compatible 'uses' counter
    // Java's TreeKey.sign() uses baseConversion(uses) to compute path
    const KEYS_PER_LEVEL = 64;
    const uses = l1 * KEYS_PER_LEVEL + l2;
    this.logger.debug(`  Converting indices to uses: (l1=${l1}, l2=${l2}) → uses=${uses}`);

    // setUses() + sign() matches Java pattern: tk.setUses(uses) → tk.sign(zData)
    treeKey.setUses(uses);
    const treeSignature = treeKey.sign(digestBytes);
    const newUses = treeKey.getUses();

    this.logger.debug(`  TreeKey signing complete, proofs: ${treeSignature.proofs.length}, newUses: ${newUses}`);

    // Build HierarchicalWitnessBundle with unified naming
    const treeKeyPubkey = treeKey.getPublicKey();
    const witnessBundle: HierarchicalWitnessBundle = {
      addressIndex,
      l1,
      l2,
      rootPublicKey: `0x${this.bytesToHex(treeKeyPubkey)}`,
      proofs: treeSignature.proofs.map((proof: any) => ({
        leafPubkey: `0x${this.bytesToHex(proof.leafPubkey)}`,
        signature: `0x${this.bytesToHex(proof.signature)}`,
        mmrProof: `0x${this.bytesToHex(serializeMMRProof(proof.mmrProof))}`,
      })),
    };

    // Serialize to byte-exact Java-compatible wire format
    const serializedBytes = serializeTreeSignature(treeSignature);
    const signedHex = `0x${this.bytesToHex(serializedBytes)}`;

    const elapsed = Date.now() - startTime;
    this.metrics.timing('tx_sign_duration_ms', elapsed);
    this.logger.debug(`Signature created (${elapsed}ms), serialized: ${serializedBytes.length} bytes`);

    return { witnessBundle, signedHex };
  }

  async finalize(params: FinalizeRequest): Promise<FinalizeResponse> {
    const startTime = Date.now();
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/v1/wots-hardened/finalize`;

    this.logger.debug('Submitting signed transaction to network...');
    this.logger.debug(`  leaseToken: ${params.leaseToken.slice(0, 16)}...`);

    try {
      const response = await this.http.post<FinalizeResponse>(url, params, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const body = response.data as any;
        const msg = body?.error || body?.message || `HTTP ${response.status}`;
        const err: any = new Error(msg);
        err.code = response.status;
        throw err;
      }

      const result = response.data;
      const elapsed = Date.now() - startTime;
      this.metrics.timing('tx_finalize_duration_ms', elapsed);
      this.metrics.increment('tx_finalize_success');

      this.logger.debug(`Transaction finalized (${elapsed}ms)`);
      this.logger.debug(`  txpowid: ${result.txpowid}, leaseId: ${result.leaseId}`);

      return result;
    } catch (error: any) {
      if (error.code !== undefined) throw error;
      this.metrics.increment('tx_finalize_error');
      this.logger.error('Finalization failed:', error);
      throw error;
    }
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
