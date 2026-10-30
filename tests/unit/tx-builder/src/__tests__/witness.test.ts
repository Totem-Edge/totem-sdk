/**
 * RFC-009 — canonical Minima witness serializer (`buildMinimaWitnessBytes`).
 *
 * The witness is `[MiniNumber(count)][Signature…][MiniNumber(0)][MiniNumber(0)]`
 * where each `Signature` is serialized byte-identically to Java
 * `Signature.writeDataStream()`. Round-trips and re-parses the signatures.
 */

import {
  TreeKey,
  bytesToHex,
  sha3_256,
  concatBytes,
  writeMiniNumber,
  serializeTreeSignature,
  deserializeTreeSignature,
} from '@totemsdk/core';
import type { TreeSignature } from '@totemsdk/core';
import { buildMinimaWitnessBytes } from '../witness.js';

const owner = new TreeKey(new Uint8Array(32).fill(0x41), 4, 2);
const se = new TreeKey(new Uint8Array(32).fill(0x42), 4, 2);
const DIGEST = sha3_256(new TextEncoder().encode('witness-test-digest'));

function parse(data: Uint8Array): TreeSignature[] {
  let offset = 2 + data[1]; // leading MiniNumber(count)
  const count = data[2];
  const sigs: TreeSignature[] = [];
  for (let i = 0; i < count; i++) {
    const sig = deserializeTreeSignature(data.slice(offset));
    sigs.push(sig);
    offset += serializeTreeSignature(sig).length;
  }
  expect(data.slice(offset)).toEqual(concatBytes(writeMiniNumber(0n, 0), writeMiniNumber(0n, 0)));
  return sigs;
}

describe('buildMinimaWitnessBytes (RFC-009)', () => {
  it('serializes owner + SE tree signatures and round-trips them', () => {
    const ownerSig = owner.sign(DIGEST);
    const seSig = se.sign(DIGEST);
    const bytes = buildMinimaWitnessBytes([ownerSig, seSig]);

    const parsed = parse(bytes);
    expect(parsed).toHaveLength(2);
    expect(bytesToHex(serializeTreeSignature(parsed[0]))).toBe(bytesToHex(serializeTreeSignature(ownerSig)));
    expect(bytesToHex(serializeTreeSignature(parsed[1]))).toBe(bytesToHex(serializeTreeSignature(seSig)));
  });

  it('encodes an empty signature list as three empty MiniNumbers', () => {
    const bytes = buildMinimaWitnessBytes([]);
    const empty = writeMiniNumber(0n, 0);
    expect(bytes).toEqual(concatBytes(concatBytes(empty, empty), empty));
  });
});
