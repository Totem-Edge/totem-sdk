import { evaluateScript, KissvmLimitError, type ScriptWitness, type TxContext } from '@totemsdk/kissvm';
import type { OmniaChannel, OmniaTxDraft, SignedChannelState, StateValue } from './types.js';
import { buildSettlementTx, computeOmniaTxDigest, STATE_SEQUENCE_PORT, STATE_SETTLEMENT_PORT } from './transactions.js';
import { buildProgramUpdateTx } from './program.js';

function stateValuesToContext(values: StateValue[]): Record<number, string> {
  return Object.fromEntries(values.map(sv => [
    sv.port,
    typeof sv.value === 'bigint' ? sv.value.toString() : String(sv.value),
  ]));
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
  return stateValuesToContext([
    { port: STATE_SETTLEMENT_PORT, value: false, type: 'bool' },
    { port: STATE_SEQUENCE_PORT, value: BigInt(channel.currentSequence), type: 'number' },
  ]);
}

function txContextForDraft(
  channel: OmniaChannel,
  state: SignedChannelState,
  draft: OmniaTxDraft,
  opts?: KissvmValidationOptions,
): TxContext {
  const amount = Number(channel.totalValue);
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`KISSVM validation requires safe integer channel totalValue, got ${channel.totalValue}`);
  }
  return {
    block: opts?.block ?? 0,
    inputIndex: 0,
    inputs: draft.inputs.map(input => ({
      coinId: input.coinId,
      address: input.address,
      amount: Number(input.amount),
      tokenId: input.tokenId,
      coinCreatedBlock: opts?.previousCreatedBlock ?? 0,
    })),
    outputs: draft.outputs.map(output => ({
      address: output.address,
      amount: Number(output.amount),
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
      : buildProgramUpdateTx(channel, state.sequence, state.balances, state.pendingHTLCs);
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
