"use strict";
/**
 * @module @totemsdk/core
 * Core cryptographic primitives, adapters, and utilities for Minima blockchain
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootPublicKey = exports.deserializeTreeSignature = exports.serializeTreeSignature = exports.verifyTreeSignature = exports.TreeKeyNode = exports.TreeKey = exports.serializeMMREntry = exports.serializeMMRData = exports.serializeMMREntryNumber = exports.createMMREntryNumber = exports.derivePerAddressSeed = exports.indexToMiniDataBytes = exports.javaHashAllObjects = exports.writeHashToStream = exports.serializeMiniNumberONE = exports.serializeMiniNumberZERO = exports.hashObject = exports.deriveChildTreeSeedJava = exports.deriveChainSeedJava = exports.hashAllObjects = exports.serializeMiniData = exports.serializeMiniNumber = exports.wotsPublicKeyFromSeed = exports.wotsVerify = exports.wotsPkFromSig = exports.wotsSignLegacy = exports.wotsSign = exports.wotsKeypairFromSeed = exports.derivePKdigest = exports.baseWWithChecksum = exports.toWinternitzDigits = exports.prfChainSeed = exports.h = exports.assert32 = exports.u32be = exports.u16be = exports.fromHex = exports.hex = exports.F = exports.TransactionReceiptStore = exports.WatermarkExhaustedError = exports.TransactionLifecycleError = exports.TransactionLifecycle = exports.TransactionService = exports.flatIndexFromLanes = exports.finalizeLease = exports.prepareLease = exports.LeaseMonitor = exports.WatermarkStore = exports.LeaseStore = void 0;
exports.MINIMA_CONSTANTS = exports.generateSeedPhrase = exports.generateWordList = exports.phraseToSeed = exports.convertWordListToSeed = exports.convertStringToSeed = exports.validatePhrase = exports.cleanSeedPhrase = exports.WORD_LIST = exports.addressToRoot = exports.scriptToAddress = exports.wotsAddressFromKeypair = exports.scriptFromWotsPk = exports.getPerAddressPublicKey = exports.deriveAddressPublicKey = exports.createPerAddressTreeKeyAsync = exports.createPerAddressTreeKey = exports.DEFAULT_LEVELS = exports.DEFAULT_KEYS_PER_LEVEL = void 0;
// Platform-agnostic Adapters (SDK Upgrade)
__exportStar(require("./adapters"), exports);
// Lease Management (SDK Upgrade) - exclude conflicting WotsIndices
var lease_1 = require("./lease");
Object.defineProperty(exports, "LeaseStore", { enumerable: true, get: function () { return lease_1.LeaseStore; } });
Object.defineProperty(exports, "WatermarkStore", { enumerable: true, get: function () { return lease_1.WatermarkStore; } });
Object.defineProperty(exports, "LeaseMonitor", { enumerable: true, get: function () { return lease_1.LeaseMonitor; } });
Object.defineProperty(exports, "prepareLease", { enumerable: true, get: function () { return lease_1.prepareLease; } });
Object.defineProperty(exports, "finalizeLease", { enumerable: true, get: function () { return lease_1.finalizeLease; } });
Object.defineProperty(exports, "flatIndexFromLanes", { enumerable: true, get: function () { return lease_1.flatIndexFromLanes; } });
// Transaction Management (SDK Upgrade) - exclude conflicting WotsIndices
var tx_1 = require("./tx");
Object.defineProperty(exports, "TransactionService", { enumerable: true, get: function () { return tx_1.TransactionService; } });
Object.defineProperty(exports, "TransactionLifecycle", { enumerable: true, get: function () { return tx_1.TransactionLifecycle; } });
Object.defineProperty(exports, "TransactionLifecycleError", { enumerable: true, get: function () { return tx_1.TransactionLifecycleError; } });
Object.defineProperty(exports, "WatermarkExhaustedError", { enumerable: true, get: function () { return tx_1.WatermarkExhaustedError; } });
Object.defineProperty(exports, "TransactionReceiptStore", { enumerable: true, get: function () { return tx_1.TransactionReceiptStore; } });
// Utilities first (canonical concatBytes source)
__exportStar(require("./utils"), exports);
// WOTS Signatures - wots.concatBytes is intentionally shadowed by utils.concatBytes above
var wots_1 = require("./wots");
Object.defineProperty(exports, "F", { enumerable: true, get: function () { return wots_1.F; } });
Object.defineProperty(exports, "hex", { enumerable: true, get: function () { return wots_1.hex; } });
Object.defineProperty(exports, "fromHex", { enumerable: true, get: function () { return wots_1.fromHex; } });
Object.defineProperty(exports, "u16be", { enumerable: true, get: function () { return wots_1.u16be; } });
Object.defineProperty(exports, "u32be", { enumerable: true, get: function () { return wots_1.u32be; } });
Object.defineProperty(exports, "assert32", { enumerable: true, get: function () { return wots_1.assert32; } });
Object.defineProperty(exports, "h", { enumerable: true, get: function () { return wots_1.h; } });
Object.defineProperty(exports, "prfChainSeed", { enumerable: true, get: function () { return wots_1.prfChainSeed; } });
Object.defineProperty(exports, "toWinternitzDigits", { enumerable: true, get: function () { return wots_1.toWinternitzDigits; } });
Object.defineProperty(exports, "baseWWithChecksum", { enumerable: true, get: function () { return wots_1.baseWWithChecksum; } });
Object.defineProperty(exports, "derivePKdigest", { enumerable: true, get: function () { return wots_1.derivePKdigest; } });
Object.defineProperty(exports, "wotsKeypairFromSeed", { enumerable: true, get: function () { return wots_1.wotsKeypairFromSeed; } });
Object.defineProperty(exports, "wotsSign", { enumerable: true, get: function () { return wots_1.wotsSign; } });
Object.defineProperty(exports, "wotsSignLegacy", { enumerable: true, get: function () { return wots_1.wotsSignLegacy; } });
Object.defineProperty(exports, "wotsPkFromSig", { enumerable: true, get: function () { return wots_1.wotsPkFromSig; } });
Object.defineProperty(exports, "wotsVerify", { enumerable: true, get: function () { return wots_1.wotsVerify; } });
Object.defineProperty(exports, "wotsPublicKeyFromSeed", { enumerable: true, get: function () { return wots_1.wotsPublicKeyFromSeed; } });
// WOTS Params (from params.ts, imported by wots.ts)
__exportStar(require("./params"), exports);
// Java-Compatible Serialization Helpers (for Minima-compatible seed derivation)
var javaStreamables_1 = require("./javaStreamables");
Object.defineProperty(exports, "serializeMiniNumber", { enumerable: true, get: function () { return javaStreamables_1.serializeMiniNumber; } });
Object.defineProperty(exports, "serializeMiniData", { enumerable: true, get: function () { return javaStreamables_1.serializeMiniData; } });
Object.defineProperty(exports, "hashAllObjects", { enumerable: true, get: function () { return javaStreamables_1.hashAllObjects; } });
Object.defineProperty(exports, "deriveChainSeedJava", { enumerable: true, get: function () { return javaStreamables_1.deriveChainSeedJava; } });
Object.defineProperty(exports, "deriveChildTreeSeedJava", { enumerable: true, get: function () { return javaStreamables_1.deriveChildTreeSeedJava; } });
Object.defineProperty(exports, "hashObject", { enumerable: true, get: function () { return javaStreamables_1.hashObject; } });
Object.defineProperty(exports, "serializeMiniNumberZERO", { enumerable: true, get: function () { return javaStreamables_1.serializeMiniNumberZERO; } });
Object.defineProperty(exports, "serializeMiniNumberONE", { enumerable: true, get: function () { return javaStreamables_1.serializeMiniNumberONE; } });
Object.defineProperty(exports, "writeHashToStream", { enumerable: true, get: function () { return javaStreamables_1.writeHashToStream; } });
Object.defineProperty(exports, "javaHashAllObjects", { enumerable: true, get: function () { return javaStreamables_1.javaHashAllObjects; } });
// Per-address key derivation (Minima Wallet.java compatible) - 2026-02
Object.defineProperty(exports, "indexToMiniDataBytes", { enumerable: true, get: function () { return javaStreamables_1.indexToMiniDataBytes; } });
Object.defineProperty(exports, "derivePerAddressSeed", { enumerable: true, get: function () { return javaStreamables_1.derivePerAddressSeed; } });
// MMREntryNumber and MMREntry serialization (2026-01-18)
Object.defineProperty(exports, "createMMREntryNumber", { enumerable: true, get: function () { return javaStreamables_1.createMMREntryNumber; } });
Object.defineProperty(exports, "serializeMMREntryNumber", { enumerable: true, get: function () { return javaStreamables_1.serializeMMREntryNumber; } });
Object.defineProperty(exports, "serializeMMRData", { enumerable: true, get: function () { return javaStreamables_1.serializeMMRData; } });
Object.defineProperty(exports, "serializeMMREntry", { enumerable: true, get: function () { return javaStreamables_1.serializeMMREntry; } });
// TreeKey/TreeKeyNode - Hierarchical WOTS key tree matching Minima's TreeKey.java
var treekey_1 = require("./treekey");
Object.defineProperty(exports, "TreeKey", { enumerable: true, get: function () { return treekey_1.TreeKey; } });
Object.defineProperty(exports, "TreeKeyNode", { enumerable: true, get: function () { return treekey_1.TreeKeyNode; } });
Object.defineProperty(exports, "verifyTreeSignature", { enumerable: true, get: function () { return treekey_1.verifyTreeSignature; } });
Object.defineProperty(exports, "serializeTreeSignature", { enumerable: true, get: function () { return treekey_1.serializeTreeSignature; } });
Object.defineProperty(exports, "deserializeTreeSignature", { enumerable: true, get: function () { return treekey_1.deserializeTreeSignature; } });
Object.defineProperty(exports, "getRootPublicKey", { enumerable: true, get: function () { return treekey_1.getRootPublicKey; } });
Object.defineProperty(exports, "DEFAULT_KEYS_PER_LEVEL", { enumerable: true, get: function () { return treekey_1.DEFAULT_KEYS_PER_LEVEL; } });
Object.defineProperty(exports, "DEFAULT_LEVELS", { enumerable: true, get: function () { return treekey_1.DEFAULT_LEVELS; } });
// Per-address TreeKey helpers (Minima Wallet.java compatible) - 2026-02
Object.defineProperty(exports, "createPerAddressTreeKey", { enumerable: true, get: function () { return treekey_1.createPerAddressTreeKey; } });
Object.defineProperty(exports, "createPerAddressTreeKeyAsync", { enumerable: true, get: function () { return treekey_1.createPerAddressTreeKeyAsync; } });
Object.defineProperty(exports, "deriveAddressPublicKey", { enumerable: true, get: function () { return treekey_1.deriveAddressPublicKey; } });
Object.defineProperty(exports, "getPerAddressPublicKey", { enumerable: true, get: function () { return treekey_1.getPerAddressPublicKey; } });
// Script helpers (for address derivation)
var script_1 = require("./script");
Object.defineProperty(exports, "scriptFromWotsPk", { enumerable: true, get: function () { return script_1.scriptFromWotsPk; } });
Object.defineProperty(exports, "wotsAddressFromKeypair", { enumerable: true, get: function () { return script_1.wotsAddressFromKeypair; } });
// Base32 Encoding (Minima-compatible)
__exportStar(require("./minima32"), exports);
// Merkle Mountain Range (original)
__exportStar(require("./mmr"), exports);
// Address Derivation (original)
var derive_1 = require("./derive");
Object.defineProperty(exports, "scriptToAddress", { enumerable: true, get: function () { return derive_1.scriptToAddress; } });
Object.defineProperty(exports, "addressToRoot", { enumerable: true, get: function () { return derive_1.addressToRoot; } });
// BIP39 Seed Phrase Handling (Minima-compatible, NOT standard BIP39)
var bip39_1 = require("./bip39");
Object.defineProperty(exports, "WORD_LIST", { enumerable: true, get: function () { return bip39_1.WORD_LIST; } });
Object.defineProperty(exports, "cleanSeedPhrase", { enumerable: true, get: function () { return bip39_1.cleanSeedPhrase; } });
Object.defineProperty(exports, "validatePhrase", { enumerable: true, get: function () { return bip39_1.validatePhrase; } });
Object.defineProperty(exports, "convertStringToSeed", { enumerable: true, get: function () { return bip39_1.convertStringToSeed; } });
Object.defineProperty(exports, "convertWordListToSeed", { enumerable: true, get: function () { return bip39_1.convertWordListToSeed; } });
Object.defineProperty(exports, "phraseToSeed", { enumerable: true, get: function () { return bip39_1.phraseToSeed; } });
Object.defineProperty(exports, "generateWordList", { enumerable: true, get: function () { return bip39_1.generateWordList; } });
Object.defineProperty(exports, "generateSeedPhrase", { enumerable: true, get: function () { return bip39_1.generateSeedPhrase; } });
// Constants
exports.MINIMA_CONSTANTS = {
    WOTS_W: 8,
    WOTS_N: 32,
    MAX_SIGNATURES: 262144,
    SIGNATURE_LEVELS: 3,
    ADDRESS_PREFIX: 'Mx',
    NETWORK_ID: 1
};
