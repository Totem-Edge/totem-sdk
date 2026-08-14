import { sha3_256, writeMiniNumber } from '@totemsdk/core';
import type { OmniaChannel, ProgramTransition, SignedChannelState, StateValue } from '../types';
import {
  ASSET_HOLDER_A_BALANCE_PORT,
  ASSET_HOLDER_B_BALANCE_PORT,
  ASSET_PROGRAM_ID,
  ASSET_TOKEN_ID_PORT,
  ASSET_TOTAL_PORT,
  AssetProgram,
  COUNTER_PROGRAM_ID,
  COUNTER_STATE_PORT,
  CounterProgram,
  HTLC_CLAIMED_PORT,
  HTLC_HASHLOCK_PORT,
  HTLC_LOCKED_AMOUNT_PORT,
  HTLC_PROGRAM_ID,
  HTLC_TIMEOUT_BLOCK_PORT,
  HTLCPaymentProgram,
  MEMBERSHIP_DIVIDEND_POOL_PORT,
  MEMBERSHIP_MEMBER_ROOT_PORT,
  MEMBERSHIP_PAYOUT_SEQUENCE_PORT,
  MEMBERSHIP_PROGRAM_ID,
  MembershipProgram,
  METER_PAYMENT_PORT,
  METER_PROGRAM_ID,
  METER_READING_PORT,
  METER_UNIT_PRICE_PORT,
  METER_USAGE_DELTA_PORT,
  MeterProgram,
  TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT,
  TREASURY_OUTCOME_PROOF_ID_PORT,
  TREASURY_PROGRAM_ID,
  TREASURY_SPEND_CAP_PORT,
  TREASURY_SPENT_PORT,
  TREASURY_VOTE_TALLY_HASH_PORT,
  TreasuryProgram,
  VAULT_LOCKED_VALUE_PORT,
  VAULT_PROGRAM_ID,
  VAULT_RELEASE_SEQUENCE_PORT,
  VAULT_SWEPT_PORT,
  VaultProgram,
} from '../program';
import { serializeProgramTransition } from '../transition';
import { programBoolState, programHexState, programNumberState, programStringState } from '../state-vars';
import { serializeChannelSnapshot } from '../persistence';

const wasm = require('../../rust/pkg-node/omnia_wasm.js') as {
  build_counter_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_meter_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_htlc_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_vault_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_treasury_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_membership_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_asset_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  default_eltoo_payment_state_variables_wasm(): StateValue[];
  deserialize_channel_snapshot_wasm(json: string): { channel: Record<string, unknown> };
  program_number_state_wasm(port: number, value: string): StateValue;
  recover_channel_snapshot_wasm(snapshot: string): { channel: Record<string, unknown>; warnings: string[]; latestSignedState?: unknown };
  serialize_program_transition_wasm(transition: unknown): string;
  validate_counter_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_meter_transition_wasm(channel: unknown, previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_htlc_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_vault_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_treasury_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_membership_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_asset_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
};

const alice = { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0 };
const bob = { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 };

function normalizeStateVariables(values: StateValue[]): Array<Omit<StateValue, 'value'> & { value: string }> {
  return values.map(value => ({
    ...value,
    value: String(value.value),
  }));
}

function bytesToPlainHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function stateValueMiniNumberHex(value: StateValue): string {
  if (value.type !== 'number') throw new Error(`Expected number StateValue, got ${value.type}`);
  return bytesToPlainHex(writeMiniNumber(BigInt(String(value.value)), 0));
}

function toWasmValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  if (Array.isArray(value)) return value.map(toWasmValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, toWasmValue(nested)]));
  }
  return value;
}

function mapGet<T>(value: unknown, key: string): T | undefined {
  if (value instanceof Map) return value.get(key) as T | undefined;
  return (value as Record<string, T> | undefined)?.[key];
}

function makeState(stateVariables: StateValue[], balances: Record<string, bigint> = { alice: 600n, bob: 400n }): SignedChannelState {
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

describe('Omnia Rust/WASM parity', () => {
  it('serializes program transitions with the same canonical JSON as TypeScript', () => {
    const transition: ProgramTransition = {
      action: 'set',
      inputs: { enabled: true, value: '42' },
      witness: { source: 'sensor', proof: '0xabc' },
      metadata: { requestId: 'req-1' },
    };

    expect(wasm.serialize_program_transition_wasm(transition)).toBe(serializeProgramTransition(transition));
    expect(() => wasm.serialize_program_transition_wasm({ action: 'set', inputs: { value: 42 } })).toThrow(
      'Invalid ProgramTransition inputs.value: expected string, bigint, or boolean',
    );
  });

  it('builds default and counter state variables like TypeScript', () => {
    const previous = makeState([programNumberState(COUNTER_STATE_PORT, 10n)]);
    const transition: ProgramTransition = { action: 'increment', inputs: { by: '5' } };

    expect(wasm.default_eltoo_payment_state_variables_wasm()).toEqual([]);
    expect(normalizeStateVariables(wasm.build_counter_state_variables_wasm(toWasmValue(previous), transition))).toEqual(
      normalizeStateVariables(CounterProgram.buildStateVariables({
        channel: makeChannel({ programId: COUNTER_PROGRAM_ID }),
        sequence: 8,
        balances: previous.balances,
        pendingHTLCs: [],
        settlement: false,
        previousState: previous,
        transition,
      })),
    );

    const next = makeState([programNumberState(COUNTER_STATE_PORT, 15n)]);
    expect(wasm.validate_counter_transition_wasm(toWasmValue(previous), toWasmValue(next), transition)).toEqual({ valid: true });
  });

  it('keeps BigInt state values aligned with Minima Java MiniNumber bytes', () => {
    const javaMiniNumberVectors: Array<[bigint, string]> = [
      [0n, '000100'],
      [1n, '000101'],
      [127n, '00017f'],
      [128n, '00020080'],
      [255n, '000200ff'],
      [256n, '00020100'],
      [18446744073709551616n, '0009010000000000000000'],
    ];

    for (const [value, expectedHex] of javaMiniNumberVectors) {
      const tsState = programNumberState(COUNTER_STATE_PORT, value);
      const wasmState = wasm.program_number_state_wasm(COUNTER_STATE_PORT, value.toString()) as StateValue;
      expect(stateValueMiniNumberHex(tsState)).toBe(expectedHex);
      expect(stateValueMiniNumberHex(wasmState)).toBe(expectedHex);
    }
  });

  it('builds and validates meter state variables like TypeScript', () => {
    const previous = makeState([
      programNumberState(METER_READING_PORT, 100n),
      programNumberState(METER_UNIT_PRICE_PORT, 2n),
    ]);
    const transition: ProgramTransition = { action: 'record_reading', inputs: { reading: '110', unitPrice: '2' } };
    const channel = makeChannel({ programId: METER_PROGRAM_ID });

    expect(normalizeStateVariables(wasm.build_meter_state_variables_wasm(toWasmValue(previous), transition))).toEqual(
      normalizeStateVariables(MeterProgram.buildStateVariables({
        channel,
        sequence: 8,
        balances: { alice: 580n, bob: 420n },
        pendingHTLCs: [],
        settlement: false,
        previousState: previous,
        transition,
      })),
    );

    const next = makeState([
      programNumberState(METER_READING_PORT, 110n),
      programNumberState(METER_USAGE_DELTA_PORT, 10n),
      programNumberState(METER_UNIT_PRICE_PORT, 2n),
      programNumberState(METER_PAYMENT_PORT, 20n),
    ], { alice: 580n, bob: 420n });
    expect(wasm.validate_meter_transition_wasm(toWasmValue(channel), toWasmValue(previous), toWasmValue(next), transition)).toEqual({ valid: true });
  });

  it('builds and validates htlc state variables like TypeScript', () => {
    const previous = makeState([
      programHexState(HTLC_HASHLOCK_PORT, '0xabcdef'),
      programNumberState(HTLC_LOCKED_AMOUNT_PORT, 500n),
      programNumberState(HTLC_TIMEOUT_BLOCK_PORT, 100n),
      programBoolState(HTLC_CLAIMED_PORT, false),
    ]);
    const addTransition: ProgramTransition = { action: 'add', inputs: { hashlock: '0x0123', amount: '250', timeoutBlock: '200' } };
    const channel = makeChannel({ programId: HTLC_PROGRAM_ID });

    expect(normalizeStateVariables(wasm.build_htlc_state_variables_wasm(toWasmValue(previous), addTransition))).toEqual(
      normalizeStateVariables(HTLCPaymentProgram.buildStateVariables({
        channel,
        sequence: 8,
        balances: previous.balances,
        pendingHTLCs: [],
        settlement: false,
        previousState: previous,
        transition: addTransition,
      })),
    );

    const added = makeState([
      programHexState(HTLC_HASHLOCK_PORT, '0x0123'),
      programNumberState(HTLC_LOCKED_AMOUNT_PORT, 250n),
      programNumberState(HTLC_TIMEOUT_BLOCK_PORT, 200n),
      programBoolState(HTLC_CLAIMED_PORT, false),
    ]);
    expect(wasm.validate_htlc_transition_wasm(toWasmValue(previous), toWasmValue(added), addTransition)).toEqual({ valid: true });
  });

  it('builds htlc claim with the same sha3 preimage digest as TypeScript', () => {
    const preimage = 'secret-totem-preimage';
    const lockHex = bytesToPlainHex(sha3_256(new TextEncoder().encode(preimage)));
    const claimTransition: ProgramTransition = { action: 'claim', inputs: { preimage } };
    const channel = makeChannel({ programId: HTLC_PROGRAM_ID });
    const prev = makeState([
      programHexState(HTLC_HASHLOCK_PORT, lockHex),
      programNumberState(HTLC_LOCKED_AMOUNT_PORT, 500n),
      programNumberState(HTLC_TIMEOUT_BLOCK_PORT, 100n),
      programBoolState(HTLC_CLAIMED_PORT, false),
    ]);
    const expected = {
      hashlock: lockHex,
      amount: '0',
      claimed: 'true',
    };

    const tsVars = normalizeStateVariables(HTLCPaymentProgram.buildStateVariables({
      channel,
      sequence: 8,
      balances: prev.balances,
      pendingHTLCs: [],
      settlement: false,
      previousState: prev,
      transition: claimTransition,
    }));
    const wasmVars = normalizeStateVariables(wasm.build_htlc_state_variables_wasm(toWasmValue(prev), claimTransition));

    const hashlocks = [tsVars.find(v => v.port === HTLC_HASHLOCK_PORT)?.value, wasmVars.find(v => v.port === HTLC_HASHLOCK_PORT)?.value];
    const amounts = [tsVars.find(v => v.port === HTLC_LOCKED_AMOUNT_PORT)?.value, wasmVars.find(v => v.port === HTLC_LOCKED_AMOUNT_PORT)?.value];
    const claimed = [tsVars.find(v => v.port === HTLC_CLAIMED_PORT)?.value, wasmVars.find(v => v.port === HTLC_CLAIMED_PORT)?.value];

    expect(amounts).toEqual([expected.amount, expected.amount]);
    expect(claimed).toEqual([expected.claimed, expected.claimed]);
    expect(hashlocks).toEqual([expected.hashlock, expected.hashlock]);
    expect(lockHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds and validates vault state variables like TypeScript', () => {
    const lockTransition: ProgramTransition = { action: 'lock', inputs: { amount: '800', releaseSequence: '50' } };
    const channel = makeChannel({ programId: VAULT_PROGRAM_ID });

    expect(normalizeStateVariables(wasm.build_vault_state_variables_wasm(null, lockTransition))).toEqual(
      normalizeStateVariables(VaultProgram.buildStateVariables({
        channel,
        sequence: 8,
        balances: { alice: 600n, bob: 400n },
        pendingHTLCs: [],
        settlement: false,
        previousState: null,
        transition: lockTransition,
      })),
    );

    const next = makeState([
      programNumberState(VAULT_LOCKED_VALUE_PORT, 800n),
      programNumberState(VAULT_RELEASE_SEQUENCE_PORT, 50n),
      programBoolState(VAULT_SWEPT_PORT, false),
    ]);
    expect(wasm.validate_vault_transition_wasm(null, toWasmValue(next), lockTransition)).toEqual({ valid: true });
  });

  it('builds and validates treasury state variables like TypeScript', () => {
    const configureTransition: ProgramTransition = {
      action: 'configure',
      inputs: { membershipSnapshotHash: 'snap-1', voteTallyHash: 'tally-1', spendCap: '1000', outcomeProofId: 'proof-1' },
    };
    const channel = makeChannel({ programId: TREASURY_PROGRAM_ID });

    expect(normalizeStateVariables(wasm.build_treasury_state_variables_wasm(null, configureTransition))).toEqual(
      normalizeStateVariables(TreasuryProgram.buildStateVariables({
        channel,
        sequence: 8,
        balances: { alice: 600n, bob: 400n },
        pendingHTLCs: [],
        settlement: false,
        previousState: null,
        transition: configureTransition,
      })),
    );

    const next = makeState([
      programStringState(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, 'snap-1'),
      programStringState(TREASURY_VOTE_TALLY_HASH_PORT, 'tally-1'),
      programNumberState(TREASURY_SPEND_CAP_PORT, 1000n),
      programNumberState(TREASURY_SPENT_PORT, 0n),
      programStringState(TREASURY_OUTCOME_PROOF_ID_PORT, 'proof-1'),
    ]);
    expect(wasm.validate_treasury_transition_wasm(null, toWasmValue(next), configureTransition)).toEqual({ valid: true });
  });

  it('builds and validates membership state variables like TypeScript', () => {
    const addTransition: ProgramTransition = { action: 'member_add', inputs: { memberRoot: '0xABCD' } };
    const channel = makeChannel({ programId: MEMBERSHIP_PROGRAM_ID });

    expect(normalizeStateVariables(wasm.build_membership_state_variables_wasm(null, addTransition))).toEqual(
      normalizeStateVariables(MembershipProgram.buildStateVariables({
        channel,
        sequence: 8,
        balances: { alice: 600n, bob: 400n },
        pendingHTLCs: [],
        settlement: false,
        previousState: null,
        transition: addTransition,
      })),
    );

    const next = makeState([
      programHexState(MEMBERSHIP_MEMBER_ROOT_PORT, 'abcd'),
      programNumberState(MEMBERSHIP_DIVIDEND_POOL_PORT, 0n),
      programNumberState(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n),
    ]);
    expect(wasm.validate_membership_transition_wasm(null, toWasmValue(next), addTransition)).toEqual({ valid: true });
  });

  it('builds and validates asset state variables like TypeScript', () => {
    const configureTransition: ProgramTransition = {
      action: 'configure',
      inputs: { tokenId: '0xABCD', holderABalance: '300', holderBBalance: '200' },
    };
    const channel = makeChannel({ programId: ASSET_PROGRAM_ID });

    expect(normalizeStateVariables(wasm.build_asset_state_variables_wasm(null, configureTransition))).toEqual(
      normalizeStateVariables(AssetProgram.buildStateVariables({
        channel,
        sequence: 8,
        balances: { alice: 600n, bob: 400n },
        pendingHTLCs: [],
        settlement: false,
        previousState: null,
        transition: configureTransition,
      })),
    );

    const next = makeState([
      programHexState(ASSET_TOKEN_ID_PORT, 'abcd'),
      programNumberState(ASSET_HOLDER_A_BALANCE_PORT, 300n),
      programNumberState(ASSET_HOLDER_B_BALANCE_PORT, 200n),
      programNumberState(ASSET_TOTAL_PORT, 500n),
    ]);
    expect(wasm.validate_asset_transition_wasm(null, toWasmValue(next), configureTransition)).toEqual({ valid: true });
  });

  it('recovers TypeScript serialized channel snapshots', () => {
    const latestState = makeState([programNumberState(COUNTER_STATE_PORT, 42n)]);
    const snapshotJson = serializeChannelSnapshot(makeChannel({
      programId: COUNTER_PROGRAM_ID,
      latestState,
      pendingProposal: { sequence: 8, payloadHash: '0xpayload' },
    }));

    const snapshot = wasm.deserialize_channel_snapshot_wasm(snapshotJson);
    expect(snapshot.channel.totalValue).toBe('1000');
    expect(mapGet<string>(snapshot.channel.balances, 'alice')).toBe('600');
    expect(mapGet<string>((snapshot.channel.latestState as Record<string, unknown>).signatures, 'alice')).toBe('0102');

    const recovered = wasm.recover_channel_snapshot_wasm(snapshotJson);
    expect(recovered.channel.channelId).toBe('0xchannel');
    expect(recovered.warnings).toEqual([
      'latestState has no signed closePackage; unilateral close recovery is unavailable for this state',
    ]);
    expect(recovered.latestSignedState).toBeDefined();
  });
});
