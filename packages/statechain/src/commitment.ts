import { sha3_256 } from '@totemsdk/core';

export function computeTransferCommitment(
  chainId: string,
  from: string,
  to: string,
  sequence: number,
  timestamp: number,
): Uint8Array {
  const canonical = JSON.stringify({ chainId, from, to, sequence, timestamp });
  return sha3_256(new TextEncoder().encode(canonical));
}

export function computeReclaimCommitment(
  coinId: string,
  ownerPkd: string,
  lockingAddress: string,
): Uint8Array {
  const data = JSON.stringify({ type: 'reclaim', coinId, ownerPkd, lockingAddress });
  return sha3_256(new TextEncoder().encode(data));
}
