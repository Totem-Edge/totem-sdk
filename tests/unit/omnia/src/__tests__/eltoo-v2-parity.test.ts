/**
 * OMN-097 — v2 channel-domain parity fixture.
 *
 * The exact script and the eight evaluation cases below are also embedded in
 * `hawk-node/tests/parity/kernel/kernel_digest.cpp` and
 * `hawk-node/tests/parity/kernel/KernelOracle.java`. The Hawk (C++) and pinned
 * Java oracle outputs are compared line-for-line by
 * `tests/parity/kernel/run_kernel.sh`; this test pins the same fixture against
 * the SDK's TypeScript KISSVM evaluator.
 *
 * Fixed inputs:
 *   channelId = 0x1111111111111111 (16 bytes)
 *   parties   = 0xaa…aa, 0xbb…bb
 *   delay     = 256
 *   domain    = SHA3-256("0x1111111111111111") = 0x2b7b5009…0cac
 */
import { evaluateScript } from '@totemsdk/kissvm';
import { buildEltooScript } from '../script';

const ALICE = { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0 };
const BOB = { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 };
const CHANNEL_ID = '0x' + '11'.repeat(16);
const DOMAIN = '0x2B7B5009A11FA2D50FB45D70E271AA315FF3DF9BF44F02223166A7959AEF0CAC';
const SIBLING = '0x' + '22'.repeat(32);

const SCRIPT = buildEltooScript([ALICE, BOB], 256, { domainId: CHANNEL_ID });

const EXPECTED_SCRIPT = [
  'LET settlement=STATE(100)',
  'LET sequence=STATE(101)',
  'LET prevsequence=PREVSTATE(101)',
  'LET domain=STATE(103)',
  'LET prevdomain=PREVSTATE(103)',
  `ASSERT domain EQ ${DOMAIN}`,
  `LET bothsigned=MULTISIG(2 0x${'AA'.repeat(32)} 0x${'BB'.repeat(32)})`,
  'IF settlement THEN',
  '    ASSERT bothsigned',
  '    ASSERT domain EQ prevdomain',
  '    ASSERT sequence EQ prevsequence',
  '    ASSERT @COINAGE GTE 256',
  '    RETURN TRUE',
  'ENDIF',
  'ASSERT bothsigned',
  'ASSERT sequence GT prevsequence',
  'ASSERT domain EQ prevdomain',
  'RETURN TRUE',
].join('\n');

interface Case {
  label: string;
  settlement: boolean;
  sequence: number;
  prevSequence: number;
  stateDomain?: string;
  prevDomain?: string;
  block: number;
  created: number;
  expected: boolean;
}

const CASES: Case[] = [
  { label: 'update-ok', settlement: false, sequence: 2, prevSequence: 1, stateDomain: DOMAIN, prevDomain: DOMAIN, block: 1000, created: 1, expected: true },
  { label: 'update-sibling-domain', settlement: false, sequence: 2, prevSequence: 1, stateDomain: SIBLING, prevDomain: DOMAIN, block: 1000, created: 1, expected: false },
  { label: 'update-changed-domain', settlement: false, sequence: 2, prevSequence: 1, stateDomain: DOMAIN, prevDomain: SIBLING, block: 1000, created: 1, expected: false },
  { label: 'update-missing-domain', settlement: false, sequence: 2, prevSequence: 1, prevDomain: DOMAIN, block: 1000, created: 1, expected: false },
  { label: 'settlement-ok', settlement: true, sequence: 2, prevSequence: 2, stateDomain: DOMAIN, prevDomain: DOMAIN, block: 257, created: 1, expected: true },
  { label: 'settlement-short-coinage', settlement: true, sequence: 2, prevSequence: 2, stateDomain: DOMAIN, prevDomain: DOMAIN, block: 256, created: 1, expected: false },
  { label: 'settlement-sibling-domain', settlement: true, sequence: 2, prevSequence: 2, stateDomain: SIBLING, prevDomain: SIBLING, block: 257, created: 1, expected: false },
  { label: 'settlement-changed-domain', settlement: true, sequence: 2, prevSequence: 2, stateDomain: DOMAIN, prevDomain: SIBLING, block: 257, created: 1, expected: false },
];

describe('OMN-097: v2 channel-domain parity fixture', () => {
  it('emits the script pinned by the Hawk and Java parity harnesses', () => {
    expect(SCRIPT).toBe(EXPECTED_SCRIPT);
  });

  it.each(CASES)('$label evaluates to $expected in the SDK evaluator', (c) => {
    const state: Record<number, string> = {
      100: c.settlement ? 'true' : 'false',
      101: String(c.sequence),
      ...(c.stateDomain ? { 103: c.stateDomain } : {}),
    };
    const prevState: Record<number, string> = {
      101: String(c.prevSequence),
      ...(c.prevDomain ? { 103: c.prevDomain } : {}),
    };
    const signatures = new Map<string, Uint8Array>([
      [ALICE.publicKeyDigest.slice(2).toLowerCase(), new Uint8Array([1])],
      [BOB.publicKeyDigest.slice(2).toLowerCase(), new Uint8Array([1])],
    ]);
    const result = evaluateScript(
      SCRIPT,
      { signatures },
      {
        block: c.block,
        inputIndex: 0,
        inputs: [{
          coinId: '0x' + '11'.repeat(32),
          address: '0x' + '33'.repeat(32),
          amount: '1000',
          tokenId: '0x00',
          coinCreatedBlock: c.created,
        }],
        outputs: [],
        state,
        prevState,
        // No txDigest: the witness is treated as present (simulation mode), which
        // isolates the covenant/domain logic this fixture is about.
        simulationMode: true,
      },
    );
    expect(result.passed).toBe(c.expected);
  });
});
