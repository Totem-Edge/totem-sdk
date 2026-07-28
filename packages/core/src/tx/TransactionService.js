"use strict";
/**
 * @module TransactionService
 * Handles WOTS signing flow: prepare → sign → finalize
 *
 * Platform-agnostic implementation using HttpClient adapter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionService = void 0;
const adapters_1 = require("../adapters");
class TransactionService {
    constructor(http, config, logger = new adapters_1.NoopLogger(), metrics = new adapters_1.NoopMetrics()) {
        this.http = http;
        this.config = config;
        this.logger = logger;
        this.metrics = metrics;
    }
    async prepare(params, rootPublicKey) {
        const startTime = Date.now();
        const url = `${this.config.baseUrl.replace(/\/$/, '')}/wots/hardened/prepare`;
        const txId = params.txId || `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.logger.debug('Requesting lease for transaction...');
        this.logger.debug(`  txId: ${txId}, to: ${params.to}, amount: ${params.amount}`);
        try {
            const response = await this.http.post(url, {
                txId,
                rootPublicKey,
                to: params.to,
                amount: params.amount,
                tokenId: params.tokenId || '0x00',
                burn: params.burn || null,
                paramSet: this.config.paramSet || 'minima',
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                },
            });
            const result = response.data;
            const elapsed = Date.now() - startTime;
            this.metrics.timing('tx_prepare_duration_ms', elapsed);
            this.metrics.increment('tx_prepare_success');
            this.logger.debug(`Lease acquired (${elapsed}ms)`);
            this.logger.debug(`  leaseId: ${result.leaseId}`);
            this.logger.debug(`  indices: (addressIndex=${result.addressIndex}, l1=${result.l1}, l2=${result.l2})`);
            this.logger.debug(`  TTL: ${result.leaseTTL}ms`);
            return result;
        }
        catch (error) {
            this.metrics.increment('tx_prepare_error');
            this.logger.error('Lease acquisition failed:', error);
            throw error;
        }
    }
    async sign(request, seed, deps, paramSetName = 'minima') {
        const startTime = Date.now();
        const { addressIndex, l1, l2, digestTx } = request;
        this.logger.debug('Starting on-demand key derivation...');
        this.logger.debug(`  indices: (addressIndex=${addressIndex}, l1=${l1}, l2=${l2}), paramSet: ${paramSetName}`);
        // All param set names now resolve to the same Java-compatible w=8 param set
        const paramSet = deps.defaultParamSet;
        const digestBytes = deps.fromHex(digestTx);
        if (digestBytes.length !== 32) {
            throw new Error(`Invalid digest length: ${digestBytes.length}, expected 32 bytes`);
        }
        this.logger.debug('Deriving WOTS keys from root seed...');
        const addrStart = Date.now();
        const addrSignature = deps.wotsSign(seed, addressIndex, digestBytes, paramSet);
        this.logger.debug(`  Address signed (${Date.now() - addrStart}ms)`);
        const l1Start = Date.now();
        const l1Signature = deps.wotsSign(seed, l1, digestBytes, paramSet);
        this.logger.debug(`  L1 signed (${Date.now() - l1Start}ms)`);
        const l2Start = Date.now();
        const l2Signature = deps.wotsSign(seed, l2, digestBytes, paramSet);
        this.logger.debug(`  L2 signed (${Date.now() - l2Start}ms)`);
        const L = paramSet.L;
        const toHexArray = (sig) => {
            const result = [];
            for (let i = 0; i < L; i++) {
                const chunk = sig.subarray(i * 32, (i + 1) * 32);
                result.push('0x' + this.bytesToHex(chunk));
            }
            return result;
        };
        const witnessBundle = {
            addressIndex,
            l1,
            l2,
            signatures: {
                l1Proof: toHexArray(addrSignature),
                l2Proof: toHexArray(l1Signature),
                l3Proof: toHexArray(l2Signature),
            },
        };
        const signedHex = this.serializeWitnessToHex(witnessBundle, digestTx);
        const elapsed = Date.now() - startTime;
        this.metrics.timing('tx_sign_duration_ms', elapsed);
        this.logger.debug(`Signature created (${elapsed}ms), size: ${signedHex.length} chars`);
        return { witnessBundle, signedHex };
    }
    async finalize(params) {
        const startTime = Date.now();
        const url = `${this.config.baseUrl.replace(/\/$/, '')}/wots/hardened/finalize`;
        this.logger.debug('Submitting signed transaction to network...');
        this.logger.debug(`  leaseToken: ${params.leaseToken.slice(0, 16)}...`);
        try {
            const response = await this.http.post(url, params, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                },
            });
            const result = response.data;
            const elapsed = Date.now() - startTime;
            this.metrics.timing('tx_finalize_duration_ms', elapsed);
            this.metrics.increment('tx_finalize_success');
            this.logger.debug(`Transaction finalized (${elapsed}ms)`);
            this.logger.debug(`  txpowid: ${result.txpowid}, leaseId: ${result.leaseId}`);
            return result;
        }
        catch (error) {
            this.metrics.increment('tx_finalize_error');
            this.logger.error('Finalization failed:', error);
            throw error;
        }
    }
    serializeWitnessToHex(bundle, digestHex) {
        const l1ProofHex = bundle.signatures.l1Proof.map(p => p.replace(/^0x/, '')).join('');
        const l2ProofHex = bundle.signatures.l2Proof.map(p => p.replace(/^0x/, '')).join('');
        const l3ProofHex = bundle.signatures.l3Proof.map(p => p.replace(/^0x/, '')).join('');
        const digest = digestHex.replace(/^0x/, '');
        return `0x${digest}${l1ProofHex}${l2ProofHex}${l3ProofHex}`;
    }
    bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
exports.TransactionService = TransactionService;
