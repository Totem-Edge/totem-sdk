import * as fs from 'fs';
import * as path from 'path';
import {
  programBoolState,
  programHexState,
  programNumberState,
  programStringState,
} from '../state-vars';
import {
  ASSET_HOLDER_A_BALANCE_PORT,
  ASSET_HOLDER_B_BALANCE_PORT,
  ASSET_TOKEN_ID_PORT,
  ASSET_TOTAL_PORT,
  COUNTER_PROGRAM_ID,
  COUNTER_STATE_PORT,
  COUNTER_ACTION_PORT,
  COUNTER_OPERAND_PORT,
  HTLC_HASHLOCK_PORT,
  HTLC_LOCKED_AMOUNT_PORT,
  HTLC_TIMEOUT_BLOCK_PORT,
  HTLC_CLAIMED_PORT,
  HTLC_PREIMAGE_PORT,
  MEMBERSHIP_MEMBER_ROOT_PORT,
  MEMBERSHIP_DIVIDEND_POOL_PORT,
  MEMBERSHIP_PAYOUT_SEQUENCE_PORT,
  METER_READING_PORT,
  METER_USAGE_DELTA_PORT,
  METER_UNIT_PRICE_PORT,
  METER_PAYMENT_PORT,
  TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT,
  TREASURY_VOTE_TALLY_HASH_PORT,
  TREASURY_SPEND_CAP_PORT,
  TREASURY_SPENT_PORT,
  TREASURY_OUTCOME_PROOF_ID_PORT,
  VAULT_LOCKED_VALUE_PORT,
  VAULT_RELEASE_SEQUENCE_PORT,
  VAULT_SWEPT_PORT,
} from '../program';
import { serializeChannelSnapshot, snapshotChannel } from '../persistence';
import { serializeProgramTransition } from '../transition';
import type { OmniaChannel, ProgramTransition, SignedChannelState } from '../types';

// Regenerates the golden parity fixtures from type-checked TypeScript output.
// Run `REGENERATE=1 pnpm --dir packages/omnia exec jest parity-fixtures --runInBand`
// after intentional TypeScript changes, then review the diff.
// Without the flag it verifies the committed fixtures still match fresh TypeScript output.

const outDir = path.resolve(__dirname, 'fixtures', 'parity');
const regenerate = process.env.REGENERATE === '1';

const alice = { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0 };
const bob = { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 };

function makeState(stateVariables: SignedChannelState['stateVariables'], balances: Record<string, bigint> = { alice: 600n, bob: 400n }): SignedChannelState {
  return {
    sequence: 7,
    balances,
    pendingHTLCs: [],
    stateVariables,
    transactionHex: '0xupdate',
    signatures: { alice: new Uint8Array([1, 2]), bob: new Uint8Array([3, 4]) },
    signingIndices: {
      alice: { addressIndex: 0, l1: 7, l2: 0 },
      bob: { addressIndex: 1, l1: 7, l2: 0 },
    },
  };
}

function makeChannel(overrides: Partial<OmniaChannel> = {}): OmniaChannel {
  return {
    channelId: '0xchannel',
    fundingTxId: '0xfunding',
    fundingCoinId: '0xcoin',
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0xaddress',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [alice, bob],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 7,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

function snapshotJson(channel: OmniaChannel): Record<string, unknown> {
  return JSON.parse(serializeChannelSnapshot(snapshotChannel(channel, 1700000000000)));
}

function buildFixtures(): Record<string, unknown> {
  // ─── default channel snapshot ────────────────────────────────────────────────
  const defaultState = makeState([]);
  const defaultChannel = makeChannel({ latestState: defaultState });

  // ─── counter increment transition + expected state ───────────────────────────
  const counterTransition: ProgramTransition = { action: 'increment', inputs: { by: '5' } };

  // ─── meter reading transition + expected state ───────────────────────────────
  const meterTransition: ProgramTransition = { action: 'record_reading', inputs: { reading: '110', unitPrice: '2' } };

  // ─── recoverable close snapshot ──────────────────────────────────────────────
  const closeState = makeState(
    [programNumberState(COUNTER_STATE_PORT, 42n)],
    { alice: 600n, bob: 400n },
  );
  closeState.closePackage = {
    version: 1,
    channelId: '0xchannel',
    sequence: 7,
    stateCommitmentV2: 'ab'.repeat(32),
    update: {
      txHex: '0xupdate',
      txDigest: 'cd'.repeat(32),
      signatures: { alice: new Uint8Array([1, 2]), bob: new Uint8Array([3, 4]) },
      signingIndices: {
        alice: { addressIndex: 0, l1: 7, l2: 0 },
        bob: { addressIndex: 1, l1: 7, l2: 0 },
      },
    },
    settlement: {
      txHex: '0xsettlement',
      txDigest: 'ef'.repeat(32),
      signatures: { alice: new Uint8Array([5, 6]), bob: new Uint8Array([7, 8]) },
      signingIndices: {
        alice: { addressIndex: 0, l1: 7, l2: 0 },
        bob: { addressIndex: 1, l1: 7, l2: 0 },
      },
    },
  };
  const closeChannel = makeChannel({
    programId: COUNTER_PROGRAM_ID,
    latestState: closeState,
    currentSequence: 7,
  });

  // ─── unilateral close snapshot ───────────────────────────────────────────────
  const unilateralChannel = makeChannel({
    programId: COUNTER_PROGRAM_ID,
    latestState: closeState,
    currentSequence: 7,
    status: 'closing_unilateral',
    unilateralClose: {
      channelId: '0xchannel',
      sequence: 7,
      updateTxHex: '0xupdate',
      settlementTxHex: '0xsettlement',
      contestStartBlock: 100,
      contestDeadlineBlock: 200,
      status: 'update_broadcast',
      updateTxpowId: '0xpow',
    },
  });

  // ─── pending proposal snapshot ───────────────────────────────────────────────
  const pendingChannel = makeChannel({
    programId: COUNTER_PROGRAM_ID,
    latestState: closeState,
    currentSequence: 7,
    pendingProposal: { sequence: 8, payloadHash: '0xpayload' },
  });

  // ─── invalid balance snapshot ────────────────────────────────────────────────
  const invalidState = makeState([programNumberState(COUNTER_STATE_PORT, 42n)], { alice: 600n, bob: 300n });
  const invalidChannel = makeChannel({
    programId: COUNTER_PROGRAM_ID,
    latestState: invalidState,
  });
  invalidChannel.balances = { alice: 600n, bob: 300n };

  // ─── legacy raw channel JSON ─────────────────────────────────────────────────
  const legacyChannel: Record<string, unknown> = {
    channelId: '0xlegacy',
    fundingTxId: '0xfunding',
    fundingCoinId: '0xcoin',
    fundingScript: 'RETURN TRUE',
    fundingAddress: '0xaddress',
    tokenId: '0x00',
    totalValue: { __omniaBigInt: '1000' },
    parties: [alice, bob],
    balances: { alice: { __omniaBigInt: '600' }, bob: { __omniaBigInt: '400' } },
    status: 'active',
    channelType: 'direct',
    createdAt: 1000,
    updatedAt: 2000,
  };

  return {
    'default-channel.snapshot.json': snapshotJson(defaultChannel),
    'counter-increment.transition.json': counterTransition,
    'counter-increment.canonical.json': JSON.parse(serializeProgramTransition(counterTransition)),
    'counter-state.expected.json': [
      { port: COUNTER_STATE_PORT, value: '15', type: 'number' },
      { port: COUNTER_ACTION_PORT, value: '1', type: 'number' },
      { port: COUNTER_OPERAND_PORT, value: '5', type: 'number' },
    ],
    'meter-reading.transition.json': meterTransition,
    'meter-state.expected.json': [
      { port: METER_READING_PORT, value: '110', type: 'number' },
      { port: METER_USAGE_DELTA_PORT, value: '10', type: 'number' },
      { port: METER_UNIT_PRICE_PORT, value: '2', type: 'number' },
      { port: METER_PAYMENT_PORT, value: '20', type: 'number' },
    ],
    'htlc-add.transition.json': { action: 'add', inputs: { hashlock: '0x0123', amount: '250', timeoutBlock: '200' } },
    'htlc-state.expected.json': [
      { port: HTLC_HASHLOCK_PORT, value: '0x0123', type: 'hex' },
      { port: HTLC_LOCKED_AMOUNT_PORT, value: '250', type: 'number' },
      { port: HTLC_TIMEOUT_BLOCK_PORT, value: '200', type: 'number' },
      { port: HTLC_CLAIMED_PORT, value: false, type: 'bool' },
      { port: HTLC_PREIMAGE_PORT, value: '', type: 'hex' },
    ],
    'vault-lock.transition.json': { action: 'lock', inputs: { amount: '800', releaseSequence: '50' } },
    'vault-state.expected.json': [
      { port: VAULT_LOCKED_VALUE_PORT, value: '800', type: 'number' },
      { port: VAULT_RELEASE_SEQUENCE_PORT, value: '50', type: 'number' },
      { port: VAULT_SWEPT_PORT, value: false, type: 'bool' },
    ],
    'treasury-configure.transition.json': {
      action: 'configure',
      inputs: { membershipSnapshotHash: 'snap-1', voteTallyHash: 'tally-1', spendCap: '1000', outcomeProofId: 'proof-1' },
    },
    'treasury-state.expected.json': [
      { port: TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, value: 'snap-1', type: 'string' },
      { port: TREASURY_VOTE_TALLY_HASH_PORT, value: 'tally-1', type: 'string' },
      { port: TREASURY_SPEND_CAP_PORT, value: '1000', type: 'number' },
      { port: TREASURY_SPENT_PORT, value: '0', type: 'number' },
      { port: TREASURY_OUTCOME_PROOF_ID_PORT, value: 'proof-1', type: 'string' },
    ],
    'membership-add.transition.json': { action: 'member_add', inputs: { memberRoot: '0xABCD' } },
    'membership-state.expected.json': [
      { port: MEMBERSHIP_MEMBER_ROOT_PORT, value: 'abcd', type: 'hex' },
      { port: MEMBERSHIP_DIVIDEND_POOL_PORT, value: '0', type: 'number' },
      { port: MEMBERSHIP_PAYOUT_SEQUENCE_PORT, value: '0', type: 'number' },
    ],
    'asset-configure.transition.json': {
      action: 'configure',
      inputs: { tokenId: '0xABCD', holderABalance: '300', holderBBalance: '200' },
    },
    'asset-state.expected.json': [
      { port: ASSET_TOKEN_ID_PORT, value: 'abcd', type: 'hex' },
      { port: ASSET_HOLDER_A_BALANCE_PORT, value: '300', type: 'number' },
      { port: ASSET_HOLDER_B_BALANCE_PORT, value: '200', type: 'number' },
      { port: ASSET_TOTAL_PORT, value: '500', type: 'number' },
    ],
    'recoverable-close.snapshot.json': snapshotJson(closeChannel),
    'unilateral-close.snapshot.json': snapshotJson(unilateralChannel),
    'pending-proposal.snapshot.json': snapshotJson(pendingChannel),
    'invalid-balance.snapshot.json': snapshotJson(invalidChannel),
    'legacy-channel.json': legacyChannel,
  };
}

describe('parity golden fixtures', () => {
  const fixtures = buildFixtures();

  if (regenerate) {
    it('writes regenerated fixtures for review', () => {
      fs.mkdirSync(outDir, { recursive: true });
      for (const [name, content] of Object.entries(fixtures)) {
        fs.writeFileSync(path.join(outDir, name), JSON.stringify(content, null, 2) + '\n');
      }
      // eslint-disable-next-line no-console
      console.log(`regenerated ${Object.keys(fixtures).length} fixtures in ${outDir}`);
    });
  } else {
    it('match fresh TypeScript output', () => {
      for (const [name, fresh] of Object.entries(fixtures)) {
        const file = path.join(outDir, name);
        expect(fs.existsSync(file)).toBe(true);
        const committed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        expect(committed).toEqual(fresh);
      }
    });
  }
});