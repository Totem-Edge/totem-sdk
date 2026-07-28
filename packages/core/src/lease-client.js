"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareLease = prepareLease;
exports.finalizeLease = finalizeLease;
exports.flatIndexFromLanes = flatIndexFromLanes;
async function prepareLease(apiUrl, apiKey, args) {
    const res = await fetch(`${apiUrl}/v1/wots-hardened/prepare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
            tokenId: "0x00",
            burn: null,
            digestL2: null,
            digestL3: null,
            ttlMs: 20000,
            ...args
        })
    });
    if (!res.ok)
        throw new Error(`prepareLease ${res.status}`);
    const raw = await res.json();
    const lease = raw.lease ?? { addressIndex: raw.addressIndex, l1: raw.l1, l2: raw.l2 };
    return {
        leaseToken: raw.leaseToken,
        lease,
        txId: raw.txId,
        digestTx: raw.digestTx ?? null
    };
}
async function finalizeLease(apiUrl, apiKey, leaseToken, signedHex) {
    const res = await fetch(`${apiUrl}/v1/wots-hardened/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ leaseToken, signedHex })
    });
    const text = await res.text();
    return { status: res.status, body: text };
}
/** lane tuple -> flat WOTS index (64^3 space) */
function flatIndexFromLanes(addressIndex, l1, l2) {
    if (addressIndex | l1 | l2 & ~63)
        throw new Error('lane out of range');
    return (addressIndex * 64 * 64) + (l1 * 64) + l2;
}
