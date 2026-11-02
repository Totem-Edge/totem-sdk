/**
 * @totemsdk/tx-builder/htlc
 *
 * HTLC funding/claim/refund parameter builders.
 *
 * The preimage is **transaction state** (`STATE(1)`), not the spent coin's
 * state. This mirrors the canonical Minima HTLC pattern and the real mainnet
 * apps (`txnstate port:1 value:<preimage>`).
 */

import {
  HTLCHelper,
  computeScriptAddress,
  createSignedByDescriptor,
  type ScriptDescriptor,
} from '@totemsdk/core/scripts';
import type { EnhancedBuildParams, EnhancedCoinInput, EnhancedCoinOutput } from './enhanced-types.js';

export interface HtlcParties {
  ownerPublicKey: string;
  recipientPublicKey: string;
  hashLock: string;
  timeoutBlock: bigint;
}

export interface HtlcCoinRef {
  coinId: string;
  address: string;
  amount: string;
  tokenId?: string;
}

function htlcDescriptor(
  address: string,
  parties: HtlcParties,
  preimage?: string,
): ScriptDescriptor {
  const descriptor = preimage
    ? HTLCHelper.buildClaimDescriptor(
        address,
        parties.ownerPublicKey,
        parties.recipientPublicKey,
        parties.hashLock,
        parties.timeoutBlock,
        preimage,
      )
    : HTLCHelper.buildRefundDescriptor(
        address,
        parties.ownerPublicKey,
        parties.recipientPublicKey,
        parties.hashLock,
        parties.timeoutBlock,
      );
  return descriptor;
}

/** Strip the preimage from the input descriptor; it belongs to transaction state. */
function asInputDescriptor(descriptor: ScriptDescriptor): ScriptDescriptor {
  const { stateVariables: _stateVariables, ...rest } = descriptor;
  return rest as ScriptDescriptor;
}

export interface BuildHtlcClaimParams {
  /** The funded HTLC coin being claimed. */
  funding: HtlcCoinRef;
  /** The fee/change coin owned by the claimer. */
  fee: HtlcCoinRef;
  /** Address that receives the claimed amount. */
  claimerAddress: string;
  /** Public key that signs the claim (recipient). */
  claimerPublicKey: string;
  /** Address that receives the fee change. */
  feeChangeAddress: string;
  parties: HtlcParties;
  /** The 32-byte preimage (hex). */
  preimage: string;
}

/**
 * Build the claim transaction parameters. The HTLC input descriptor contains
 * the claim script but no state variables; the preimage is transaction state
 * port 1 as raw hex.
 */
export function buildHtlcClaim(params: BuildHtlcClaimParams): EnhancedBuildParams {
  const descriptor = asInputDescriptor(
    htlcDescriptor(params.funding.address, params.parties, params.preimage),
  );
  const feeDescriptor = createSignedByDescriptor(
    params.feeChangeAddress,
    params.claimerPublicKey,
  );

  const inputs: EnhancedCoinInput[] = [
    {
      coinId: params.funding.coinId,
      address: params.funding.address,
      amount: params.funding.amount,
      tokenId: params.funding.tokenId,
      scriptDescriptor: descriptor,
    },
    {
      coinId: params.fee.coinId,
      address: params.fee.address,
      amount: params.fee.amount,
      tokenId: params.fee.tokenId,
      scriptDescriptor: feeDescriptor,
    },
  ];

  const outputs: EnhancedCoinOutput[] = [
    {
      address: params.claimerAddress,
      amount: params.funding.amount,
      tokenId: params.funding.tokenId,
    },
    {
      address: params.feeChangeAddress,
      amount: params.fee.amount,
      tokenId: params.fee.tokenId,
    },
  ];

  return {
    inputs,
    outputs,
    transactionState: [{ port: 1, value: params.preimage, type: 'hex' }],
  };
}

export interface BuildHtlcRefundParams {
  funding: HtlcCoinRef;
  fee: HtlcCoinRef;
  /** Address that receives the refund (owner). */
  refundAddress: string;
  /** Public key that signs the refund (owner). */
  refundPublicKey: string;
  /** Address that receives the fee change. */
  feeChangeAddress: string;
  parties: HtlcParties;
}

/**
 * Build the timeout refund parameters. The refund branch has no preimage/state
 * requirement, but the same input/fee shape is used.
 */
export function buildHtlcRefund(params: BuildHtlcRefundParams): EnhancedBuildParams {
  const descriptor = asInputDescriptor(
    htlcDescriptor(params.funding.address, params.parties),
  );
  const feeDescriptor = createSignedByDescriptor(
    params.feeChangeAddress,
    params.refundPublicKey,
  );

  return {
    inputs: [
      {
        coinId: params.funding.coinId,
        address: params.funding.address,
        amount: params.funding.amount,
        tokenId: params.funding.tokenId,
        scriptDescriptor: descriptor,
      },
      {
        coinId: params.fee.coinId,
        address: params.fee.address,
        amount: params.fee.amount,
        tokenId: params.fee.tokenId,
        scriptDescriptor: feeDescriptor,
      },
    ],
    outputs: [
      {
        address: params.refundAddress,
        amount: params.funding.amount,
        tokenId: params.funding.tokenId,
      },
      {
        address: params.feeChangeAddress,
        amount: params.fee.amount,
        tokenId: params.fee.tokenId,
      },
    ],
  };
}

/**
 * Build the HTLC funding output (the script address the maker/taker funds).
 * Funding is a normal output to the HTLC address; the script itself is carried
 * by the input descriptors when the coin is later claimed/refunded.
 */
export function buildHtlcFundingOutput(parties: HtlcParties, amount: string, tokenId?: string) {
  const htlc = HTLCHelper.createHTLC(
    parties.ownerPublicKey,
    parties.recipientPublicKey,
    parties.hashLock,
    parties.timeoutBlock,
  );
  // Published @totemsdk/core <=1.4.2 still returns a legacy address from
  // createHTLC(); always derive the address from the script with the canonical
  // single-leaf MMR commitment.
  const address = computeScriptAddress(htlc.script);
  return {
    address,
    script: htlc.script,
    output: { address, amount, tokenId } as EnhancedCoinOutput,
  };
}
