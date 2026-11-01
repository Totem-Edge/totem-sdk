/**
 * Cross-language parity: the Rust/WASM mirror must compute the same
 * state-commitment v2 as the TypeScript implementation.
 *
 * This is the first parity gate for the mirror. It is skipped when the wasm node
 * build is absent (CI builds it in the rust job; the local harnesses require it).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildUpdateTx, computeOmniaTxDigest, computeStateCommitmentV2, serializeTxDraft } from '../transactions';
import type { HTLCRecord, OmniaChannel } from '../types';

const WASM_PATH = join(__dirname, '../../../../../packages/omnia/rust/pkg-node/omnia_wasm.js');
const hasWasm = existsSync(WASM_PATH);
const requireWasm = createRequire(__filename);
const wasm = hasWasm ? requireWasm(WASM_PATH) : null;

const hex = (u8: Uint8Array) => Buffer.from(u8).toString('hex');

function makeChannel(): OmniaChannel {
  const script = 'LET settlement=STATE(100)\nRETURN TRUE';
  return {
    channelId: '0xparity000000001',
    fundingTxId: '0xtxpow0',
    fundingCoinId: '0x' + 'aa'.repeat(32),
    fundingScript: script,
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + 'bb'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: 'aabbccdd'.repeat(8), addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '11223344'.repeat(8), addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * The Rust mirror consumes the serialized (string) form — the same form
 * `serializeChannel`/persistence produce. Accepting native bigint at the wasm
 * boundary is a remaining parity item (audit finding 24).
 */
function forRust(channel: OmniaChannel): Record<string, unknown> {
  return {
    ...channel,
    totalValue: channel.totalValue.toString(),
    balances: Object.fromEntries(Object.entries(channel.balances).map(([k, v]) => [k, v.toString()])),
    pendingHTLCs: channel.pendingHTLCs.map(h => ({
      ...h,
      amount: h.amount.toString(),
      timeoutBlock: h.timeoutBlock.toString(),
    })),
  };
}

const htlc: HTLCRecord = {
  htlcId: '0xhtlc01',
  amount: 100n,
  hashlock: '0x' + '11'.repeat(32),
  timeoutBlock: 500n,
  direction: 'offered',
  status: 'pending',
  htlcAddress: '0x' + 'cc'.repeat(32),
  senderPublicKeyDigest: 'aabbccdd'.repeat(8),
  recipientPublicKeyDigest: '11223344'.repeat(8),
};

(hasWasm ? describe : describe.skip)('@totemsdk/omnia — Rust state-commitment parity', () => {
  it('computes the same commitment v2 as TypeScript', () => {
    const channel = makeChannel();
    const balances = { alice: 500n, bob: 400n };
    const programStateVariables = [
      { port: 120, value: 7n, type: 'number' as const },
      { port: 121, value: true, type: 'bool' as const },
    ];

    const ts = computeStateCommitmentV2(channel, 1, balances, [htlc], {
      settlement: false,
      programStateVariables,
    });

    const rust = wasm.compute_state_commitment_v2_wasm(
      forRust({ ...channel, pendingHTLCs: [htlc] }),
      1,
      { alice: '500', bob: '400' },
      [{ ...htlc, amount: '100', timeoutBlock: '500' }],
      false,
      [{ port: 120, value: 7, type: 'number' }, { port: 121, value: true, type: 'bool' }],
    );

    expect(rust.toLowerCase()).toBe(hex(ts).toLowerCase());
  });

  it('serialises the same canonical bytes and digest as TypeScript', () => {
    const channel = makeChannel();
    const draft = buildUpdateTx(channel, 1, { alice: 500n, bob: 400n }, []);
    const txHex = serializeTxDraft(draft);
    const tsDigest = '0x' + Buffer.from(computeOmniaTxDigest(draft)).toString('hex');
    const rustDigest = wasm.compute_tx_digest_wasm(txHex);
    expect(rustDigest.toLowerCase()).toBe(tsDigest.toLowerCase());
  });

  it('agrees on the settlement flag', () => {
    const channel = makeChannel();
    const balances = { alice: 500n, bob: 400n };
    const ts = computeStateCommitmentV2(channel, 1, balances, [], { settlement: true });
    const rust = wasm.compute_state_commitment_v2_wasm(
      forRust(channel),
      1,
      { alice: '500', bob: '400' },
      [],
      true,
      [],
    );
    expect(rust.toLowerCase()).toBe(hex(ts).toLowerCase());
  });
});
