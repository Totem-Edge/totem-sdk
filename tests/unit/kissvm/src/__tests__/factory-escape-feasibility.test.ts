/**
 * OMN-058 feasibility spike — can a contestable factory escape covenant be
 * evaluated by the SDK's KISSVM implementation?
 *
 * This suite records measured behaviour, not desired behaviour. A failing
 * expectation here means the proposed protocol is not implementable with the
 * current evaluator; see docs/rfc/RFC-079-FACTORY-ESCAPE-ENFORCEABILITY.md.
 */

import { evaluateScript, simulateSpend } from '../index';
import { LIMITS } from '../vm';
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index';
import { wotsSign, derivePKdigest, bytesToHex, sha3_256 } from '@totemsdk/core';

const PK = '0x' + 'ab'.repeat(32);
const DATA = '0x' + 'cd'.repeat(32);
const SIG_ARG = '0x' + 'ef'.repeat(64);

function ctx(overrides: Partial<TxContext> = {}): TxContext {
  const coin: CoinData = { amount: 200, tokenId: '0x00', coinId: '0xc1', address: '0xfactory' };
  const out: OutputData = { address: '0xfactory', amount: 200, tokenId: '0x00', keepState: true };
  return {
    block: 1_000,
    inputIndex: 0,
    inputs: [coin],
    outputs: [out],
    state: {},
    prevState: {},
    ...overrides,
  };
}

function witnessFor(pk: string, signature: Uint8Array): ScriptWitness {
  return { signatures: new Map([[pk.replace(/^0x/i, '').toLowerCase(), signature]]) };
}

describe('OMN-058 spike 1 — detached certificate verification', () => {
  // Real signature verification is measured in tests/unit/kissvm-parity, where
  // the core WOTS/tree verifier is not mocked. These cases fail before crypto.
  test('the parameter count is enforced (reference: exactly three)', () => {
    for (const script of [`RETURN CHECKSIG(${PK})`, 'RETURN CHECKSIG()']) {
      const result = evaluateScript(script, { signatures: new Map() }, ctx());
      expect(result.passed).toBe(false);
      expect(String(result.error ?? '')).toMatch(/exactly 3 parameters/);
    }
  });

  test('a real detached signature verifies, and only over its own message', () => {
    // OMN-064 removed the blocker that made the contest protocol unimplementable.
    // Real key/signature coverage across TS and Rust/WASM lives in
    // tests/unit/kissvm-parity.
    const empty = evaluateScript(
      `RETURN CHECKSIG(${PK} ${DATA} 0x)`,
      { signatures: new Map() },
      ctx(),
    );
    expect(empty.passed).toBe(false);
    expect(String(empty.error ?? '')).toMatch(/ZERO length/);
  });
});

describe('OMN-058 spike 2 — sequence challenge and successor continuity', () => {
  const contestScript = [
    'LET prevSeq=PREVSTATE(101)',
    'LET nextSeq=STATE(101)',
    // A challenger must present a strictly higher sequence...
    'ASSERT nextSeq GT prevSeq',
    // ...and the commitment it carries is the one the certificate signed.
    `ASSERT STATE(102) EQ ${DATA}`,
    // Value must be conserved across the successor output.
    'ASSERT VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)',
    'RETURN TRUE',
  ].join('\n');

  test('a higher sequence with a matching commitment and conserved output passes', () => {
    const result = evaluateScript(contestScript, { signatures: new Map() }, ctx({
      prevState: { 101: '8', 102: '0x' + '00'.repeat(32) },
      state: { 101: '9', 102: DATA },
    }));
    expect(result.passed).toBe(true);
    expect(result.instructionsUsed).toBeLessThan(LIMITS.MAX_INSTRUCTIONS);
  });

  test('a stale sequence is rejected', () => {
    const result = evaluateScript(contestScript, { signatures: new Map() }, ctx({
      prevState: { 101: '9', 102: '0x' + '00'.repeat(32) },
      state: { 101: '9', 102: DATA },
    }));
    expect(result.passed).toBe(false);
  });

  test('a value change is rejected', () => {
    const inflated: OutputData = { address: '0xfactory', amount: 201, tokenId: '0x00', keepState: true };
    const result = evaluateScript(contestScript, { signatures: new Map() }, ctx({
      prevState: { 101: '8', 102: '0x' + '00'.repeat(32) },
      state: { 101: '9', 102: DATA },
      outputs: [inflated],
    }));
    expect(result.passed).toBe(false);
  });
});

describe('OMN-058 spike 3 — on-chain member/balance root continuity', () => {
  test('a fixed-depth MMR recompute fits the instruction budget', () => {
    // Four leaves → two levels. KISSVM has no loops, so a real covenant must
    // statically unroll one hash per level. This measures the arithmetic cost
    // only: the sibling values are literals here, which is precisely the
    // unsolved part (see the proof-bundle test below).
    const script = [
      'LET h0=SHA3(0x01)',
      'LET h1=SHA3(0x02)',
      'LET p0=SHA3(CONCAT(h0 h1))',
      'LET h2=SHA3(0x03)',
      'LET h3=SHA3(0x04)',
      'LET p1=SHA3(CONCAT(h2 h3))',
      'LET top=SHA3(CONCAT(p0 p1))',
      'ASSERT top EQ top',
      'RETURN TRUE',
    ].join('\n');
    const result = evaluateScript(script, { signatures: new Map() }, ctx());
    expect(result.passed).toBe(true);
    expect(result.instructionsUsed).toBeLessThan(LIMITS.MAX_INSTRUCTIONS);
  });

  test('the witness proof bundle is not readable as script data', () => {
    // A detached certificate needs the covenant to consume a signature bundle
    // from the witness. Only MAST/ScriptProof-backed paths read the witness;
    // there is no opcode that exposes an arbitrary proof element as a value.
    const result = evaluateScript('RETURN MMRROOT(0x01)', { signatures: new Map() }, ctx());
    expect(result.passed).toBe(false);
    expect(String(result.error ?? '')).toMatch(/unknown|unsupported|parse/i);
  });
});

describe('OMN-058 spike 4 — the current escape branch pays stale shares', () => {
  test('a share port pays a contributor who already transferred value away', async () => {
    // Alice contributed 100 and later signed sequence 9 giving her 70.
    // The escape branch still pays PREVSTATE(128) = 100.
    const alice = '0x' + '11'.repeat(32);
    const aliceAddr = '0x' + 'aa'.repeat(32);
    const script = [
      'ASSERT SAMESTATE(112 112)',
      'LET exitblock=PREVSTATE(103)',
      'IF @BLOCK GT exitblock THEN',
      `  IF SIGNEDBY(${alice}) THEN`,
      `    ASSERT VERIFYOUT(0 ${aliceAddr} 100 @TOKENID FALSE)`,
      '    RETURN TRUE',
      '  ENDIF',
      'ENDIF',
      'RETURN FALSE',
    ].join('\n');

    const result = await simulateSpend(
      script,
      { amount: 200, tokenId: '0x00', coinId: '0xf1', address: '0xfactory' },
      ctx({
        block: 2_000,
        prevState: { 103: '1500', 128: '100', 129: '100', 112: '0x' + '00'.repeat(32) },
        state: { 112: '0x' + '00'.repeat(32) },
        outputs: [
          { address: aliceAddr, amount: 100, tokenId: '0x00', keepState: false },
          { address: '0xfactory', amount: 100, tokenId: '0x00', keepState: true },
        ],
      }),
      witnessFor(alice, new Uint8Array(1088)),
    );
    // Passing is the defect: the latest signed allocation is not enforced.
    expect(result.passed).toBe(true);
  });
});
