/**
 * Totem Extension — Keyring API
 *
 * Public surface of the Totem wallet keyring exposed to dApp integrations
 * and SDK consumers. Re-exports the signing validator and security boundary
 * types used across all Totem extension code paths.
 *
 * @module
 */

export type {
  SignDataManifest,
  SignDataManifestInput,
  SignDataValidationError,
  SignDataValidationOk,
  SignDataValidationResult,
} from './core/signing/signDataValidator';

export {
  normalizeAddrToHex,
  computeManifestBlobHash,
} from './core/signing/signDataValidator';
