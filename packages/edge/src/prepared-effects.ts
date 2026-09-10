/**
 * edge/prepared-effects.ts — Derive canonical security facts from REAL built
 * transactions.
 *
 * The wallet builds the transaction FIRST (coin selection + outputs), then
 * `deriveEffects` reads the actual outputs. Agent-supplied `amount`/`recipient`
 * are only inputs to building — never security facts.
 *
 * Two built-tx shapes are supported:
 *   - `EnhancedBuildParams` (@totemsdk/tx-builder) — L1 payments.
 *   - `OmniaTxDraft` (@totemsdk/omnia) — channel updates/settlements.
 *
 * Change outputs (back to the sender's own address) and channel-internal
 * outputs (back to the channel script) are NOT spends — they are state
 * preservation, not value leaving the wallet.
 */

import type { StepEffects } from '@totemsdk/agent-policy';

export interface BuiltTxOutput {
  address: string;
  amount: string;
  tokenId?: string;
}

export interface BuiltTxInput {
  address: string;
  amount: string;
  tokenId?: string;
}

export interface BuiltTransaction {
  inputs: BuiltTxInput[];
  outputs: BuiltTxOutput[];
  /** Addresses the wallet controls — outputs to these are change, not spends. */
  ownAddresses: string[];
  /** Channel script address — outputs to it are channel-internal state. */
  channelScriptAddress?: string;
  /** Channel operations performed (channelId + operation). */
  channelOps?: Array<{ channelId: string; operation: string }>;
  /** Fees paid (tokenId + amount). */
  fees?: Array<{ tokenId: string; amount: string }>;
}

/**
 * Derive spends from a built transaction's outputs, excluding:
 *   - change back to the wallet's own addresses;
 *   - channel-internal outputs back to the channel script.
 */
export function deriveSpendsFromBuiltTx(tx: BuiltTransaction): Array<{ tokenId: string; amount: string; recipient: string }> {
  const own = new Set(tx.ownAddresses.map((a) => a.toLowerCase()));
  const channel = tx.channelScriptAddress?.toLowerCase();
  const spends: Array<{ tokenId: string; amount: string; recipient: string }> = [];
  for (const out of tx.outputs) {
    const addr = out.address.toLowerCase();
    if (own.has(addr)) continue; // change — value stays in the wallet
    if (channel && addr === channel) continue; // channel-internal state
    spends.push({
      tokenId: out.tokenId ?? '0x00',
      amount: out.amount,
      recipient: out.address,
    });
  }
  return spends;
}

/** Build a full StepEffects from a built transaction. */
export function deriveEffectsFromBuiltTx(tx: BuiltTransaction): StepEffects {
  return {
    spends: deriveSpendsFromBuiltTx(tx),
    fees: tx.fees ?? [],
    channels: tx.channelOps ?? [],
  };
}

/**
 * Normalize an `EnhancedBuildParams` (@totemsdk/tx-builder) into a
 * `BuiltTransaction`. Outputs carry the real recipient amounts; inputs carry
 * the wallet's own addresses (change detection).
 */
export function fromEnhancedBuildParams(
  params: {
    inputs: Array<{ address: string; amount: string; tokenId?: string }>;
    outputs: Array<{ address: string; amount: string; tokenId?: string }>;
  },
  ownAddresses: string[],
): BuiltTransaction {
  return {
    inputs: params.inputs.map((i) => ({ address: i.address, amount: i.amount, tokenId: i.tokenId })),
    outputs: params.outputs.map((o) => ({ address: o.address, amount: o.amount, tokenId: o.tokenId })),
    ownAddresses,
  };
}

/**
 * Normalize an `OmniaTxDraft` (@totemsdk/omnia) into a `BuiltTransaction`.
 * The channel's own script address is excluded from spends — a channel update
 * pays the full value back to the channel script (state change, not spend).
 */
export function fromOmniaTxDraft(
  draft: {
    inputs: Array<{ address: string; amount: bigint; tokenId: string }>;
    outputs: Array<{ address: string; amount: bigint; tokenId: string }>;
  },
  channelScriptAddress: string,
  channelOps?: Array<{ channelId: string; operation: string }>,
): BuiltTransaction {
  return {
    inputs: draft.inputs.map((i) => ({ address: i.address, amount: i.amount.toString(), tokenId: i.tokenId })),
    outputs: draft.outputs.map((o) => ({ address: o.address, amount: o.amount.toString(), tokenId: o.tokenId })),
    ownAddresses: [],
    channelScriptAddress,
    channelOps,
  };
}
