/**
 * Shared CHECKSIG fixtures for cross-evaluator parity (OMN-064).
 *
 * Every evaluator must agree with the reference implementation
 * (`org.minima.kissvm.functions.sigs.CHECKSIG`):
 *
 *   CHECKSIG(publickey data signature) → verify(signature, data, publickey)
 *
 * It must *not* consult the contract witness or the transaction digest.
 *
 * `wasmSupport` records whether the Rust/WASM evaluator can verify the case.
 * Tree signatures (the on-chain form) are supported since OMN-065: core-wasm
 * gained a `TreeSignature` byte reader and the Rust CHECKSIG branch uses it.
 */

import {
  bytesToHex,
  createUnifiedChildTreeKey,
  derivePKdigest,
  serializeTreeSignature,
  sha3_256,
  wotsSign,
} from '@totemsdk/core';

export interface ChecksigFixture {
  name: string;
  script: string;
  /** Witness is present only to prove it is ignored. */
  witness: Record<string, string>;
  /** Expected pass/fail from the reference semantics. */
  expected: boolean;
  /**
   * Whether the Rust/WASM evaluator can verify the case. Kept explicit so a
   * future regression (or a newly added case) cannot silently lose coverage.
   */
  wasmSupport: 'supported' | 'pending-tree-signature';
  note: string;
}

const MESSAGE = sha3_256(new TextEncoder().encode('factory recovery certificate'));
const OTHER_MESSAGE = sha3_256(new TextEncoder().encode('stale factory certificate'));

function hex(value: Uint8Array): string {
  return '0x' + bytesToHex(value).toLowerCase();
}

function treeFixture(
  name: string,
  keySeed: number,
  data: Uint8Array,
  signData: Uint8Array,
  expected: boolean,
  note: string,
  signingSeed: number = keySeed,
): ChecksigFixture {
  const tree = createUnifiedChildTreeKey(new Uint8Array(32).fill(signingSeed), 0);
  const publicKey = createUnifiedChildTreeKey(new Uint8Array(32).fill(keySeed), 0).getPublicKey();
  const signature = serializeTreeSignature(tree.sign(signData));
  return {
    name,
    script: `RETURN CHECKSIG(${hex(publicKey)} ${hex(data)} ${hex(signature)})`,
    witness: {},
    expected,
    wasmSupport: 'supported',
    note,
  };
}

function wotsFixture(
  name: string,
  seedValue: number,
  data: Uint8Array,
  signData: Uint8Array,
  expected: boolean,
  note: string,
  witness: Record<string, string> = {},
): ChecksigFixture {
  const seed = new Uint8Array(32).fill(seedValue);
  const publicKey = derivePKdigest(seed, 0);
  const signature = wotsSign(seed, 0, signData);
  return {
    name,
    script: `RETURN CHECKSIG(${hex(publicKey)} ${hex(data)} ${hex(signature)})`,
    witness,
    expected,
    wasmSupport: 'supported',
    note,
  };
}

export function buildChecksigFixtures(): ChecksigFixture[] {
  const fixtures: ChecksigFixture[] = [
    treeFixture(
      'tree-signature-over-message',
      11,
      MESSAGE,
      MESSAGE,
      true,
      'The on-chain form: a canonical tree signature over the supplied data.',
    ),
    treeFixture(
      'tree-signature-wrong-data',
      11,
      OTHER_MESSAGE,
      MESSAGE,
      false,
      'Same signature, different data: the data argument is load-bearing.',
    ),
    treeFixture(
      'tree-signature-wrong-key',
      11,
      MESSAGE,
      MESSAGE,
      false,
      'A signature from another key must not authorize this data (wrong root).',
      12,
    ),
    wotsFixture(
      'wots-signature-over-message',
      21,
      MESSAGE,
      MESSAGE,
      true,
      'Flat WOTS form, used by SDK fixtures.',
    ),
    wotsFixture(
      'wots-signature-wrong-data',
      21,
      OTHER_MESSAGE,
      MESSAGE,
      false,
      'A valid signature over another message is not a certificate for this one.',
    ),
    wotsFixture(
      'witness-is-ignored',
      22,
      MESSAGE,
      MESSAGE,
      true,
      'An unrelated witness signature must not change the verdict.',
      { ['ab'.repeat(32)]: '00'.repeat(1088) },
    ),
    {
      name: 'one-argument-rejected',
      script: `RETURN CHECKSIG(${hex(derivePKdigest(new Uint8Array(32).fill(23), 0))})`,
      witness: {},
      expected: false,
      wasmSupport: 'supported',
      note: 'The reference implementation requires exactly three parameters.',
    },
    {
      name: 'zero-argument-rejected',
      script: 'RETURN CHECKSIG()',
      witness: {},
      expected: false,
      wasmSupport: 'supported',
      note: 'Legacy witness-only CHECKSIG() is not a node-valid form.',
    },
    {
      name: 'empty-signature-rejected',
      script: `RETURN CHECKSIG(${hex(derivePKdigest(new Uint8Array(32).fill(24), 0))} ${hex(MESSAGE)} 0x)`,
      witness: {},
      expected: false,
      wasmSupport: 'supported',
      note: 'Zero-length signature is an execution error upstream.',
    },
    {
      name: 'non-hex-data-rejected',
      script: `RETURN CHECKSIG(${hex(derivePKdigest(new Uint8Array(32).fill(25), 0))} 42 0x00)`,
      witness: {},
      expected: false,
      wasmSupport: 'supported',
      note: 'getHexParam requires HEX; a bare number is rejected.',
    },
  ];
  return fixtures;
}
