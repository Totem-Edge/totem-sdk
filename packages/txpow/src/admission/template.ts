/**
 * admission/template.ts — Minima block-candidate template handling.
 *
 * Builds a TxHeader tail that is structurally capable of becoming a legitimate
 * Minima block. The fields (block number, block difficulty, super-parents, MMR
 * root/total, magic, time) come from the current chain tip via an injected
 * MinimaWorkTemplateProvider — mirroring TxPoWGenerator.generateTxPoW in
 * Minima. The action commitment is placed in the header's customHash field.
 *
 * The TxPoW package stays transport/node-client agnostic: callers inject the
 * template provider. A real Minima node / Axia integration supplies live chain
 * state; tests supply fixtures.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  writeMiniNumber,
  writeMiniData,
  writeHashToStream,
  concat,
} from '@totemsdk/core';
import { serializeMagic } from '../magic.js';
import { CASCADE_LEVELS } from '../constants.js';
import type { MinimaWorkTemplate } from './types.js';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return out;
}

/**
 * Serialize the super-parent RLE runs per TxHeader.writeDataStream.
 *
 * Consecutive equal hashes are coalesced into (count: MiniByte, hash) runs.
 * A fresh candidate with all-distinct parents serializes as 32 runs.
 */
export function serializeSuperParents(superParents: string[]): Uint8Array {
  if (superParents.length !== CASCADE_LEVELS) {
    throw new Error(
      `superParents must have ${CASCADE_LEVELS} entries, got ${superParents.length}`
    );
  }
  const parts: Uint8Array[] = [];
  let runHash = superParents[0];
  let runCount = 1;
  for (let i = 1; i < superParents.length; i++) {
    if (superParents[i] === runHash) {
      runCount++;
    } else {
      parts.push(new Uint8Array([runCount]));
      parts.push(writeHashToStream(hexToBytes(runHash)));
      runHash = superParents[i];
      runCount = 1;
    }
  }
  parts.push(new Uint8Array([runCount]));
  parts.push(writeHashToStream(hexToBytes(runHash)));
  return concat(...parts);
}

/**
 * Build the TxHeader tail (everything after the nonce field) for a block
 * candidate with the given customHash commitment.
 *
 * Field order (TxHeader.writeDataStream):
 *   mNonce | mChainID | mTimeMilli | mBlockNumber | mBlockDifficulty |
 *   super-parents RLE | mMMRRoot | mMMRTotal | mMagic | mCustomHash | mTxBodyHash
 *
 * @param template     The current Minima work template.
 * @param customHash   The action commitment (32-byte hex) to place in mCustomHash.
 * @param txBodyHash   SHA3-256 of the serialized TxBody (32-byte hex).
 */
export function buildBlockHeaderTail(
  template: MinimaWorkTemplate,
  customHash: string,
  txBodyHash: string
): Uint8Array {
  return concat(
    writeMiniData(hexToBytes(template.chainId)),
    writeMiniNumber(template.timeMilli, 0),
    writeMiniNumber(template.blockNumber, 0),
    writeMiniData(hexToBytes(template.blockDifficulty)),
    serializeSuperParents(template.superParents),
    writeHashToStream(hexToBytes(template.mmrRoot)),
    writeMiniNumber(template.mmrTotal, 0),
    hexToBytes(template.magic),
    writeHashToStream(hexToBytes(customHash)),
    writeHashToStream(hexToBytes(txBodyHash))
  );
}

/**
 * Compute the TxPoW ID for a mined block-candidate header.
 * txpowId = SHA3-256(serialized TxHeader).
 */
export function computeBlockCandidateId(headerBytes: Uint8Array): Uint8Array {
  return sha3_256(headerBytes);
}

/**
 * Check whether a txpowId beats the block target (i.e. is a genuine L1 winner).
 * valid = txpowId < blockDifficulty (big-endian 256-bit comparison).
 */
export function isBlockWinner(txpowId: Uint8Array, blockDifficulty: string): boolean {
  const target = hexToBytes(blockDifficulty);
  for (let i = 0; i < 32; i++) {
    if (txpowId[i] < target[i]) return true;
    if (txpowId[i] > target[i]) return false;
  }
  return false;
}

/**
 * Default staleness policy: a template is "current enough" for admission if it
 * was captured within the window, and "current" for L1 broadcast if it matches
 * the latest template id.
 */
export function templateFreshness(
  template: MinimaWorkTemplate,
  latest: MinimaWorkTemplate | null,
  options?: { admissionWindowMs?: number; now?: number }
): { admissionValid: boolean; broadcastable: boolean } {
  const now = options?.now ?? Date.now();
  const windowMs = options?.admissionWindowMs ?? 5 * 60 * 1000;
  const age = now - template.capturedAt;
  const admissionValid = age >= 0 && age <= windowMs;
  const broadcastable = latest !== null && template.templateId === latest.templateId;
  return { admissionValid, broadcastable };
}
