/**
 * Totem <-> Axia hardened WOTS helpers (no deps on server internals).
 */
export type PrepareArgs = {
  txId: string;
  rootPublicKey: string;     // 0x… (32-byte pk digest hex)
  to: string;                // Mx…
  amount: string;            // decimal string
  tokenId?: string;          // default "0x00"
  burn?: string | null;      // optional
  digestL2?: string | null;  // optional — if you precompute trees
  digestL3?: string | null;  // optional — if you precompute trees
  ttlMs?: number;            // default 20000
};

export type PrepareResp = {
  leaseToken: string;                 // JWT
  lease: { addressIndex: number; l1: number; l2: number };
  txId: string;
  digestTx?: string | null;           // optional
};

export async function prepareLease(apiUrl: string, apiKey: string, args: PrepareArgs): Promise<PrepareResp> {
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
  if (!res.ok) throw new Error(`prepareLease ${res.status}`);
  const raw = await res.json() as {
    leaseToken: string;
    lease?: { addressIndex: number; l1: number; l2: number };
    addressIndex?: number;
    l1?: number;
    l2?: number;
    txId: string;
    digestTx?: string | null;
  };
  const lease = raw.lease ?? { addressIndex: raw.addressIndex ?? 0, l1: raw.l1 ?? 0, l2: raw.l2 ?? 0 };
  return {
    leaseToken: raw.leaseToken,
    lease,
    txId: raw.txId,
    digestTx: raw.digestTx ?? null
  };
}

export async function finalizeLease(apiUrl: string, apiKey: string, leaseToken: string, signedHex: string) {
  const res = await fetch(`${apiUrl}/v1/wots-hardened/finalize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ leaseToken, signedHex })
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

/** lane tuple -> flat WOTS index (64^3 space) */
export function flatIndexFromLanes(addressIndex: number, l1: number, l2: number): number {
  if (addressIndex|l1|l2 & ~63) throw new Error('lane out of range');
  return (addressIndex * 64 * 64) + (l1 * 64) + l2;
}