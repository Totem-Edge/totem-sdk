import { unscaledToAmount } from '@totemsdk/core';
import { evaluateScript, KissvmLimitError, type ScriptWitness, type TxContext } from '@totemsdk/kissvm';
import type { OmniaChannel, OmniaTxDraft, SignedChannelState, StateValue } from './types.js';
import { buildSettlementTx, channelDomainId, computeOmniaTxDigest, deserializeTxDraft, STATE_DOMAIN_PORT, STATE_SEQUENCE_PORT, STATE_SETTLEMENT_PORT } from './transactions.js';
import { buildProgramUpdateTx } from './program.js';

function stateValuesToContext(values: StateValue[]): Record<number, string> {
  return Object.fromEntries(values.map(sv => {
    if (sv.type === 'number' && sv.scale !== undefined && sv.scale > 0) {
      const unscaled = typeof sv.value === 'bigint' ? sv.value : BigInt(String(sv.value));
      return [sv.port, unscaledToAmount(unscaled, sv.scale)];
    }
    return [sv.port, typeof sv.value === 'bigint' ? sv.value.toString() : String(sv.value)];
  }));
}

function signatureWitness(channel: OmniaChannel, state: SignedChannelState): ScriptWitness {
  return {
    signatures: new Map(channel.parties
      .map(p => [p.publicKeyDigest.replace(/^0x/i, '').toLowerCase(), state.signatures[p.partyId]] as const)
      .filter((entry): entry is readonly [string, Uint8Array] => entry[1] instanceof Uint8Array)),
  };
}

function previousUpdateState(channel: OmniaChannel): Record<number, string> {
  if (channel.latestState) return stateValuesToContext(channel.latestState.stateVariables);
  const domain = channelDomainId(channel);
  return stateValuesToContext([
    { port: STATE_SETTLEMENT_PORT, value: false, type: 'bool' },
    { port: STATE_SEQUENCE_PORT, value: BigInt(channel.currentSequence), type: 'number' },
    ...(domain === undefined ? [] : [{ port: STATE_DOMAIN_PORT, value: domain, type: 'hex' as const }]),
  ]);
}

function txContextForDraft(
  channel: OmniaChannel,
  state: SignedChannelState,
  draft: OmniaTxDraft,
  opts?: KissvmValidationOptions,
): TxContext {
  const transitionBlock = state.programTransition?.inputs?.currentBlock;
  const block = opts?.block ?? (transitionBlock !== undefined ? Number(transitionBlock) : 0);
  return {
    block,
    inputIndex: 0,
    inputs: draft.inputs.map(input => ({
      coinId: input.coinId,
      address: input.address,
      amount: String(input.amount),
      tokenId: input.tokenId,
      coinCreatedBlock: opts?.previousCreatedBlock ?? 0,
    })),
    outputs: draft.outputs.map(output => ({
      address: output.address,
      amount: String(output.amount),
      tokenId: output.tokenId,
      keepState: output.storeState,
    })),
    state: stateValuesToContext(draft.stateVariables),
    prevState: opts?.settlement ? stateValuesToContext(state.stateVariables) : previousUpdateState(channel),
    txDigest: computeOmniaTxDigest(draft),
  };
}

export interface KissvmValidationOptions {
  block?: number;
  previousCreatedBlock?: number;
  settlement?: boolean;
  partyAddresses?: Record<string, string>;
}

export function validateChannelStateWithKissvm(
  channel: OmniaChannel,
  state: SignedChannelState,
  opts?: KissvmValidationOptions,
): { valid: boolean; error?: string } {
  try {
    const draft = opts?.settlement
      ? buildSettlementTx(channel, state, opts.partyAddresses ?? Object.fromEntries(channel.parties.map(p => [p.partyId, p.publicKeyDigest])), { floatingInput: true })
      : state.transactionHex
        ? deserializeTxDraft(state.transactionHex)
        : buildProgramUpdateTx(channel, state.sequence, state.balances, state.pendingHTLCs, state.programTransition);
    const result = evaluateScript(
      channel.fundingScript,
      signatureWitness(channel, state),
      txContextForDraft(channel, state, draft, opts),
    );
    return result.passed ? { valid: true } : { valid: false, error: result.error ?? 'script returned false' };
  } catch (err) {
    if (err instanceof KissvmLimitError) return { valid: false, error: `kissvm limit: ${err.message}` };
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
