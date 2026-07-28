import { sha3_256 } from '@totemsdk/core';
import {
  serializeTransaction,
  createDefaultTransaction,
  buildMinimaCoin,
  hexToBytes,
  type StateVariable as CoreStateVariable,
} from '@totemsdk/core';
import type { OmniaChannel } from '@totemsdk/omnia';
import { COINID_ELTOO } from '@totemsdk/omnia';
import type { SpliceParams, SpliceTxDraft, SpliceTxInput, SpliceTxOutput } from './types.js';
import { SpliceBalanceConservationError, SpliceInsufficientFundsError } from './errors.js';

const STATE_SETTLEMENT_PORT = 100;
const STATE_SEQUENCE_PORT = 101;

/**
 * Build a validated SpliceTxDraft from channel + splice params.
 *
 * For splice-in:
 *   inputs  = [channel coin (latestCoinId), additional coin]
 *   outputs = [new channel coin at fundingAddress, sequence=0, settlement=false]
 *
 * For splice-out:
 *   inputs  = [channel coin (latestCoinId)]
 *   outputs = [new channel coin at fundingAddress, sequence=0, settlement=false]
 *             [withdrawal coin at withdrawAddress]
 *             [any extra outputs]
 *
 * The output channel coin always resets STATE(101)=0 so the new channel starts
 * from sequence 0 with a full WOTS signing budget.
 *
 * @param channel - Quiesced or active channel to splice.
 * @param params  - Splice parameters (type, amounts, addresses).
 * @returns Validated SpliceTxDraft.
 * @throws {SpliceBalanceConservationError} If output amounts do not sum to newTotalValue.
 * @throws {SpliceInsufficientFundsError}   If splice-out exceeds channel holdings.
 */
export function buildSpliceTx(
  channel: OmniaChannel,
  params: SpliceParams,
): SpliceTxDraft {
  const tokenId = channel.tokenId ?? '0x00';

  if (params.type === 'splice_out') {
    const withdrawAmount = params.withdrawAmount ?? 0n;
    const extraSum = (params.extraOutputs ?? []).reduce((a, o) => a + o.amount, 0n);
    const totalOutflow = withdrawAmount + extraSum;
    if (totalOutflow > channel.totalValue) {
      throw new SpliceInsufficientFundsError(channel.totalValue, totalOutflow);
    }
    if (params.newTotalValue < 0n) {
      throw new SpliceInsufficientFundsError(channel.totalValue, totalOutflow);
    }
  }

  const balanceSum = Object.values(params.newBalances).reduce((a, b) => a + b, 0n);

  // `params.newTotalValue` is the amount that will remain locked in the new channel coin
  // after the splice.  `newBalances` must sum exactly to that value.
  // Withdrawals and extra outputs are separate outputs, already factored out by the
  // caller when computing `newTotalValue`.
  if (balanceSum !== params.newTotalValue) {
    throw new SpliceBalanceConservationError(params.newTotalValue, balanceSum);
  }

  const inputs: SpliceTxInput[] = [
    {
      coinId: COINID_ELTOO,
      address: channel.fundingAddress,
      amount: channel.totalValue,
      tokenId,
    },
  ];

  if (params.type === 'splice_in' && params.additionalCoinId && params.additionalAmount) {
    inputs.push({
      coinId: params.additionalCoinId,
      address: params.additionalCoinAddress ?? '',
      amount: params.additionalAmount,
      tokenId,
    });
  }

  const outputs: SpliceTxOutput[] = [
    {
      address: channel.fundingAddress,
      amount: balanceSum,
      tokenId,
      storeState: true,
      stateVarSettlement: false,
      stateVarSequence: 0,
    },
  ];

  if (params.type === 'splice_out' && params.withdrawAmount && params.withdrawAmount > 0n && params.withdrawAddress) {
    outputs.push({
      address: params.withdrawAddress,
      amount: params.withdrawAmount,
      tokenId,
      storeState: false,
      stateVarSettlement: false,
      stateVarSequence: 0,
    });
  }

  for (const extra of params.extraOutputs ?? []) {
    outputs.push({
      address: extra.address,
      amount: extra.amount,
      tokenId: extra.tokenId ?? tokenId,
      storeState: false,
      stateVarSettlement: false,
      stateVarSequence: 0,
    });
  }

  return {
    inputs,
    outputs,
    channelId: channel.channelId,
    params,
  };
}

/**
 * Convert a SpliceTxDraft to canonical Minima binary TX bytes.
 *
 * The resulting bytes cover inputs, outputs, and state variables and are
 * suitable for WOTS signing. Both parties sign the same bytes independently;
 * the final splice TX assembles both signatures into the witness.
 */
export function spliceDraftToMinimaBytes(draft: SpliceTxDraft): Uint8Array {
  const tx = createDefaultTransaction();

  for (const inp of draft.inputs) {
    tx.inputs.push(buildMinimaCoin({
      coinId: hexToBytes(inp.coinId),
      address: hexToBytes(inp.address),
      amount: inp.amount.toString(),
      tokenId: hexToBytes(inp.tokenId),
    }));
  }

  for (const out of draft.outputs) {
    const state: CoreStateVariable[] = out.storeState
      ? [
          { port: STATE_SETTLEMENT_PORT, value: out.stateVarSettlement, type: 'bool' },
          { port: STATE_SEQUENCE_PORT,   value: BigInt(out.stateVarSequence),  type: 'number' },
        ]
      : [];

    tx.outputs.push(buildMinimaCoin({
      address: hexToBytes(out.address),
      amount: out.amount.toString(),
      tokenId: hexToBytes(out.tokenId),
      storeState: out.storeState,
      state,
    }));
  }

  tx.state = [
    { port: STATE_SETTLEMENT_PORT, value: false, type: 'bool' },
    { port: STATE_SEQUENCE_PORT,   value: 0n,    type: 'number' },
  ];

  return serializeTransaction(JSON.stringify(tx));
}

/**
 * Compute a 32-byte digest over the splice TX draft for WOTS signing.
 * This is the canonical message both parties sign to authorize the splice.
 */
export function computeSpliceTxDigest(draft: SpliceTxDraft): Uint8Array {
  const canonical = JSON.stringify(
    {
      channelId: draft.channelId,
      inputs: draft.inputs.map(i => ({
        coinId: i.coinId,
        address: i.address,
        amount: i.amount.toString(),
        tokenId: i.tokenId,
      })),
      outputs: draft.outputs.map(o => ({
        address: o.address,
        amount: o.amount.toString(),
        tokenId: o.tokenId,
        storeState: o.storeState,
        stateVarSettlement: o.storeState ? o.stateVarSettlement : undefined,
        stateVarSequence: o.storeState ? o.stateVarSequence : undefined,
      })),
      params: {
        type: draft.params.type,
        newTotalValue: draft.params.newTotalValue.toString(),
        /**
         * newBalances is sorted by partyId for determinism and included in the
         * digest so that signatures cryptographically bind to the exact per-party
         * balance split. Different allocations with the same sum produce different
         * digests and therefore require new signatures.
         */
        newBalances: Object.entries(draft.params.newBalances)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, v.toString()]),
      },
    },
  );
  return sha3_256(new TextEncoder().encode(canonical));
}
