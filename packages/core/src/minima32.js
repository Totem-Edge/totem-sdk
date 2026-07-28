"use strict";
// Minima "Mx" Base32 — matches org.minima.utils.BaseConverter.encode32/decode32
// Source behavior: BigInteger radix-32, then i→w, l→y, o→z, uppercased, prefixed with "Mx".
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeMxRadix32Frame = encodeMxRadix32Frame;
exports.decodeMxRadix32Frame = decodeMxRadix32Frame;
exports.encodeMx = encodeMx;
exports.decodeMx = decodeMx;
exports.makeMinimaAddress = makeMinimaAddress;
exports.convertMinimaAddress = convertMinimaAddress;
function bytesToBigInt(bytes) {
    let x = 0n;
    for (const b of bytes)
        x = (x << 8n) | BigInt(b);
    return x;
}
function bigIntToBytes(x) {
    if (x === 0n)
        return new Uint8Array([0]); // not normally hit for framed addresses
    let hex = x.toString(16);
    if (hex.length % 2)
        hex = '0' + hex;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
    }
    return out;
}
function encodeMxRadix32Frame(frame) {
    let s = bytesToBigInt(frame).toString(32).toLowerCase();
    // JAR swaps (avoid ambiguous letters) then uppercase and add prefix
    s = s.replace(/i/g, 'w').replace(/l/g, 'y').replace(/o/g, 'z');
    return 'Mx' + s.toUpperCase();
}
function decodeMxRadix32Frame(mx) {
    let s = mx.trim().toLowerCase();
    if (s.startsWith('mx'))
        s = s.slice(2);
    s = s.replace(/w/g, 'i').replace(/y/g, 'l').replace(/z/g, 'o'); // reverse swaps
    // parse base-32 by hand (radix 32)
    let x = 0n;
    for (const ch of s) {
        const v = parseInt(ch, 32);
        if (Number.isNaN(v))
            throw new Error(`Invalid base32 character: ${ch}`);
        x = x * 32n + BigInt(v);
    }
    return bigIntToBytes(x);
}
// Import SHA3 for checksum calculation
const sha3_1 = require("@totemsdk/core");
/** Encode raw 32 bytes to Mx address with frame and checksum */
function encodeMx(root32) {
    if (root32.length !== 32) {
        throw new Error(`Expected 32 bytes, got ${root32.length}`);
    }
    // Build frame: [sentinel(1), length(2), data(32), checksum(4)]
    const frame = new Uint8Array(1 + 2 + 32 + 4);
    frame[0] = 0x01; // Sentinel byte
    frame[1] = 0; // Length high byte
    frame[2] = 32; // Length low byte
    frame.set(root32, 3);
    // Calculate checksum of the raw 32 bytes
    const chk = sha3_1.sha3_256(root32);
    frame.set(chk.slice(0, 4), 35);
    return encodeMxRadix32Frame(frame);
}
/** Decode Mx address to raw 32 bytes, validating frame and checksum */
function decodeMx(mx) {
    const frame = decodeMxRadix32Frame(mx);
    // Validate frame structure
    if (frame[0] !== 0x01) {
        throw new Error(`Invalid sentinel byte: ${frame[0]}`);
    }
    const len = (frame[1] << 8) | frame[2];
    if (len !== 32) {
        throw new Error(`Invalid length: ${len}, expected 32`);
    }
    const root32 = frame.slice(3, 35);
    const checksum = frame.slice(35, 39);
    // Validate checksum
    const expectedChk = sha3_1.sha3_256(root32);
    const expected = expectedChk.slice(0, 4);
    for (let i = 0; i < 4; i++) {
        if (checksum[i] !== expected[i]) {
            throw new Error('Invalid checksum');
        }
    }
    return root32;
}
// Aliases for backward compatibility
function hexToBytes(hex) {
    let h = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (h.length % 2)
        h = "0" + h;
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
}
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
/** Make an Mx address from a hex string (legacy API compatibility) */
function makeMinimaAddress(hex) {
    const bytes = hexToBytes(hex);
    return encodeMx(bytes);
}
/** Convert an Mx address back to uppercase hex (legacy API compatibility) */
function convertMinimaAddress(mx) {
    const bytes = decodeMx(mx);
    return bytesToHex(bytes);
}
