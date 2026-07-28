"use strict";
/**
 * Utility functions for byte array manipulation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToHex = bytesToHex;
exports.hexToBytes = hexToBytes;
exports.concatBytes = concatBytes;
exports.utf8ToBytes = utf8ToBytes;
exports.bytesToUtf8 = bytesToUtf8;
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
function hexToBytes(hex) {
    if (hex.startsWith('0x'))
        hex = hex.slice(2);
    if (hex.length % 2 !== 0)
        throw new Error('Invalid hex string');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
function concatBytes(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
function utf8ToBytes(str) {
    return new TextEncoder().encode(str);
}
function bytesToUtf8(bytes) {
    return new TextDecoder().decode(bytes);
}
