/**
 * RFC-057 Phase 5 — encrypted dataset envelopes and replication quotas.
 *
 * Encryption is explicit per dataset and never inferred from a key path. The
 * envelope carries its own version and IV; quotas are enforced before a write
 * reaches the log or view.
 */

export interface ReplicatedCipher {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}

const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('WebCrypto subtle is unavailable');
  return c.subtle;
}

export async function createAesGcmDatasetCipher(key: Uint8Array): Promise<ReplicatedCipher> {
  if (key.length !== 32) throw new Error('AES-256-GCM dataset key must be 32 bytes');
  const cryptoKey = await subtle().importKey('raw', key as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return {
    async encrypt(plaintext) {
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const ciphertext = new Uint8Array(
        await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, plaintext as BufferSource),
      );
      const envelope = new Uint8Array(1 + IV_BYTES + ciphertext.length);
      envelope[0] = ENVELOPE_VERSION;
      envelope.set(iv, 1);
      envelope.set(ciphertext, 1 + IV_BYTES);
      return envelope;
    },
    async decrypt(envelope) {
      if (envelope.length <= 1 + IV_BYTES || envelope[0] !== ENVELOPE_VERSION) {
        throw new Error('unsupported encrypted dataset envelope');
      }
      const iv = envelope.slice(1, 1 + IV_BYTES);
      const ciphertext = envelope.slice(1 + IV_BYTES);
      return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, ciphertext as BufferSource));
    },
  };
}

export interface ReplicationQuotaPolicy {
  readonly maxBytes: number;
  readonly maxRecords: number;
}

export class ReplicationQuotaExceededError extends Error {
  readonly code = 'quota-exceeded' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ReplicationQuotaExceededError';
  }
}

/** Process-local quota accounting; callers persist consumption with the store. */
export class ReplicationQuota {
  private bytes = 0;
  private records = 0;

  constructor(private readonly policy: ReplicationQuotaPolicy) {}

  consume(bytes: number, records = 1): void {
    if (bytes < 0 || records < 0) throw new Error('quota consumption must be non-negative');
    if (this.bytes + bytes > this.policy.maxBytes || this.records + records > this.policy.maxRecords) {
      throw new ReplicationQuotaExceededError(
        `replication quota exceeded: ${this.bytes + bytes}/${this.policy.maxBytes} bytes, ` +
          `${this.records + records}/${this.policy.maxRecords} records`,
      );
    }
    this.bytes += bytes;
    this.records += records;
  }

  get usedBytes(): number {
    return this.bytes;
  }

  get usedRecords(): number {
    return this.records;
  }

  reset(): void {
    this.bytes = 0;
    this.records = 0;
  }
}
