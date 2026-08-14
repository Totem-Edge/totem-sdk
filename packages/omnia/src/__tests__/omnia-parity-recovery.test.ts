import * as fs from 'fs';
import * as path from 'path';
import { recoverChannel, recoverChannelSnapshot, deserializeChannelSnapshot } from '../persistence';
import { serializeProgramTransition } from '../transition';
import { CounterProgram, MeterProgram, COUNTER_PROGRAM_ID, COUNTER_STATE_PORT, METER_PROGRAM_ID } from '../program';
import { programNumberState } from '../state-vars';
import type { ProgramTransition, SignedChannelState, StateValue } from '../types';

const wasm = require('../../rust/pkg-node/omnia_wasm.js') as {
  build_counter_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  build_meter_state_variables_wasm(previousState: unknown, transition: unknown): StateValue[];
  recover_channel_snapshot_wasm(snapshot: string): { channel: Record<string, unknown>; warnings: string[]; latestSignedState?: unknown };
  recover_channel_wasm(json: string): Record<string, unknown>;
};

const fixtureDir = path.resolve(__dirname, 'fixtures', 'parity');

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf-8');
}

const alice = { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0 };
const bob = { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 };

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

function normalizeStateVariables(values: StateValue[]): Array<Omit<StateValue, 'value'> & { value: string }> {
  return values.map(value => ({ ...value, value: String(value.value) }));
}

function makeState(stateVariables: StateValue[]): SignedChannelState {
  return {
    sequence: 7,
    balances: { alice: 600n, bob: 400n },
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

describe('Omnia recovery parity (golden fixtures)', () => {
  it('matches TS and WASM recovery for the default channel snapshot', () => {
    const json = fixture('default-channel.snapshot.json');
    const ts = recoverChannelSnapshot(json);
    const wasmResult = wasm.recover_channel_snapshot_wasm(json);

    expect(wasmResult.channel.channelId).toBe(ts.channel.channelId);
    expect(wasmResult.warnings).toEqual(ts.warnings);
    expect(wasmResult.latestSignedState).toBeDefined();
    expect(ts.latestSignedState).toBeDefined();
  });

  it('preserves close package fields across TS and WASM recovery', () => {
    const json = fixture('recoverable-close.snapshot.json');
    const ts = recoverChannelSnapshot(json);
    const wasmResult = wasm.recover_channel_snapshot_wasm(json);

    const tsClose = ts.latestSignedState?.closePackage;
    const wasmState = wasmResult.latestSignedState as Record<string, unknown> | undefined;
    const wasmClose = wasmState?.closePackage as Record<string, unknown> | undefined;

    expect(wasmClose).toBeDefined();
    expect(tsClose).toBeDefined();
    expect(wasmClose?.version).toBe(tsClose!.version);
    expect(wasmClose?.channelId).toBe(tsClose!.channelId);
    expect(wasmClose?.sequence).toBe(tsClose!.sequence);
    expect(wasmClose?.stateCommitmentV2).toBe(tsClose!.stateCommitmentV2);

    const tsUpdate = tsClose!.update;
    const wasmUpdate = wasmClose?.update as Record<string, unknown>;
    expect(wasmUpdate.txHex).toBe(tsUpdate.txHex);
    expect(wasmUpdate.txDigest).toBe(tsUpdate.txDigest);
    expect(mapGet(wasmUpdate.signatures, 'alice')).toBe(Buffer.from(tsUpdate.signatures.alice).toString('hex'));
    expect(mapGet(wasmUpdate.signatures, 'bob')).toBe(Buffer.from(tsUpdate.signatures.bob).toString('hex'));

    const tsSettlement = tsClose!.settlement;
    const wasmSettlement = wasmClose?.settlement as Record<string, unknown>;
    expect(wasmSettlement.txHex).toBe(tsSettlement.txHex);
    expect(wasmSettlement.txDigest).toBe(tsSettlement.txDigest);
    expect(mapGet(wasmSettlement.signatures, 'alice')).toBe(Buffer.from(tsSettlement.signatures.alice).toString('hex'));
    expect(mapGet(wasmSettlement.signatures, 'bob')).toBe(Buffer.from(tsSettlement.signatures.bob).toString('hex'));
  });

  it('preserves unilateral close state across TS and WASM recovery', () => {
    const json = fixture('unilateral-close.snapshot.json');
    const ts = recoverChannelSnapshot(json);
    const wasmResult = wasm.recover_channel_snapshot_wasm(json);

    const tsUnilateral = ts.channel.unilateralClose;
    const wasmUnilateral = wasmResult.channel.unilateralClose as Record<string, unknown> | undefined;

    expect(wasmUnilateral).toBeDefined();
    expect(wasmUnilateral?.channelId).toBe(tsUnilateral?.channelId);
    expect(wasmUnilateral?.sequence).toBe(tsUnilateral?.sequence);
    expect(wasmUnilateral?.updateTxHex).toBe(tsUnilateral?.updateTxHex);
    expect(wasmUnilateral?.settlementTxHex).toBe(tsUnilateral?.settlementTxHex);
    expect(wasmUnilateral?.contestStartBlock).toBe(tsUnilateral?.contestStartBlock);
    expect(wasmUnilateral?.contestDeadlineBlock).toBe(tsUnilateral?.contestDeadlineBlock);
    expect(wasmUnilateral?.status).toBe(tsUnilateral?.status);
    expect(wasmUnilateral?.updateTxpowId).toBe(tsUnilateral?.updateTxpowId);
  });

  it('preserves the pending proposal double-sign guard across recovery', () => {
    const json = fixture('pending-proposal.snapshot.json');
    const ts = recoverChannel(json);
    const wasmChannel = wasm.recover_channel_wasm(json);

    expect(ts.pendingProposal).toEqual({ sequence: 8, payloadHash: '0xpayload' });
    expect(wasmChannel.pendingProposal).toEqual({ sequence: 8, payloadHash: '0xpayload' });
  });

  it('rejects invalid balance conservation in both TS and WASM', () => {
    const json = fixture('invalid-balance.snapshot.json');
    expect(() => recoverChannelSnapshot(json)).toThrow('balance conservation failed');
    expect(() => wasm.recover_channel_snapshot_wasm(json)).toThrow('balance conservation failed');
  });

  it('defaults legacy raw channel JSON the same way in TS and WASM', () => {
    const json = fixture('legacy-channel.json');
    const ts = recoverChannel(json);
    const wasmChannel = wasm.recover_channel_wasm(json);

    expect(wasmChannel.channelId).toBe('0xlegacy');
    expect(ts.programId).toBe('eltoo-payment');
    expect(ts.programVersion).toBe(1);
    expect(ts.tokenScale).toBe(0);
    expect(ts.currentSequence).toBe(0);
    expect(ts.pendingHTLCs).toEqual([]);
    expect(ts.stateLog).toEqual([]);

    expect(wasmChannel.programId).toBe('eltoo-payment');
    expect(wasmChannel.programVersion).toBe(1);
    expect(wasmChannel.tokenScale).toBe(0);
    expect(wasmChannel.currentSequence).toBe(0);
    expect(wasmChannel.pendingHTLCs).toEqual([]);
    expect(wasmChannel.stateLog).toEqual([]);
  });

  it('reproduces the counter increment fixture in TS, WASM, and goldens', () => {
    const transition = JSON.parse(fixture('counter-increment.transition.json')) as ProgramTransition;
    const canonical = JSON.parse(fixture('counter-increment.canonical.json')) as ProgramTransition;
    const expected = JSON.parse(fixture('counter-state.expected.json')) as StateValue[];

    expect(JSON.parse(serializeProgramTransition(transition))).toEqual(canonical);

    const previous = makeState([programNumberState(COUNTER_STATE_PORT, 10n)]);
    const tsState = CounterProgram.buildStateVariables({
      channel: { programId: COUNTER_PROGRAM_ID } as never,
      sequence: 8,
      balances: { alice: 600n, bob: 400n },
      pendingHTLCs: [],
      settlement: false,
      previousState: previous,
      transition,
    });
    const wasmState = wasm.build_counter_state_variables_wasm(toWasmValue(previous), transition);

    expect(normalizeStateVariables(tsState)).toEqual(expected);
    expect(normalizeStateVariables(wasmState)).toEqual(expected);
  });

  it('reproduces the meter reading fixture in TS, WASM, and goldens', () => {
    const transition = JSON.parse(fixture('meter-reading.transition.json')) as ProgramTransition;
    const expected = JSON.parse(fixture('meter-state.expected.json')) as StateValue[];

    const previous = makeState([
      programNumberState(130, 100n),
      programNumberState(132, 2n),
    ]);
    const tsState = MeterProgram.buildStateVariables({
      channel: { programId: METER_PROGRAM_ID } as never,
      sequence: 8,
      balances: { alice: 580n, bob: 420n },
      pendingHTLCs: [],
      settlement: false,
      previousState: previous,
      transition,
    });
    const wasmState = wasm.build_meter_state_variables_wasm(toWasmValue(previous), transition);

    expect(normalizeStateVariables(tsState)).toEqual(expected);
    expect(normalizeStateVariables(wasmState)).toEqual(expected);
  });

  it('round-trips a durable snapshot through deserializeChannelSnapshot in TS and WASM', () => {
    const json = fixture('recoverable-close.snapshot.json');
    const ts = deserializeChannelSnapshot(json);
    const wasmState = wasm.recover_channel_snapshot_wasm(json);

    expect(wasmState.channel.channelId).toBe(ts.channel.channelId);
    expect(wasmState.channel.totalValue).toBe(String(ts.channel.totalValue));
    expect(mapGet(wasmState.channel.balances as unknown, 'alice')).toBe(String(ts.channel.balances.alice));
  });
});
