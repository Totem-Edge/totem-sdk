import { writeMiniNumber } from '@totemsdk/core';
import type { OmniaChannel, ProgramTransition, SignedChannelState, StateValue } from '../types';
import {
  COUNTER_PROGRAM_ID,
  COUNTER_STATE_PORT,
  CounterProgram,
  METER_PAYMENT_PORT,
  METER_PROGRAM_ID,
  METER_READING_PORT,
  METER_UNIT_PRICE_PORT,
  METER_USAGE_DELTA_PORT,
  MeterProgram,
} from '../program';
import { serializeProgramTransition } from '../transition';
import { programNumberState } from '../state-vars';
import { serializeChannelSnapshot } from '../persistence';

const wasm = require('../../rust/pkg-node/omnia_wasm.js') as {
  build_counter_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_meter_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  default_eltoo_payment_state_variables_wasm(): StateValue[];
  deserialize_channel_snapshot_wasm(json: string): { channel: Record<string, unknown> };
  program_number_state_wasm(port: number, value: string): StateValue;
  recover_channel_snapshot_wasm(snapshot: string): { channel: Record<string, unknown>; warnings: string[]; latestSignedState?: unknown };
  serialize_program_transition_wasm(transition: unknown): string;
  validate_counter_transition_wasm(previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
  validate_meter_transition_wasm(channel: unknown, previousState: unknown, nextState: unknown, transition: unknown): { valid: boolean; reason?: string };
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
