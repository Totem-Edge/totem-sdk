/**
 * Minima-Compatible BIP39 Seed Phrase Handling
 *
 * IMPORTANT: This is NOT standard BIP39!
 * Minima uses the BIP39 English word list for human-friendly phrases,
 * but does NOT use PBKDF2, passphrase salt, or checksum validation.
 *
 * Seed derivation is simply: SHA3-256(phrase_bytes)
 *
 * Matches BIP39.java behavior exactly:
 * - cleanSeedPhrase(): Normalizes input with prefix matching
 * - convertStringToSeed(): Hashes phrase bytes with SHA3-256
 */
/**
 * Official BIP39 English word list (2048 words)
 * From https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt
 */
export declare const WORD_LIST: readonly string[];
/**
 * Clean and normalize a seed phrase matching Minima's BIP39.cleanSeedPhrase() exactly
 *
 * From BIP39.java:
 * - Split by whitespace
 * - For each token: lowercase; length >= 3 required
 * - If token length < 4: must match full word in wordlist
 * - Else: accept FIRST word in wordlist that startsWith(token)
 * - Join with single spaces, trim, then convert to UPPERCASE
 *
 * @param seedPhrase - Raw user input (may be abbreviated, mixed case)
 * @returns Canonical uppercase phrase with full words from BIP39 list
 * @throws Error if any word cannot be matched
 */
export declare function cleanSeedPhrase(seedPhrase: string): string;
/**
 * Validate that a phrase contains valid BIP39 words
 * Does NOT check checksum (Minima doesn't use checksums)
 *
 * @param phrase - Space-separated words (any case)
 * @returns true if all words are valid BIP39 words
 */
export declare function validatePhrase(phrase: string): boolean;
/**
 * Convert a seed phrase to a 32-byte seed matching Minima's BIP39.convertStringToSeed()
 *
 * IMPORTANT: This is NOT standard BIP39!
 * Minima simply hashes the phrase bytes with SHA3-256.
 * No PBKDF2, no passphrase salt, no "mnemonic" prefix.
 *
 * From BIP39.java convertStringToSeed():
 *   MiniString phrase = new MiniString(zPhrase);
 *   return new MiniData(Crypto.getInstance().hashData(phrase.getData()));
 *
 * @param phrase - Canonical phrase (should be cleaned first with cleanSeedPhrase)
 * @returns 32-byte SHA3-256 seed
 */
export declare function convertStringToSeed(phrase: string): Uint8Array;
/**
 * Convert word array to seed matching Minima's BIP39.convertWordListToSeed()
 *
 * From BIP39.java:
 *   String allwords = convertWordListToString(zWords);
 *   MiniString ministr = new MiniString(allwords);
 *   MiniData hash = new MiniData(Crypto.getInstance().hashData(ministr.getData()));
 *
 * @param words - Array of BIP39 words
 * @returns 32-byte SHA3-256 seed
 */
export declare function convertWordListToSeed(words: string[]): Uint8Array;
/**
 * Full pipeline: raw user input → 32-byte seed
 *
 * 1. cleanSeedPhrase() - normalize with prefix matching, output uppercase
 * 2. convertStringToSeed() - SHA3-256 hash of phrase bytes
 *
 * @param rawPhrase - User's input (may be abbreviated, mixed case)
 * @returns 32-byte seed for TreeKey
 * @throws Error if phrase contains invalid words
 */
export declare function phraseToSeed(rawPhrase: string): Uint8Array;
/**
 * Generate a new random 24-word seed phrase
 * Uses crypto.getRandomValues for secure randomness
 *
 * @returns Array of 24 random BIP39 words (lowercase)
 */
export declare function generateWordList(): string[];
/**
 * Generate a new random seed phrase as a string
 * @returns 24-word phrase in UPPERCASE (canonical form)
 */
export declare function generateSeedPhrase(): string;
