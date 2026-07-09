import { sha3_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { OmniaVtxo, VtxoId, VtxoProof } from './types.js';
import { EMPTY_LEAF, MOCK_BATCH_ID } from './constants.js';

function sha3hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return bytesToHex(sha3_256(bytes));
}

function hashPair(a: string, b: string): string {
  const [left, right] = a <= b ? [a, b] : [b, a];
  const combined = left + right;
  const bytes = hexToBytes(combined);
  return bytesToHex(sha3_256(bytes));
}

export function computeVtxoLeaf(vtxo: OmniaVtxo): string {
  const input = [
    vtxo.vtxoId,
    vtxo.owner,
    vtxo.amount.toString(),
    vtxo.tokenId,
    vtxo.epoch.toString(),
    vtxo.poolId,
  ].join(':');
  return sha3hex(input);
}

export interface ComputeVtxoIdParams {
  poolId: string;
  owner: string;
  amount: bigint;
  tokenId: string;
  nonce: string;
}

export function computeVtxoId(params: ComputeVtxoIdParams): string {
  const input = [
    'vtxo',
    params.poolId,
    params.owner,
    params.amount.toString(),
    params.tokenId,
    params.nonce,
  ].join(':');
  return sha3hex(input);
}

export interface ComputePoolIdParams {
  operator: string;
  tokenId: string;
  nonce: string;
}

export function computePoolId(params: ComputePoolIdParams): string {
  const input = [
    'pool',
    params.operator,
    params.tokenId,
    params.nonce,
  ].join(':');
  return sha3hex(input);
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function computeCommitmentRoot(leaves: string[]): string {
  if (leaves.length === 0) return EMPTY_LEAF;

  const size = nextPowerOfTwo(leaves.length);
  const level: string[] = new Array(size).fill(EMPTY_LEAF);
  for (let i = 0; i < leaves.length; i++) {
    level[i] = leaves[i];
  }

  let current = level;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hashPair(current[i], current[i + 1]));
    }
    current = next;
  }

  return current[0];
}

export interface MerkleProofNode {
  sibling: string;
  position: 'left' | 'right';
}

export function verifyMerkleProof(
  leaf: string,
  proof: MerkleProofNode[],
  root: string,
): boolean {
  let current = leaf;
  for (const node of proof) {
    if (node.position === 'left') {
      current = hashPair(node.sibling, current);
    } else {
      current = hashPair(current, node.sibling);
    }
  }
  return current === root;
}

export interface VtxoProofSet {
  root: string;
  proofs: Record<VtxoId, VtxoProof>;
}

export function buildVtxoProofSet(vtxos: OmniaVtxo[]): VtxoProofSet {
  if (vtxos.length === 0) {
    return { root: EMPTY_LEAF, proofs: {} };
  }

  const sorted = [...vtxos].sort((a, b) =>
    a.vtxoId < b.vtxoId ? -1 : a.vtxoId > b.vtxoId ? 1 : 0
  );
  const leafMap = new Map<string, string>();
  const leaves: string[] = sorted.map(v => {
    const leaf = computeVtxoLeaf(v);
    leafMap.set(v.vtxoId, leaf);
    return leaf;
  });

  const size = nextPowerOfTwo(leaves.length);
  const paddedLeaves: string[] = [...leaves];
  while (paddedLeaves.length < size) paddedLeaves.push(EMPTY_LEAF);

  const levels: string[][] = [paddedLeaves];
  let current = paddedLeaves;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hashPair(current[i], current[i + 1]));
    }
    levels.push(next);
    current = next;
  }

  const root = current[0];
  const proofs: Record<VtxoId, VtxoProof> = {};

  sorted.forEach((vtxo, idx) => {
    const siblings: string[] = [];
    const positions: Array<'left' | 'right'> = [];
    let pos = idx;

    for (let lvl = 0; lvl < levels.length - 1; lvl++) {
      const isLeft = pos % 2 === 0;
      const siblingIdx = isLeft ? pos + 1 : pos - 1;
      const sibling = levels[lvl][siblingIdx] ?? EMPTY_LEAF;
      siblings.push(sibling);
      positions.push(isLeft ? 'right' : 'left');
      pos = Math.floor(pos / 2);
    }

    const leaf = leafMap.get(vtxo.vtxoId)!;
    proofs[vtxo.vtxoId] = {
      leaf,
      root,
      siblings,
      positions,
      epoch: vtxo.epoch,
      batchId: MOCK_BATCH_ID,
    };
  });

  return { root, proofs };
}

export function computeReceiptId(
  poolId: string,
  op: string,
  inputIds: string[],
  outputIds: string[],
  at: number,
): string {
  const input = [
    'receipt',
    poolId,
    op,
    inputIds.sort().join(','),
    outputIds.sort().join(','),
    at.toString(),
  ].join(':');
  return sha3hex(input);
}
