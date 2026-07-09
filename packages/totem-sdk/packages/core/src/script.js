"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptFromWotsPk = scriptFromWotsPk;
exports.wotsAddressFromKeypair = wotsAddressFromKeypair;
exports.hexToBytes = hexToBytes;
const util_1 = require("./util");
const derive_1 = require("./derive");
/** Produce KISSVM script that authorizes with a WOTS PK digest (32 bytes). */
function scriptFromWotsPk(pkDigest32) {
    // Minima uses SHA3-256 in SIGNEDBY paths; here we embed the digest as hex.
    return `RETURN SIGNEDBY(${(0, util_1.bytesToHex)(pkDigest32)})`;
}
/** Address from WOTS keypair (client-only): script -> MMR leaf -> Mx */
function wotsAddressFromKeypair(kp) {
    const script = scriptFromWotsPk(kp.pk);
    return (0, derive_1.scriptToAddress)(script);
}
/** tiny utils */
function hexToBytes(hex) {
    let h = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (h.length % 2)
        h = "0" + h;
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
}
