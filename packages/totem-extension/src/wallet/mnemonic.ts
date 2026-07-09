/**
 * Minima-Compatible BIP39 Mnemonic Handling
 * 
 * IMPORTANT: This uses Minima's BIP39 implementation, NOT standard BIP39!
 * - No PBKDF2 key derivation
 * - No passphrase support
 * - Direct SHA3-256 hash of the normalized phrase
 * 
 * TOTEM WALLET REQUIREMENT: ONLY 24-word mnemonics (256-bit entropy)
 * for quantum-resistant security. 12 and 18-word mnemonics are REJECTED.
 */

import {
  cleanSeedPhrase,
  validatePhrase,
  convertStringToSeed,
  generateWordList,
  phraseToSeed
} from '@totemsdk/core';

/**
 * Generate a new 24-word mnemonic phrase
 * Returns uppercase, space-separated words matching Minima format
 */
export function generateMnemonic(): string {
  const words = generateWordList();
  return words.join(' ').toUpperCase();
}

/**
 * Validate a mnemonic phrase
 * Enforces 24-word requirement for quantum-resistant security
 * 
 * @param mnemonic - Space-separated words (any case, may be abbreviated)
 * @returns true if valid 24-word phrase with all BIP39 words
 */
export function validateMnemonic(mnemonic: string): boolean {
  const wordCount = mnemonic.trim().split(/\s+/).length;
  if (wordCount !== 24) {
    return false; // REJECT: Only 24-word mnemonics accepted
  }
  return validatePhrase(mnemonic);
}

/**
 * Convert mnemonic to 32-byte seed using Minima's method
 * 
 * Minima's derivation (from BIP39.java):
 * 1. cleanSeedPhrase() - normalize to uppercase, expand abbreviated words
 * 2. SHA3-256(phrase_bytes) - direct hash, no PBKDF2
 * 
 * @param mnemonic - Space-separated words (any case, may be abbreviated)
 * @returns 32-byte seed for TreeKey construction
 */
export function mnemonicToSeed(mnemonic: string): Uint8Array {
  return phraseToSeed(mnemonic);
}

/**
 * Clean and normalize a mnemonic phrase
 * Matches Minima's BIP39.cleanSeedPhrase() exactly
 * 
 * @param mnemonic - Raw input (may be abbreviated, mixed case)
 * @returns Canonical uppercase phrase with full words
 */
export function cleanMnemonic(mnemonic: string): string {
  return cleanSeedPhrase(mnemonic);
}

export { convertStringToSeed, cleanSeedPhrase, phraseToSeed };
