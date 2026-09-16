/**
 * @module @totemsdk/storage/errors
 *
 * StorageError taxonomy. Every storage surface distinguishes absent vs broken
 * vs down:
 *   - `not-found`   — the key/artifact is absent (never a broken read)
 *   - `corrupt`     — bytes are present but invalid (unsupported format
 *                     version, bad envelope, digest mismatch). Corruption is
 *                     never collapsed into absence.
 *   - `unavailable` — the underlying store or backend cannot be reached or
 *                     failed independently of the data (I/O errors, read-only
 *                     backend, provider outage).
 *   - `write-failed`— a mutation could not be completed.
 */

export const StorageErrorCodes = [
  'not-found',
  'corrupt',
  'unavailable',
  'write-failed',
] as const;

export type StorageErrorCode = (typeof StorageErrorCodes)[number];

export interface StorageErrorDetails {
  readonly key?: string;
  readonly unsupportedVersion?: number;
  readonly detectedVersion?: number;
  readonly cause?: unknown;
}

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly key?: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: StorageErrorCode, details: StorageErrorDetails = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.key = details.key;
    const { key, ...rest } = details;
    this.details = { ...rest, ...(key !== undefined ? { key } : {}) };
  }
}

export function isStorageError(err: unknown): err is StorageError {
  return err instanceof StorageError;
}

export function asStorageError(err: unknown, fallback: StorageErrorCode = 'unavailable'): StorageError {
  if (isStorageError(err)) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new StorageError(message, fallback, { cause: err });
}