"use strict";
/**
 * WOTS Implementation - BouncyCastle Compatible
 *
 * This implementation matches BouncyCastle's WinternitzOTSignature exactly,
 * which is used by Minima's Winternitz.java class.
 *
 * Key differences from standard WOTS/WOTS+:
 * - w=8 means 8 BITS per digit (not base-8), so each byte is one digit (0-255)
 * - Stateful PRNG (GMSSRandom) for chain seed derivation, not stateless H(i||seed)
 * - 34 total chains (32 message + 2 checksum), not 89
 * - Each chain hashed up to 255 times (2^8 - 1)
 *
 * Source: org.bouncycastle.pqc.crypto.gmss.util.{WinternitzOTSignature, WinternitzOTSVerify, GMSSRandom}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GMSSRandom = exports.h = exports.u32be = exports.u16be = exports.concatBytes = exports.fromHex = exports.hex = exports.F = void 0;
exports.setWotsLogger = setWotsLogger;
exports.disableWotsLogger = disableWotsLogger;
exports.isWotsDebugEnabled = isWotsDebugEnabled;
exports.assert32 = assert32;
exports.getLog = getLog;
exports.expandPrivateKey = expandPrivateKey;
exports.toWinternitzDigits = toWinternitzDigits;
exports.baseWWithChecksum = baseWWithChecksum;
exports.hashChain = hashChain;
exports.deriveIndexedSeed = deriveIndexedSeed;
exports.derivePKdigest = derivePKdigest;
exports.deriveFullPublicKey = deriveFullPublicKey;
exports.wotsKeypairFromSeed = wotsKeypairFromSeed;
exports.wotsSign = wotsSign;
exports.wotsSignLegacy = wotsSignLegacy;
exports.wotsPkFromSig = wotsPkFromSig;
exports.wotsVerify = wotsVerify;
exports.wotsVerifyDigest = wotsVerifyDigest;
exports.wotsPublicKeyFromSeed = wotsPublicKeyFromSeed;
exports.prfChainSeed = prfChainSeed;
const sha3_1 = require("@totemsdk/core");
const params_1 = require("./params");
const javaStreamables_1 = require("./javaStreamables");
const adapters_1 = require("./adapters");
// Module-level debug logger - can be set externally for parity testing
let wotsLogger = new adapters_1.NoopLogger();
let wotsDebugEnabled = false;
/**
 * Enable WOTS debug logging with a custom logger
 * Use this for parity testing to capture all intermediate values
 *
 * WARNING: Debug logging outputs sensitive cryptographic material including
 * private key chains and seeds. NEVER enable in production builds.
 * This is intended for development/testing parity verification only.
 */
function setWotsLogger(logger) {
    wotsLogger = logger;
    wotsDebugEnabled = true;
}
/**
 * Disable WOTS debug logging
 */
function disableWotsLogger() {
    wotsLogger = new adapters_1.NoopLogger();
    wotsDebugEnabled = false;
}
/**
 * Check if WOTS debug logging is enabled
 */
function isWotsDebugEnabled() {
    return wotsDebugEnabled;
}
// === Canonical helpers ===
const F = (x) => (0, sha3_1.sha3_256)(x);
exports.F = F;
const hex = (u) => { let s = ''; for (let i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, '0'); return s; };
exports.hex = hex;
const fromHex = (h) => { const s = h.replace(/^0x/, ''); const out = new Uint8Array(s.length >> 1); for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return out; };
exports.fromHex = fromHex;
const concatBytes = (...arrs) => {
    const len = arrs.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) {
        out.set(a, o);
        o += a.length;
    }
    return out;
};
exports.concatBytes = concatBytes;
const u16be = (n) => new Uint8Array([(n >>> 8) & 0xff, n & 0xff]);
exports.u16be = u16be;
const u32be = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
exports.u32be = u32be;
function assert32(u, label = 'value') {
    if (!(u instanceof Uint8Array))
        throw new Error(`${label} must be a Uint8Array`);
    if (u.length !== 32)
        throw new Error(`${label} must be exactly 32 bytes; got ${u.length}`);
}
// Legacy aliases
const u8 = (len) => new Uint8Array(len);
exports.h = exports.F;
const concat = exports.concatBytes;
const defaultParamSet = (0, params_1.getParamSet)();
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
class GMSSRandom {
    /**
     * Generate next random value and update state
     *
     * @param state - 32-byte state array (MUTATED in place)
     * @returns 32-byte random value
     */
    static nextSeed(state) {
        assert32(state, 'state');
        // rand = H(state)
        const rand = (0, exports.F)(state);
        // state = state + rand (byte-wise addition with carry, little-endian)
        GMSSRandom.addByteArrays(state, rand);
        // state = state + 1
        GMSSRandom.addOne(state);
        return rand;
    }
    /**
     * Add two byte arrays: a = a + b (little-endian, with carry)
     * Matches GMSSRandom.addByteArrays()
     */
    static addByteArrays(a, b) {
        let overflow = 0;
        for (let i = 0; i < a.length; i++) {
            const temp = (a[i] & 0xff) + (b[i] & 0xff) + overflow;
            a[i] = temp & 0xff;
            overflow = temp >>> 8;
        }
    }
    /**
     * Add one to byte array: a = a + 1 (little-endian, with carry)
     * Matches GMSSRandom.addOne()
     */
    static addOne(a) {
        let overflow = 1;
        for (let i = 0; i < a.length; i++) {
            const temp = (a[i] & 0xff) + overflow;
            a[i] = temp & 0xff;
            overflow = temp >>> 8;
            if (overflow === 0)
                break;
        }
    }
}
exports.GMSSRandom = GMSSRandom;
/**
 * getLog - Calculate ceil(log2(x))
 *
 * Matches WinternitzOTSignature.getLog():
 *   int log = 1;
 *   int i = 2;
 *   while (i < intValue) { i <<= 1; log++; }
 *   return log;
 */
function getLog(intValue) {
    let log = 1;
    let i = 2;
    while (i < intValue) {
        i <<= 1;
        log++;
    }
    return log;
}
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
function expandPrivateKey(seed, ps = (0, params_1.getParamSet)()) {
    assert32(seed, 'seed');
    // Copy seed to mutable state
    const state = new Uint8Array(seed);
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[expandPrivateKey] Input seed: ${(0, exports.hex)(seed).substring(0, 64)}...`);
        wotsLogger.debug(`[expandPrivateKey] Initial state: ${(0, exports.hex)(state).substring(0, 64)}...`);
    }
    // Generate L chain seeds using stateful PRNG
    const privateKeys = [];
    for (let i = 0; i < ps.L; i++) {
        const pk = GMSSRandom.nextSeed(state);
        privateKeys.push(pk);
        // Log first few private keys for debugging
        if (wotsDebugEnabled && i < 3) {
            wotsLogger.debug(`[expandPrivateKey] pk[${i}]: ${(0, exports.hex)(pk)}`);
            wotsLogger.debug(`[expandPrivateKey] state after pk[${i}]: ${(0, exports.hex)(state).substring(0, 32)}...`);
        }
    }
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[expandPrivateKey] Generated ${privateKeys.length} private keys`);
        wotsLogger.debug(`[expandPrivateKey] pk[33] (last): ${(0, exports.hex)(privateKeys[33])}`);
    }
    return privateKeys;
}
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
function toWinternitzDigits(hash32, ps = (0, params_1.getParamSet)()) {
    assert32(hash32, 'hash');
    if (ps.w !== 8) {
        throw new Error(`Only w=8 is supported. Got w=${ps.w}`);
    }
    // For w=8: each byte IS a digit (0-255)
    // d = 8 / w = 1 digit per byte
    // k = (1 << w) - 1 = 255
    const digits = [];
    let c = 0; // checksum accumulator
    for (let i = 0; i < hash32.length; i++) {
        const digit = hash32[i] & 0xff;
        digits.push(digit);
        c += digit;
    }
    const digitSum = c;
    // Checksum = (messagesize << w) - c = (32 << 8) - c = 8192 - c
    c = (ps.messageSize << ps.w) - c;
    const checksumBeforeExtract = c;
    // Extract checksum digits: 2 digits, each 0-255
    // checksumsize = 14 bits, iterate by w=8 bits
    const checksumDigits = [];
    const k = ps.maxDigit; // 255
    for (let i = 0; i < ps.checksumSize; i += ps.w) {
        checksumDigits.push(c & k);
        c >>>= ps.w;
    }
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[toWinternitzDigits] Input hash: ${(0, exports.hex)(hash32)}`);
        wotsLogger.debug(`[toWinternitzDigits] First 5 message digits: [${digits.slice(0, 5).join(', ')}]`);
        wotsLogger.debug(`[toWinternitzDigits] Last 5 message digits: [${digits.slice(-5).join(', ')}]`);
        wotsLogger.debug(`[toWinternitzDigits] Digit sum: ${digitSum}`);
        wotsLogger.debug(`[toWinternitzDigits] Checksum formula: (${ps.messageSize} << ${ps.w}) - ${digitSum} = ${checksumBeforeExtract}`);
        wotsLogger.debug(`[toWinternitzDigits] Checksum digits: [${checksumDigits.join(', ')}]`);
        wotsLogger.debug(`[toWinternitzDigits] Total digits: ${digits.length + checksumDigits.length} (expected L=${ps.L})`);
    }
    return {
        digits,
        checksumDigits,
        total: digits.length + checksumDigits.length
    };
}
/**
 * Decompose digest into base-w digits + checksum
 * Returns flat array of all L digits
 */
function baseWWithChecksum(msgHash, paramSet) {
    const ps = paramSet || defaultParamSet;
    const { digits, checksumDigits } = toWinternitzDigits(msgHash, ps);
    const result = digits.concat(checksumDigits);
    if (result.length !== ps.L) {
        throw new Error(`Invalid digit length: expected ${ps.L}, got ${result.length}`);
    }
    return result;
}
/**
 * Hash a value k times
 *
 * Matches WinternitzOTSignature.hashPrivateKeyBlock():
 * - If rounds < 1: return input unchanged
 * - Otherwise: hash `rounds` times
 */
function hashChain(x, rounds) {
    if (rounds < 1) {
        return new Uint8Array(x);
    }
    let result = (0, exports.F)(x);
    for (let i = 1; i < rounds; i++) {
        result = (0, exports.F)(result);
    }
    return result;
}
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
function deriveIndexedSeed(seed, keyIndex) {
    assert32(seed, 'seed');
    // Use Java-compatible derivation: hashAllObjects(MiniNumber(i), MiniData(seed))
    const result = (0, javaStreamables_1.deriveChainSeedJava)(seed, keyIndex);
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[deriveIndexedSeed] seed=${(0, exports.hex)(seed).substring(0, 32)}..., keyIndex=${keyIndex} => ${(0, exports.hex)(result)}`);
    }
    return result;
}
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
function derivePKdigest(seed, i, ps = (0, params_1.getParamSet)()) {
    assert32(seed, 'seed');
    // Derive unique seed for this key index
    const indexedSeed = deriveIndexedSeed(seed, i);
    // Expand indexed seed into private keys
    const privateKeys = expandPrivateKey(indexedSeed, ps);
    // Hash each chain 255 times to get chain tops
    const rounds = ps.maxDigit; // 255
    const buf = new Uint8Array(ps.L * 32);
    for (let j = 0; j < ps.L; j++) {
        const top = hashChain(privateKeys[j], rounds);
        buf.set(top, j * 32);
    }
    // Return H(all chain tops)
    return (0, exports.F)(buf);
}
/**
 * Derive full WOTS public key (L × 32 bytes) without final hash
 *
 * Returns the concatenation of all chain tops BEFORE hashing.
 * Required by Minima's SignatureProof which expects the full public key.
 */
function deriveFullPublicKey(seed, i, ps = (0, params_1.getParamSet)()) {
    assert32(seed, 'seed');
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[deriveFullPublicKey] ========== PK DERIVATION START ==========`);
        wotsLogger.debug(`[deriveFullPublicKey] Master seed: ${(0, exports.hex)(seed).substring(0, 32)}..., keyIndex: ${i}`);
    }
    // Derive unique seed for this key index
    const indexedSeed = deriveIndexedSeed(seed, i);
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[deriveFullPublicKey] Indexed seed: ${(0, exports.hex)(indexedSeed)}`);
    }
    const privateKeys = expandPrivateKey(indexedSeed, ps);
    const rounds = ps.maxDigit; // 255
    const buf = new Uint8Array(ps.L * 32);
    for (let j = 0; j < ps.L; j++) {
        const top = hashChain(privateKeys[j], rounds);
        buf.set(top, j * 32);
        // Log first few chain tops for debugging
        if (wotsDebugEnabled && j < 3) {
            wotsLogger.debug(`[deriveFullPublicKey] chain[${j}]: pk=${(0, exports.hex)(privateKeys[j]).substring(0, 16)}... rounds=${rounds} => top=${(0, exports.hex)(top).substring(0, 16)}...`);
        }
    }
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[deriveFullPublicKey] Full public key (${buf.length}B): ${(0, exports.hex)(buf).substring(0, 64)}...${(0, exports.hex)(buf).substring((0, exports.hex)(buf).length - 32)}`);
        wotsLogger.debug(`[deriveFullPublicKey] ========== PK DERIVATION END ==========`);
    }
    return buf; // L * 32 = 1088 bytes
}
function wotsKeypairFromSeed(seed, index, paramSet) {
    assert32(seed, 'seed');
    const ps = paramSet || defaultParamSet;
    const pkDigest = derivePKdigest(seed, index, ps);
    return { seed, index, pk: pkDigest };
}
/**
 * Sign a message hash using WOTS
 *
 * Matches WinternitzOTSignature.getSignature() for w=8:
 *   for each digit d[i]:
 *     sig[i] = hash(privateKey[i], d[i] times)
 *
 * @returns Flat signature (L × 32 = 1088 bytes)
 */
function wotsSign(seed, i, msgHash, ps = (0, params_1.getParamSet)()) {
    assert32(seed, 'seed');
    assert32(msgHash, 'msgHash');
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[wotsSign] ========== WOTS SIGN START ==========`);
        wotsLogger.debug(`[wotsSign] Master seed: ${(0, exports.hex)(seed)}`);
        wotsLogger.debug(`[wotsSign] Key index: ${i}`);
        wotsLogger.debug(`[wotsSign] Message hash: ${(0, exports.hex)(msgHash)}`);
    }
    // Derive unique seed for this key index
    const indexedSeed = deriveIndexedSeed(seed, i);
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[wotsSign] Indexed seed (after deriveIndexedSeed): ${(0, exports.hex)(indexedSeed)}`);
    }
    const privateKeys = expandPrivateKey(indexedSeed, ps);
    // CRITICAL: Hash the message internally to match Java/BouncyCastle Winternitz behavior
    // Java's WinternitzOTSignature.getSignature() always hashes the message first
    const hashedMsg = (0, exports.F)(msgHash);
    const { digits, checksumDigits } = toWinternitzDigits(hashedMsg, ps);
    const allDigits = digits.concat(checksumDigits);
    if (allDigits.length !== ps.L) {
        throw new Error(`Digit length mismatch: got ${allDigits.length}, want ${ps.L}`);
    }
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[wotsSign] All ${allDigits.length} digits: [${allDigits.join(', ')}]`);
    }
    const out = new Uint8Array(ps.L * 32);
    for (let j = 0; j < ps.L; j++) {
        const rounds = allDigits[j];
        const sigPart = hashChain(privateKeys[j], rounds);
        out.set(sigPart, j * 32);
        // Log first few and last signature chains for debugging
        if (wotsDebugEnabled && (j < 3 || j >= ps.L - 2)) {
            wotsLogger.debug(`[wotsSign] chain[${j}]: pk=${(0, exports.hex)(privateKeys[j]).substring(0, 16)}... rounds=${rounds} => sig=${(0, exports.hex)(sigPart).substring(0, 16)}...`);
        }
    }
    if (wotsDebugEnabled) {
        wotsLogger.debug(`[wotsSign] Signature output (${out.length} bytes): ${(0, exports.hex)(out).substring(0, 64)}...${(0, exports.hex)(out).substring((0, exports.hex)(out).length - 64)}`);
        wotsLogger.debug(`[wotsSign] ========== WOTS SIGN END ==========`);
    }
    return out;
}
/**
 * Legacy wrapper returning structured signature
 */
function wotsSignLegacy(msgHash, seed, index, paramSet) {
    const ps = paramSet || (0, params_1.getParamSet)();
    const sig = wotsSign(seed, index, msgHash, ps);
    const chunks = [];
    for (let i = 0; i < ps.L; i++) {
        chunks.push(sig.subarray(i * 32, (i + 1) * 32));
    }
    return { index, w: ps.w, sig: chunks };
}
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
function wotsPkFromSig(message, signature, paramSet) {
    const ps = paramSet || defaultParamSet;
    // CRITICAL: Hash the message internally to match Java/BouncyCastle Winternitz behavior
    const hashedMsg = (0, exports.F)(message);
    const allDigits = baseWWithChecksum(hashedMsg, ps);
    if (signature.sig.length !== ps.L) {
        throw new Error(`Wrong signature length: expected ${ps.L}, got ${signature.sig.length}`);
    }
    const buf = new Uint8Array(ps.L * 32);
    for (let i = 0; i < ps.L; i++) {
        const stepsUp = ps.maxDigit - allDigits[i]; // 255 - d[i]
        const top = hashChain(signature.sig[i], stepsUp);
        buf.set(top, i * 32);
    }
    return (0, exports.F)(buf);
}
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
function wotsVerify(sig, message, pkFull, ps = (0, params_1.getParamSet)()) {
    // CRITICAL: Java verifies against FULL 1088-byte public key, not 32-byte digest
    const expectedLen = ps.L * 32;
    if (pkFull.length !== expectedLen) {
        throw new Error(`pkFull must be exactly ${expectedLen} bytes (L=${ps.L} × 32); got ${pkFull.length}`);
    }
    if (sig.length !== expectedLen) {
        return false;
    }
    // CRITICAL: Hash the message internally to match Java/BouncyCastle Winternitz behavior
    const hashedMsg = (0, exports.F)(message);
    const allDigits = baseWWithChecksum(hashedMsg, ps);
    const buf = new Uint8Array(expectedLen);
    for (let j = 0; j < ps.L; j++) {
        const sigPart = sig.subarray(j * 32, (j + 1) * 32);
        const stepsUp = ps.maxDigit - allDigits[j];
        const top = hashChain(sigPart, stepsUp);
        buf.set(top, j * 32);
    }
    // Compare FULL 1088-byte reconstructed key to expected FULL public key
    // This matches Java: resp.isEqual(zPublicKey) where both are 1088 bytes
    if (buf.length !== pkFull.length) return false;
    let diff = 0;
    for (let i = 0; i < buf.length; i++) diff |= buf[i] ^ pkFull[i];
    return diff === 0;
}
/**
 * Legacy verify function that accepts a 32-byte digest
 * @deprecated Use wotsVerify with full 1088-byte public key instead
 */
function wotsVerifyDigest(sig, message, pkDigest, ps = (0, params_1.getParamSet)()) {
    assert32(pkDigest, 'pkDigest');
    const expectedLen = ps.L * 32;
    if (sig.length !== expectedLen) {
        return false;
    }
    const msgHash = (0, exports.F)(message);
    const allDigits = baseWWithChecksum(msgHash, ps);
    const buf = new Uint8Array(expectedLen);
    for (let j = 0; j < ps.L; j++) {
        const sigPart = sig.subarray(j * 32, (j + 1) * 32);
        const stepsUp = ps.maxDigit - allDigits[j];
        const top = hashChain(sigPart, stepsUp);
        buf.set(top, j * 32);
    }
    const recomputed = (0, exports.F)(buf);
    if (recomputed.length !== pkDigest.length) return false;
    let diff = 0;
    for (let i = 0; i < recomputed.length; i++) diff |= recomputed[i] ^ pkDigest[i];
    return diff === 0;
}
/**
 * Generate WOTS public key from seed (convenience wrapper)
 */
function wotsPublicKeyFromSeed(seed, index = 0, paramSet) {
    assert32(seed, 'seed');
    const keypair = wotsKeypairFromSeed(seed, index, paramSet);
    return keypair.pk;
}
// === Legacy compatibility exports ===
// These are kept for backwards compatibility but use the BC-compatible implementation
/**
 * @deprecated Use expandPrivateKey instead
 */
function prfChainSeed(seed, i, j, _paramSet) {
    // This function no longer makes sense with stateful PRNG
    // For compatibility, derive the j-th chain seed for key i
    const privateKeys = expandPrivateKey(seed, _paramSet);
    if (j >= privateKeys.length) {
        throw new Error(`Chain index ${j} out of range (max ${privateKeys.length - 1})`);
    }
    return privateKeys[j];
}
