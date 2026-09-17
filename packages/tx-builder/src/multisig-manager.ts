import { sha3_256, wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import { randomBytes } from 'node:crypto';
import type {
  ScriptDescriptor,
  ExternalSignature,
  MMRProof
} from './types.js';
import {
  createMultisigDescriptor,
  createMofNMultisigDescriptor
} from '@totemsdk/core/scripts';
import type { StoragePort } from './adapters.js';

const PENDING_MULTISIG_KEY = 'totem_pending_multisig';

/**
 * On-disk record format version. Signing-pending multisig state is valuable:
 * opening a record with an unsupported or ambiguous version refuses to open
 * (never silently reinitialises); the legacy pre-G10 shape (`{ transactions }`,
 * no version) is migrated through a declared path.
 */
const MULTISIG_RECORD_VERSION = 1;

/** Local storage error so corruption is surfaced, never treated as absence. */
export class MultisigStorageError extends Error {
  readonly code: 'corrupt' | 'unsupported-version';
  constructor(code: 'corrupt' | 'unsupported-version', message: string) {
    super(message);
    this.name = 'MultisigStorageError';
    this.code = code;
  }
}

export interface MultisigConfig {
  type: '2of2' | 'mofn';
  threshold: number;
  publicKeys: string[];
  ownPublicKey: string;
  address?: string;
}

export interface PendingMultisigTransaction {
  id: string;
  config: MultisigConfig;
  transactionHex: string;
  transactionDigest: string;
  signatures: Map<string, ExternalSignature>;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'ready' | 'broadcast' | 'expired' | 'failed';
}

export interface MultisigExportData {
  version: number;
  id: string;
  config: MultisigConfig;
  transactionHex: string;
  transactionDigest: string;
  signatures: Array<{
    publicKey: string;
    signature: string;
    signatureType: 'wots' | 'standard';
  }>;
  createdAt: number;
}

function generateTransactionId(): string {
  const bytes = randomBytes(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function verifyWotsSignature(signatureHex: string, digestHex: string, publicKeyHex: string): boolean {
  try {
    const sig = hexToBytes(signatureHex);
    const digest = hexToBytes(digestHex);
    const pkd = hexToBytes(publicKeyHex);
    return wotsVerifyDigest(sig, digest, pkd);
  } catch {
    return false;
  }
}

function recomputeDigest(transactionHex: string): string {
  const txBytes = hexToBytes(transactionHex);
  return Array.from(sha3_256(txBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class MultisigManager {
  private pendingTransactions: Map<string, PendingMultisigTransaction> = new Map();
  readonly ready: Promise<void>;
  private storage: StoragePort | null;
  
  constructor(storage?: StoragePort) {
    this.storage = storage || null;
    this.ready = this.load();
  }
  
  /**
   * Load pending transactions from the durable record.
   *
   * Format detection (RFC-007 §4.2): the record carries an explicit version.
   * - `{ version: 1, transactions }` — supported, opened as-is.
   * - `{ transactions }` (no version) — legacy pre-G10 shape, migrated by
   *   rewriting it under the versioned envelope (never silently dropped).
   * - any other version or an unrecognisable shape — **refuses to open**:
   *   valuable signing state is never silently reinitialised or treated as
   *   an empty store.
   */
  private async load(): Promise<void> {
    if (!this.storage) return;
    const data = await this.storage.get<unknown>(PENDING_MULTISIG_KEY);
    if (data === null || data === undefined) return;

    let raw = data as { version?: unknown; transactions?: unknown };
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new MultisigStorageError('corrupt', 'multisig record is not an object');
    }

    let transactions: unknown[];
    let migrated = false;
    if (raw.version === undefined) {
      if (!Array.isArray(raw.transactions)) {
        throw new MultisigStorageError(
          'corrupt',
          'multisig record has no version and no legacy transactions array',
        );
      }
      // Legacy pre-G10 shape: migrate to the versioned envelope.
      transactions = raw.transactions;
      migrated = true;
    } else {
      const version = raw.version;
      if (typeof version !== 'number' || version !== MULTISIG_RECORD_VERSION) {
        throw new MultisigStorageError(
          'unsupported-version',
          `multisig record version ${String(version)} unsupported (this build supports up to ${MULTISIG_RECORD_VERSION}) — refusing to open`,
        );
      }
      if (!Array.isArray(raw.transactions)) {
        throw new MultisigStorageError('corrupt', 'multisig record has no transactions array');
      }
      transactions = raw.transactions;
    }

    try {
      for (const tx of transactions) {
        if (typeof tx !== 'object' || tx === null || Array.isArray(tx)) {
          throw new MultisigStorageError('corrupt', 'multisig transaction entry is not an object');
        }
        const record = tx as Record<string, unknown>;
        if (typeof record.signatures === 'object' && record.signatures !== null) {
          record.signatures = new Map(Object.entries(record.signatures as Record<string, unknown>));
        }
        this.pendingTransactions.set(String(record.id), record as unknown as PendingMultisigTransaction);
      }
      // Persist a migrated legacy record so a subsequent open is clean v1.
      if (migrated) await this.save();
    } catch (err) {
      if (err instanceof MultisigStorageError) throw err;
      throw new MultisigStorageError('corrupt', `multisig record failed to load: ${(err as Error).message}`);
    }
  }
  
  private async save(): Promise<void> {
    if (!this.storage) return;
    const transactions = Array.from(this.pendingTransactions.values()).map(tx => ({
      ...tx,
      // Canonical form: drop absent optional fields (e.g. `proof`) so strict
      // codecs (FileStore) do not reject the record for `undefined` values.
      signatures: Object.fromEntries(
        Array.from(tx.signatures.entries()).map(([key, sig]) => [
          key,
          Object.fromEntries(Object.entries(sig).filter(([, value]) => value !== undefined)),
        ]),
      ),
    }));
    await this.storage.set(PENDING_MULTISIG_KEY, {
      version: MULTISIG_RECORD_VERSION,
      transactions,
    });
  }
  
  createMultisigScript(config: MultisigConfig): ScriptDescriptor {
    if (config.type === '2of2') {
      if (config.publicKeys.length !== 2) {
        throw new Error('2-of-2 multisig requires exactly 2 public keys');
      }
      return createMultisigDescriptor(
        config.address || '',
        config.publicKeys[0],
        config.publicKeys[1],
        config.ownPublicKey
      );
    } else {
      return createMofNMultisigDescriptor(
        config.address || '',
        config.threshold,
        config.publicKeys,
        config.ownPublicKey
      );
    }
  }
  
  computeMultisigAddress(config: MultisigConfig): string {
    const descriptor = this.createMultisigScript(config);
    const scriptBytes = new TextEncoder().encode(descriptor.script.trim().toUpperCase());
    const hashBytes = sha3_256(scriptBytes);
    return '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  async createPendingTransaction(
    config: MultisigConfig,
    transactionHex: string,
    transactionDigest: string,
    expirationHours: number = 24
  ): Promise<PendingMultisigTransaction> {
    await this.ready;
    const id = generateTransactionId();
    
    const tx: PendingMultisigTransaction = {
      id,
      config,
      transactionHex,
      transactionDigest,
      signatures: new Map(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (expirationHours * 60 * 60 * 1000),
      status: 'pending'
    };
    
    this.pendingTransactions.set(id, tx);
    await this.save();
    
    return tx;
  }
  
  async addOwnSignature(
    transactionId: string,
    signature: string,
    proof?: MMRProof
  ): Promise<void> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (tx.status === 'expired' || tx.status === 'failed') {
      throw new Error(`Transaction ${transactionId} is ${tx.status}`);
    }

    const signingPublicKey = tx.config.ownPublicKey;
    const valid = verifyWotsSignature(signature, tx.transactionDigest, signingPublicKey);

    const extSig: ExternalSignature = {
      publicKey: signingPublicKey,
      signature,
      proof,
      signatureType: 'wots',
      validated: valid
    };

    tx.signatures.set(signingPublicKey.toLowerCase(), extSig);
    this.updateStatus(tx);
    await this.save();
  }
  
  async importExternalSignature(
    transactionId: string,
    publicKey: string,
    signature: string,
    signatureType: 'wots' | 'standard' = 'wots',
    proof?: MMRProof
  ): Promise<{ valid: boolean; error?: string }> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      return { valid: false, error: `Transaction ${transactionId} not found` };
    }
    
    if (tx.status === 'expired' || tx.status === 'failed') {
      return { valid: false, error: `Transaction ${transactionId} is ${tx.status}` };
    }
    
    const normalizedKey = publicKey.toLowerCase();
    const isValidSigner = tx.config.publicKeys.some(
      pk => pk.toLowerCase() === normalizedKey
    );
    
    if (!isValidSigner) {
      return { valid: false, error: 'Public key is not a valid signer for this transaction' };
    }

    const verified = signatureType === 'wots'
      ? verifyWotsSignature(signature, tx.transactionDigest, publicKey)
      : false;

    if (!verified) {
      return { valid: false, error: 'Signature verification failed' };
    }
    
    const extSig: ExternalSignature = {
      publicKey,
      signature,
      proof,
      signatureType,
      validated: true
    };
    
    tx.signatures.set(normalizedKey, extSig);
    this.updateStatus(tx);
    await this.save();
    
    return { valid: true };
  }
  
  private updateStatus(tx: PendingMultisigTransaction): void {
    if (Date.now() > tx.expiresAt) {
      tx.status = 'expired';
      return;
    }
    
    const signatureCount = tx.signatures.size;
    const requiredCount = tx.config.threshold;
    
    if (signatureCount >= requiredCount) {
      tx.status = 'ready';
    } else {
      tx.status = 'pending';
    }
  }
  
  async getSignatures(transactionId: string): Promise<ExternalSignature[]> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      return [];
    }
    return Array.from(tx.signatures.values());
  }
  
  async isReady(transactionId: string): Promise<boolean> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) return false;
    
    this.updateStatus(tx);
    return tx.status === 'ready';
  }
  
  async getSignatureStatus(transactionId: string): Promise<{
    required: number;
    collected: number;
    missing: string[];
    status: string;
  }> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      return { required: 0, collected: 0, missing: [], status: 'not_found' };
    }
    
    this.updateStatus(tx);
    
    const collected = tx.signatures.size;
    const required = tx.config.threshold;
    const missing: string[] = [];
    
    for (const pk of tx.config.publicKeys) {
      if (!tx.signatures.has(pk.toLowerCase())) {
        missing.push(pk);
      }
    }
    
    return {
      required,
      collected,
      missing,
      status: tx.status
    };
  }
  
  async exportTransaction(transactionId: string): Promise<MultisigExportData> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    return {
      version: 1,
      id: tx.id,
      config: tx.config,
      transactionHex: tx.transactionHex,
      transactionDigest: tx.transactionDigest,
      signatures: Array.from(tx.signatures.values()).map(sig => ({
        publicKey: sig.publicKey,
        signature: sig.signature,
        signatureType: sig.signatureType
      })),
      createdAt: tx.createdAt
    };
  }
  
  async importTransaction(data: MultisigExportData): Promise<PendingMultisigTransaction> {
    await this.ready;
    const existing = this.pendingTransactions.get(data.id);
    if (existing) {
      for (const sig of data.signatures) {
        if (!existing.signatures.has(sig.publicKey.toLowerCase())) {
          await this.importExternalSignature(
            data.id,
            sig.publicKey,
            sig.signature,
            sig.signatureType
          );
        }
      }
      return existing;
    }

    const recomputedDigest = recomputeDigest(data.transactionHex);
    if (recomputedDigest !== data.transactionDigest) {
      throw new Error('Imported transaction digest does not match transactionHex');
    }
    
    const tx: PendingMultisigTransaction = {
      id: data.id,
      config: data.config,
      transactionHex: data.transactionHex,
      transactionDigest: data.transactionDigest,
      signatures: new Map(),
      createdAt: data.createdAt,
      expiresAt: data.createdAt + (24 * 60 * 60 * 1000),
      status: 'pending'
    };
    
    for (const sig of data.signatures) {
      const verified = sig.signatureType === 'wots'
        ? verifyWotsSignature(sig.signature, data.transactionDigest, sig.publicKey)
        : false;
      tx.signatures.set(sig.publicKey.toLowerCase(), {
        publicKey: sig.publicKey,
        signature: sig.signature,
        signatureType: sig.signatureType,
        validated: verified
      });
    }
    
    this.updateStatus(tx);
    this.pendingTransactions.set(data.id, tx);
    await this.save();
    
    return tx;
  }
  
  async markBroadcast(transactionId: string): Promise<void> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (tx) {
      tx.status = 'broadcast';
      await this.save();
    }
  }
  
  async markFailed(transactionId: string, error?: string): Promise<void> {
    await this.ready;
    const tx = this.pendingTransactions.get(transactionId);
    if (tx) {
      tx.status = 'failed';
      await this.save();
    }
  }
  
  async getTransaction(transactionId: string): Promise<PendingMultisigTransaction | undefined> {
    await this.ready;
    return this.pendingTransactions.get(transactionId);
  }
  
  async getAllPending(): Promise<PendingMultisigTransaction[]> {
    await this.ready;
    const now = Date.now();
    const result: PendingMultisigTransaction[] = [];
    
    for (const tx of this.pendingTransactions.values()) {
      if (tx.expiresAt < now) {
        tx.status = 'expired';
      }
      if (tx.status === 'pending' || tx.status === 'ready') {
        result.push(tx);
      }
    }
    
    return result;
  }
  
  async cleanupExpired(): Promise<number> {
    await this.ready;
    const now = Date.now();
    let removed = 0;
    
    for (const [id, tx] of this.pendingTransactions) {
      if (tx.expiresAt < now || tx.status === 'broadcast' || tx.status === 'failed') {
        this.pendingTransactions.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      await this.save();
    }
    
    return removed;
  }
  
  async deleteTransaction(transactionId: string): Promise<boolean> {
    await this.ready;
    const deleted = this.pendingTransactions.delete(transactionId);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }
}
