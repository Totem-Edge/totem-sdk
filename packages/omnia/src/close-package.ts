import { wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import type { SigningIndices } from '@totemsdk/wots-lease';
import type {
  ChannelSignature,
  OmniaChannel,
  SignedChannelState,
  SignedClosePackage,
} from './types.js';
import {
  buildSettlementTx,
  buildUpdateTx,
  computeOmniaTxDigest,
  serializeTxDraft,
  STATE_COMMITMENT_V2_PORT,
} from './transactions.js';
import { resolveChannelProgram } from './program.js';

function digestHex(digest: Uint8Array): string {
  return Buffer.from(digest).toString('hex');
}

function stateCommitmentV2Hex(state: SignedChannelState | Partial<SignedChannelState>): string {
  const sv = state.stateVariables?.find(v => v.port === STATE_COMMITMENT_V2_PORT);
  if (!sv) throw new Error('Cannot build close package: missing STATE(102) commitment');
  return String(sv.value).replace(/^0x/i, '').toLowerCase();
}

function defaultSettlementAddresses(channel: OmniaChannel): Record<string, string> {
  return Object.fromEntries(channel.parties.map(p => [p.partyId, p.publicKeyDigest]));
}

export function buildUnsignedClosePackage(
  channel: OmniaChannel,
  state: Pick<SignedChannelState, 'sequence' | 'balances' | 'pendingHTLCs' | 'stateVariables'>,
  partyAddresses: Record<string, string> = defaultSettlementAddresses(channel),
): SignedClosePackage {
  const program = resolveChannelProgram({ id: channel.programId, version: channel.programVersion });
  const programUpdateState = program.buildStateVariables({
    channel,
    sequence: state.sequence,
    balances: state.balances,
    pendingHTLCs: state.pendingHTLCs,
    settlement: false,
    previousState: channel.latestState,
  });
  const updateDraft = buildUpdateTx(channel, state.sequence, state.balances, state.pendingHTLCs, programUpdateState);
  const settlementState: SignedChannelState = {
    sequence: state.sequence,
    balances: state.balances,
    pendingHTLCs: state.pendingHTLCs,
    stateVariables: state.stateVariables,
    transactionHex: '',
    signatures: {},
    signingIndices: {},
  };
  const programSettlementState = program.buildStateVariables({
    channel,
    sequence: state.sequence,
    balances: state.balances,
    pendingHTLCs: state.pendingHTLCs,
    settlement: true,
    previousState: channel.latestState,
  });
  const settlementDraft = buildSettlementTx(channel, settlementState, partyAddresses, {
    floatingInput: true,
    programStateVariables: programSettlementState,
  });

  return {
    version: 1,
    channelId: channel.channelId,
    sequence: state.sequence,
    stateCommitmentV2: stateCommitmentV2Hex(state),
    update: {
      txHex: serializeTxDraft(updateDraft),
      txDigest: digestHex(computeOmniaTxDigest(updateDraft)),
      signatures: {},
      signingIndices: {},
    },
    settlement: {
      txHex: serializeTxDraft(settlementDraft),
      txDigest: digestHex(computeOmniaTxDigest(settlementDraft)),
      signatures: {},
      signingIndices: {},
    },
  };
}

export function addClosePackageSignature(
  closePackage: SignedClosePackage,
  partyId: string,
  updateSignature: ChannelSignature,
  updateIndices: SigningIndices,
  settlementSignature: ChannelSignature,
  settlementIndices: SigningIndices,
): SignedClosePackage {
  return {
    ...closePackage,
    update: {
      ...closePackage.update,
      signatures: { ...closePackage.update.signatures, [partyId]: updateSignature },
      signingIndices: { ...closePackage.update.signingIndices, [partyId]: updateIndices },
    },
    settlement: {
      ...closePackage.settlement,
      signatures: { ...closePackage.settlement.signatures, [partyId]: settlementSignature },
      signingIndices: { ...closePackage.settlement.signingIndices, [partyId]: settlementIndices },
    },
  };
}

export function mergeClosePackages(
  localPackage: SignedClosePackage,
  counterpartyPackage: SignedClosePackage,
): SignedClosePackage {
  if (localPackage.channelId !== counterpartyPackage.channelId || localPackage.sequence !== counterpartyPackage.sequence) {
    throw new Error('Cannot merge close packages for different channel/sequence');
  }
  if (
    localPackage.stateCommitmentV2 !== counterpartyPackage.stateCommitmentV2 ||
    localPackage.update.txDigest !== counterpartyPackage.update.txDigest ||
    localPackage.settlement.txDigest !== counterpartyPackage.settlement.txDigest ||
    localPackage.update.txHex !== counterpartyPackage.update.txHex ||
    localPackage.settlement.txHex !== counterpartyPackage.settlement.txHex
  ) {
    throw new Error('Cannot merge close packages with different artifacts');
  }

  return {
    ...localPackage,
    update: {
      ...localPackage.update,
      signatures: { ...localPackage.update.signatures, ...counterpartyPackage.update.signatures },
      signingIndices: { ...localPackage.update.signingIndices, ...counterpartyPackage.update.signingIndices },
    },
    settlement: {
      ...localPackage.settlement,
      signatures: { ...localPackage.settlement.signatures, ...counterpartyPackage.settlement.signatures },
      signingIndices: { ...localPackage.settlement.signingIndices, ...counterpartyPackage.settlement.signingIndices },
    },
  };
}

export function verifyClosePackage(
  channel: OmniaChannel,
  state: SignedChannelState,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const closePackage = state.closePackage;
  if (!closePackage) return { valid: false, errors: ['missing close package'] };
  if (closePackage.version !== 1) errors.push(`unsupported close package version ${closePackage.version}`);
  if (closePackage.channelId !== channel.channelId) errors.push('close package channelId mismatch');
  if (closePackage.sequence !== state.sequence) errors.push('close package sequence mismatch');
  if (closePackage.stateCommitmentV2 !== stateCommitmentV2Hex(state)) errors.push('close package stateCommitmentV2 mismatch');

  const expected = buildUnsignedClosePackage(channel, state);
  if (closePackage.update.txHex !== expected.update.txHex) errors.push('close package update tx mismatch');
  if (closePackage.update.txDigest !== expected.update.txDigest) errors.push('close package update digest mismatch');
  if (closePackage.settlement.txHex !== expected.settlement.txHex) errors.push('close package settlement tx mismatch');
  if (closePackage.settlement.txDigest !== expected.settlement.txDigest) errors.push('close package settlement digest mismatch');

  for (const party of channel.parties) {
    const updateSig = closePackage.update.signatures[party.partyId];
    const updateIndices = closePackage.update.signingIndices[party.partyId];
    const settlementSig = closePackage.settlement.signatures[party.partyId];
    const settlementIndices = closePackage.settlement.signingIndices[party.partyId];
    if (!updateSig || !updateIndices) errors.push(`missing update close artifact signature for ${party.partyId}`);
    if (!settlementSig || !settlementIndices) errors.push(`missing settlement close artifact signature for ${party.partyId}`);

    try {
      const pk = hexToBytes(party.publicKeyDigest);
      if (updateSig && !wotsVerifyDigest(updateSig, hexToBytes(closePackage.update.txDigest), pk)) {
        errors.push(`invalid update close artifact signature for ${party.partyId}`);
      }
      if (settlementSig && !wotsVerifyDigest(settlementSig, hexToBytes(closePackage.settlement.txDigest), pk)) {
        errors.push(`invalid settlement close artifact signature for ${party.partyId}`);
      }
    } catch {
      errors.push(`close artifact signature verification error for ${party.partyId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
