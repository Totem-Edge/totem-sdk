import type { OmniaChannel, SignedChannelState } from './types.js';
import { DefaultEltooPaymentProgram, resolveChannelProgram } from './program.js';

const SNAPSHOT_VERSION = 1;
const BIGINT_TAG = '__omniaBigInt';
const BYTES_TAG = '__omniaBytes';

export interface OmniaChannelSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAt: number;
  channel: OmniaChannel;
}

export interface ChannelRecoveryResult {
  channel: OmniaChannel;
  warnings: string[];
  latestSignedState?: SignedChannelState;
}

function isTaggedObject(value: unknown, tag: string): value is Record<string, string> {
  return !!value && typeof value === 'object' && tag in value && typeof (value as Record<string, unknown>)[tag] === 'string';
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return { [BIGINT_TAG]: value.toString() };
  if (value instanceof Uint8Array) return { [BYTES_TAG]: Buffer.from(value).toString('hex') };
  if (typeof value === 'function') return undefined;
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (isTaggedObject(value, BIGINT_TAG)) return BigInt(value[BIGINT_TAG]);
  if (isTaggedObject(value, BYTES_TAG)) return new Uint8Array(Buffer.from(value[BYTES_TAG], 'hex'));
  return value;
}

function legacyByteObject(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  const indexes = entries.map(([key]) => Number(key));
  if (indexes.some(index => !Number.isInteger(index) || index < 0)) return undefined;
  const max = Math.max(...indexes);
  if (max + 1 !== entries.length) return undefined;
  const bytes = new Uint8Array(entries.length);
  for (const [key, nested] of entries) {
    if (typeof nested !== 'number' || nested < 0 || nested > 255 || !Number.isInteger(nested)) return undefined;
    bytes[Number(key)] = nested;
  }
  return bytes;
}

function reviveSignatureMap(signatures?: Record<string, unknown>): Record<string, Uint8Array> | undefined {
  if (!signatures) return signatures as undefined;
  return Object.fromEntries(Object.entries(signatures).map(([partyId, signature]) => [
    partyId,
    legacyByteObject(signature) ?? signature,
  ])) as Record<string, Uint8Array>;
}

function reviveStateSignatures(state?: SignedChannelState | null): void {
  if (!state) return;
  state.signatures = reviveSignatureMap(state.signatures) ?? {};
  if (state.closePackage) {
    state.closePackage.update.signatures = reviveSignatureMap(state.closePackage.update.signatures) ?? {};
    state.closePackage.settlement.signatures = reviveSignatureMap(state.closePackage.settlement.signatures) ?? {};
  }
}

function normalizeRecoveredChannel(channel: OmniaChannel): OmniaChannel {
  const { localSigner: _localSigner, ...durableChannel } = channel;
  const normalized = {
    ...durableChannel,
    programId: durableChannel.programId ?? DefaultEltooPaymentProgram.id,
    programVersion: durableChannel.programVersion ?? DefaultEltooPaymentProgram.version,
    tokenScale: durableChannel.tokenScale ?? 0,
    pendingHTLCs: durableChannel.pendingHTLCs ?? [],
    stateLog: durableChannel.stateLog ?? [],
    currentSequence: durableChannel.currentSequence ?? durableChannel.latestState?.sequence ?? 0,
  } as OmniaChannel;
  reviveStateSignatures(normalized.latestState);
  return normalized;
}

function assertChannelShape(channel: OmniaChannel): void {
  if (!channel || typeof channel !== 'object') throw new Error('Invalid Omnia channel snapshot: missing channel');
  if (!channel.channelId) throw new Error('Invalid Omnia channel snapshot: missing channelId');
  if (!Array.isArray(channel.parties) || channel.parties.length < 2) {
    throw new Error('Invalid Omnia channel snapshot: expected at least two channel parties');
  }
  resolveChannelProgram({ id: channel.programId, version: channel.programVersion });
  if (channel.totalValue !== Object.values(channel.balances).reduce((sum, balance) => sum + balance, 0n) + channel.pendingHTLCs.filter(h => h.status === 'pending').reduce((sum, htlc) => sum + htlc.amount, 0n)) {
    throw new Error('Invalid Omnia channel snapshot: balance conservation failed');
  }
  if (channel.latestState && channel.latestState.sequence > channel.currentSequence) {
    throw new Error(`Invalid Omnia channel snapshot: latest state sequence ${channel.latestState.sequence} exceeds channel sequence ${channel.currentSequence}`);
  }
  if (channel.pendingProposal && channel.pendingProposal.sequence < channel.currentSequence) {
    throw new Error(`Invalid Omnia channel snapshot: pending proposal sequence ${channel.pendingProposal.sequence} is behind channel sequence ${channel.currentSequence}`);
  }
}

function recoveryWarnings(channel: OmniaChannel): string[] {
  const warnings: string[] = [];
  if (!channel.latestState && channel.currentSequence > 0) {
    warnings.push('channel has advanced sequence but no complete latestState; only pendingProposal can prevent retrying a conflicting in-flight update');
  }
  if (channel.latestState && !channel.latestState.closePackage) {
    warnings.push('latestState has no signed closePackage; unilateral close recovery is unavailable for this state');
  }
  if ((channel.status === 'closing_unilateral' || channel.status === 'disputing') && !channel.unilateralClose) {
    warnings.push(`channel status is ${channel.status} but unilateralClose state is missing`);
  }
  return warnings;
}

export function snapshotChannel(channel: OmniaChannel, savedAt = Date.now()): OmniaChannelSnapshot {
  const { localSigner: _localSigner, ...durableChannel } = channel;
  return {
    version: SNAPSHOT_VERSION,
    savedAt,
    channel: durableChannel as OmniaChannel,
  };
}

export function serializeChannelSnapshot(channelOrSnapshot: OmniaChannel | OmniaChannelSnapshot): string {
  const snapshot = 'version' in channelOrSnapshot && 'channel' in channelOrSnapshot
    ? channelOrSnapshot
    : snapshotChannel(channelOrSnapshot as OmniaChannel);
  return JSON.stringify(snapshot, replacer);
}

export function deserializeChannelSnapshot(json: string): OmniaChannelSnapshot {
  const parsed = JSON.parse(json, reviver) as OmniaChannelSnapshot | OmniaChannel;
  const snapshot: OmniaChannelSnapshot = 'version' in parsed && 'channel' in parsed
    ? parsed
    : { version: SNAPSHOT_VERSION, savedAt: Date.now(), channel: parsed as OmniaChannel };
  if (snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported Omnia channel snapshot version: ${String(snapshot.version)}`);
  }
  snapshot.channel = normalizeRecoveredChannel(snapshot.channel);
  assertChannelShape(snapshot.channel);
  return snapshot;
}

export function recoverChannelSnapshot(jsonOrSnapshot: string | OmniaChannelSnapshot): ChannelRecoveryResult {
  const snapshot = typeof jsonOrSnapshot === 'string'
    ? deserializeChannelSnapshot(jsonOrSnapshot)
    : jsonOrSnapshot;
  if (snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported Omnia channel snapshot version: ${String(snapshot.version)}`);
  }
  const channel = normalizeRecoveredChannel(snapshot.channel);
  assertChannelShape(channel);
  return {
    channel,
    warnings: recoveryWarnings(channel),
    latestSignedState: channel.latestState ?? undefined,
  };
}

export function recoverChannel(jsonOrSnapshot: string | OmniaChannelSnapshot): OmniaChannel {
  return recoverChannelSnapshot(jsonOrSnapshot).channel;
}
