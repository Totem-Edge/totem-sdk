/**
 * WOTS Implementation - BouncyCastle Compatible
 *
 * This implementation matches BouncyCastle's WinternitzOTSignature exactly,
 * which is used by Minima's Winternitz.java class.
 *
 * Key differences from standard WOTS (Winternitz):
 * - w=8 means 8 BITS per digit (not base-8), so each byte is one digit (0-255)
 * - Stateful PRNG (GMSSRandom) for chain seed derivation, not stateless H(i||seed)
 * - 34 total chains (32 message + 2 checksum), not 89
 * - Each chain hashed up to 255 times (2^8 - 1)
 *
 * Source: org.bouncycastle.pqc.crypto.gmss.util.{WinternitzOTSignature, WinternitzOTSVerify, GMSSRandom}
 */
import { ParamSet } from "./params";
import type { LoggerAdapter } from "./adapters";
/**
 * Enable WOTS debug logging with a custom logger
 * Use this for parity testing to capture all intermediate values
 *
 * WARNING: Debug logging outputs sensitive cryptographic material including
 * private key chains and seeds. NEVER enable in production builds.
 * This is intended for development/testing parity verification only.
 */
export declare function setWotsLogger(logger: LoggerAdapter): void;
/**
 * Disable WOTS debug logging
 */
export declare function disableWotsLogger(): void;
/**
 * Check if WOTS debug logging is enabled
 */
export declare function isWotsDebugEnabled(): boolean;
export declare const F: (x: Uint8Array) => Uint8Array<ArrayBufferLike>;
export declare const hex: (u: Uint8Array) => string;
export declare const fromHex: (h: string) => Uint8Array<ArrayBuffer>;
export declare const concatBytes: (...arrs: Uint8Array[]) => Uint8Array<ArrayBuffer>;
export declare const u16be: (n: number) => Uint8Array<ArrayBuffer>;
export declare const u32be: (n: number) => Uint8Array<ArrayBuffer>;
export declare function assert32(u: Uint8Array, label?: string): void;
export declare const h: (x: Uint8Array) => Uint8Array<ArrayBufferLike>;
/**
 * GMSSRandom - BouncyCastle's stateful PRNG for WOTS chain seed derivation
 *
 * Algorithm from GMSSRandom.java:
 *   rand = H(state)
 *   state = state + rand + 1 (byte-wise addition with carry)
 *   return rand
 *
 * The state is MUTATED in place after each call.
 */
export declare class GMSSRandom {
    /**
     * Generate next random value and update state
     *
     * @param state - 32-byte state array (MUTATED in place)
     * @returns 32-byte random value
     */
    static nextSeed(state: Uint8Array): Uint8Array;
    /**
     * Add two byte arrays: a = a + b (little-endian, with carry)
     * Matches GMSSRandom.addByteArrays()
     */
    private static addByteArrays;
    /**
     * Add one to byte array: a = a + 1 (little-endian, with carry)
     * Matches GMSSRandom.addOne()
     */
    private static addOne;
}
/**
 * getLog - Calculate ceil(log2(x))
 *
 * Matches WinternitzOTSignature.getLog():
 *   int log = 1;
 *   int i = 2;
 *   while (i < intValue) { i <<= 1; log++; }
 *   return log;
 */
export declare function getLog(intValue: number): number;
/**
 * Expand master seed into L private key chains using GMSSRandom
 *
 * Matches WinternitzOTSignature constructor:
 *   byte[] dummy = new byte[mdsize];
 *   System.arraycopy(seed0, 0, dummy, 0, dummy.length);
 *   for (int i = 0; i < keysize; i++) {
 *     privateKeyOTS[i] = gmssRandom.nextSeed(dummy);
 *   }
 */
export declare function expandPrivateKey(seed: Uint8Array, ps?: ParamSet): Uint8Array[];
/**
 * Convert message hash to Winternitz digits with checksum
 *
 * For w=8 (8 bits per digit), since 8 % 8 == 0:
 * - Each byte of the hash IS one digit (0-255)
 * - messagesize = 32 digits
 * - checksum = (messagesize << w) - sum = 8192 - sum
 * - checksumsize = 14 bits, extracted as 2 digits
 *
 * Matches WinternitzOTSignature.getSignature() for w=8 case
 */
export declare function toWinternitzDigits(hash32: Uint8Array, ps?: ParamSet): {
    digits: number[];
    checksumDigits: number[];
    total: number;
};
/**
 * Decompose digest into base-w digits + checksum
 * Returns flat array of all L digits
 */
export declare function baseWWithChecksum(msgHash: Uint8Array, paramSet?: ParamSet): number[];
/**
 * Hash a value k times
 *
 * Matches WinternitzOTSignature.hashPrivateKeyBlock():
 * - If rounds < 1: return input unchanged
 * - Otherwise: hash `rounds` times
 */
export declare function hashChain(x: Uint8Array, rounds: number): Uint8Array;
export type WotsKeypair = {
    seed: Uint8Array;
    index: number;
    pk: Uint8Array;
};
/**
 * Derive unique seed for a specific key index
 *
 * DEPRECATED: Use deriveChainSeedJava for Java parity.
 * This function is preserved for backward compatibility only.
 *
 * The correct derivation matching Minima's TreeKeyNode.java:
 *   MiniData seed = Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed);
 *
 * This old implementation used H(seed || u32be(i)) which is NOT Java compatible.
 * @deprecated Use deriveChainSeedJava from javaStreamables.ts
 */
export declare function deriveIndexedSeed(seed: Uint8Array, keyIndex: number): Uint8Array;
/**
 * Derive WOTS public key digest from seed and key index
 *
 * The key index is mixed into the seed first (deriveIndexedSeed),
 * then expanded using GMSSRandom to get unique chain seeds.
 *
 * Matches WinternitzOTSignature.getPublicKey():
 *   int rounds = (1 << w) - 1;  // 255 for w=8
 *   for (int i = 0; i < keysize; i++) {
 *     hashPrivateKeyBlock(i, rounds, buf, pos);
 *   }
 *   return H(buf);
 */
export declare function derivePKdigest(seed: Uint8Array, i: number, ps?: ParamSet): Uint8Array;
/**
 * Derive full WOTS public key (L × 32 bytes) without final hash
 *
 * Returns the concatenation of all chain tops BEFORE hashing.
 * Required by Minima's SignatureProof which expects the full public key.
 */
export declare function deriveFullPublicKey(seed: Uint8Array, i: number, ps?: ParamSet): Uint8Array;
export declare function wotsKeypairFromSeed(seed: Uint8Array, index: number, paramSet?: ParamSet): WotsKeypair;
export type WotsSignature = {
    index: number;
    w: number;
    sig: Uint8Array[];
};
/**
 * Sign a message hash using WOTS
 *
 * Matches WinternitzOTSignature.getSignature() for w=8:
 *   for each digit d[i]:
 *     sig[i] = hash(privateKey[i], d[i] times)
 *
 * @returns Flat signature (L × 32 = 1088 bytes)
 */
export declare function wotsSign(seed: Uint8Array, i: number, msgHash: Uint8Array, ps?: ParamSet): Uint8Array;
/**
 * Legacy wrapper returning structured signature
 */
export declare function wotsSignLegacy(msgHash: Uint8Array, seed: Uint8Array, index: number, paramSet?: ParamSet): WotsSignature;
/**
 * Recover public key from signature
 *
 * Matches WinternitzOTSVerify.Verify():
 *   1. Hash the message: hashedMsg = SHA3-256(message)
 *   2. for each digit d[i]:
 *        top[i] = hash(sig[i], (255 - d[i]) times)
 *   3. return H(concat(tops))
 *
 * CRITICAL: This function hashes the message internally to match Java/BouncyCastle
 * Winternitz behavior. Both wotsSign and wotsPkFromSig hash internally for parity.
 */
export declare function wotsPkFromSig(message: Uint8Array, signature: WotsSignature, paramSet?: ParamSet): Uint8Array;
/**
 * Verify WOTS signature against a FULL 1088-byte public key
 *
 * Matches Java's Winternitz.verify():
 * 1. Recover FULL public key from signature using the msgHash (1088 bytes)
 * 2. Compare FULL reconstructed key to expected FULL public key
 *
 * CRITICAL: Java's Winternitz.verify() compares the FULL 1088-byte reconstructed
 * public key against the FULL 1088-byte stored public key, NOT a 32-byte digest!
 *
 * IMPORTANT: This function expects a PRE-HASHED message (32-byte digest),
 * just like wotsSign. The caller should hash the message before passing it.
 *
 * @param sig - The 1088-byte WOTS signature
 * @param msgHash - The pre-hashed message (32-byte digest)
 * @param pkFull - The FULL 1088-byte WOTS public key (L=34 × 32 bytes)
 * @param ps - WOTS parameter set (default: minima)
 */
export declare function wotsVerify(sig: Uint8Array, message: Uint8Array, pkFull: Uint8Array, ps?: ParamSet): boolean;
/**
 * Legacy verify function that accepts a 32-byte digest
 * @deprecated Use wotsVerify with full 1088-byte public key instead
 */
export declare function wotsVerifyDigest(sig: Uint8Array, message: Uint8Array, pkDigest: Uint8Array, ps?: ParamSet): boolean;
/**
 * Generate WOTS public key from seed (convenience wrapper)
 */
export declare function wotsPublicKeyFromSeed(seed: Uint8Array, index?: number, paramSet?: ParamSet): Uint8Array;
/**
 * @deprecated Use expandPrivateKey instead
 */
export declare function prfChainSeed(seed: Uint8Array, i: number, j: number, _paramSet: ParamSet): Uint8Array;
