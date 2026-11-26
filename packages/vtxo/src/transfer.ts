import { OmniaVtxo, TransferVtxoParams, TransferResult, VtxoTransfer, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoAmountError } from './errors.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import {
  verifyVtxoExitEntitlement,
  createVtxoExitEntitlement,
  type VtxoExitEntitlement,
  type VerifyExitEntitlementOptions,
} from './exit-entitlement.js';
import { buildExitTransaction, type ExitTxParams, type ExitTxDeps } from './exit-tx.js';

type TransferOutcome = TransferResult & { receipt: VtxoOperatorReceipt };

interface PreparedTransfer {
  input: OmniaVtxo;
  output: OmniaVtxo;
  change?: OmniaVtxo;
  transfer: VtxoTransfer;
  receipt: VtxoOperatorReceipt;
  isPartial: boolean;
}

/**
 * Build the input/output/change VTXOs and the operator receipt without
 * attaching any exit entitlement. Deterministic for a given `ts` (OMN-003).
 */
function prepareTransfer(
  vtxo: OmniaVtxo,
  params: TransferVtxoParams,
  ts: number,
): PreparedTransfer {
  if (vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot transfer VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  if (params.amount <= BigInt(0)) {
    throw new VtxoAmountError(`Transfer amount must be > 0, got ${params.amount}`);
  }
  if (params.amount > vtxo.amount) {
    throw new VtxoAmountError(
      `Transfer amount ${params.amount} exceeds VTXO amount ${vtxo.amount}`
    );
  }
  if (params.exitEntitlement && params.amount !== vtxo.amount) {
    throw new VtxoAmountError('exit entitlement requires a full-value transfer');
  }

  const isPartial = params.amount < vtxo.amount;
  const changeAmount = vtxo.amount - params.amount;

  const outputId = computeVtxoId({
    poolId: vtxo.poolId,
    owner: params.recipient,
    amount: params.amount,
    tokenId: vtxo.tokenId,
    nonce: params.nonce,
  });

  let changeVtxo: OmniaVtxo | undefined;
  let changeId: string | undefined;

  if (isPartial) {
    const changeNonce = params.changeNonce ?? params.nonce + ':change';
    changeId = computeVtxoId({
      poolId: vtxo.poolId,
      owner: vtxo.owner,
      amount: changeAmount,
      tokenId: vtxo.tokenId,
      nonce: changeNonce,
    });
  }

  const inputVtxo: OmniaVtxo = {
    ...vtxo,
    status: isPartial ? 'split' : 'transferred',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      {
        op: isPartial ? 'split' : 'transfer',
        at: ts,
        from: vtxo.owner,
        to: params.recipient,
        relatedIds: changeId ? [outputId, changeId] : [outputId],
      },
    ],
  };

  const outputVtxo: OmniaVtxo = {
    vtxoId: outputId,
    poolId: vtxo.poolId,
    owner: params.recipient,
    amount: params.amount,
    tokenId: vtxo.tokenId,
    status: 'active',
    epoch: vtxo.epoch,
    proof: {
      leaf: '',
      root: '',
      siblings: [],
      positions: [],
      epoch: vtxo.epoch,
      batchId: '',
    },
    history: [
      {
        op: 'transfer',
        at: ts,
        from: vtxo.owner,
        to: params.recipient,
        relatedIds: [vtxo.vtxoId],
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  };

  const outputIds = [outputId];

  if (isPartial && changeId) {
    changeVtxo = {
      vtxoId: changeId,
      poolId: vtxo.poolId,
      owner: vtxo.owner,
      amount: changeAmount,
      tokenId: vtxo.tokenId,
      status: 'active' as const,
      epoch: vtxo.epoch,
      proof: {
        leaf: '',
        root: '',
        siblings: [],
        positions: [],
        epoch: vtxo.epoch,
        batchId: '',
      },
      history: [
        {
          op: 'split' as const,
          at: ts,
          from: vtxo.owner,
          relatedIds: [vtxo.vtxoId],
          meta: { role: 'change' },
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    };
    outputIds.push(changeId);
  }

  const activeOutputs = changeVtxo ? [outputVtxo, changeVtxo] : [outputVtxo];
  const { proofs } = buildVtxoProofSet(activeOutputs);

  const patchedOutput: OmniaVtxo = { ...outputVtxo, proof: proofs[outputId] };
  const patchedChange = changeVtxo
    ? { ...changeVtxo, proof: proofs[changeId!] }
    : undefined;

  const transfer: VtxoTransfer = {
    inputId: vtxo.vtxoId,
    outputId,
    changeId,
    from: vtxo.owner,
    to: params.recipient,
    amount: params.amount,
    changeAmount: isPartial ? changeAmount : undefined,
    poolId: vtxo.poolId,
    tokenId: vtxo.tokenId,
    at: ts,
  };

  const receiptId = computeReceiptId(vtxo.poolId, 'transfer', [vtxo.vtxoId], outputIds, ts);

  return {
    input: inputVtxo,
    output: patchedOutput,
    change: patchedChange,
    transfer,
    isPartial,
    receipt: {
      receiptId,
      poolId: vtxo.poolId,
      op: 'transfer',
      inputIds: [vtxo.vtxoId],
      outputIds,
      epoch: vtxo.epoch,
      at: ts,
      signature: '',
    },
  };
}

/**
 * Transfers a VTXO (fully or partially) to a recipient.
 *
 * **Offline safety.** The returned output VTXOs are new claims. A Merkle proof
 * establishes membership in a committed set; it does NOT prove the input was
 * never spent elsewhere. The local host rejects a second transfer through its
 * shared state, but disconnected receivers do not share that state. Treat a
 * received VTXO as final only after an anti-double-spend check (online/operator
 * spend check, operator-co-signed transfer, or an explicitly risk-bounded
 * policy), and have the operator commit the new outputs — they do not
 * automatically belong to the previous pool root.
 *
 * **Exit entitlements (OMN-003).** An exit entitlement binds owner, vtxoId,
 * amount and holder index. The previous owner's entitlement therefore cannot
 * authorize the recipient, so this function never copies one forward: a
 * supplied `exitEntitlement` is verified against the *new output* and the
 * transfer is rejected unless it verifies. A transfer without an entitlement
 * returns `exitReady: false`. Use {@link transferVtxoWithEntitlement} to build a
 * recipient-bound exit.
 *
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
/**
 * OMN-025: an entitlement supplied by a peer must carry a witness the caller can
 * verify. Set `allowUnverifiedExit` only for entitlements this process built.
 */
export interface TransferVtxoOptions {
  verifyExitWitness?: VerifyExitEntitlementOptions['verifyWitness'];
  allowUnverifiedExit?: boolean;
}

export function transferVtxo(
  vtxo: OmniaVtxo,
  params: TransferVtxoParams,
  now?: number,
  options: TransferVtxoOptions = {},
): TransferOutcome {
  const ts = now !== undefined ? now : Date.now();
  const prepared = prepareTransfer(vtxo, params, ts);

  let exitEntitlement: VtxoExitEntitlement | undefined;
  if (params.exitEntitlement) {
    // Never trust an entitlement because it verified for the *input*: it must
    // verify for the recipient's output VTXO.
    const check = verifyVtxoExitEntitlement(params.exitEntitlement, prepared.output, {
      ...(options.verifyExitWitness ? { verifyWitness: options.verifyExitWitness } : {}),
      requireWitness: options.allowUnverifiedExit !== true,
    });
    if (!check.valid) {
      throw new VtxoAmountError(
        `invalid exit entitlement for recipient output: ${check.errors.join('; ')}`,
      );
    }
    exitEntitlement = params.exitEntitlement;
  }

  const output: OmniaVtxo = exitEntitlement
    ? { ...prepared.output, exitEntitlement }
    : prepared.output;

  return {
    input: prepared.input,
    output,
    change: prepared.change,
    transfer: prepared.transfer,
    receipt: prepared.receipt,
    exitReady: exitEntitlement !== undefined,
    exitEntitlement,
  };
}

/**
 * V1 transfer: build the *recipient's* independent exit before moving the
 * claim, then transfer only if the rebuilt entitlement verifies against the
 * output VTXO (OMN-003).
 *
 * `exitParams` describes the pool coin and holder share set for the input.
 * The helper rebinds it to the recipient: the holder at `holderIndex` becomes
 * the recipient, the exit VTXO becomes the output and the root/epoch become
 * the output's proof root/epoch. The exit transaction therefore pays the
 * recipient, not the previous owner.
 */
export async function transferVtxoWithExit(
  vtxo: OmniaVtxo,
  params: Omit<TransferVtxoParams, 'exitEntitlement'>,
  exitParams: ExitTxParams,
  exitDeps: ExitTxDeps,
  now?: number,
): Promise<TransferOutcome & { exitEntitlement: VtxoExitEntitlement }> {
  const ts = now !== undefined ? now : Date.now();

  if (exitParams.vtxo.vtxoId !== vtxo.vtxoId) {
    throw new VtxoAmountError('exit entitlement VTXO does not match transfer input');
  }
  if (params.amount !== vtxo.amount) {
    throw new VtxoAmountError('transferVtxoWithExit requires a full-value transfer');
  }

  const prepared = prepareTransfer(vtxo, params, ts);
  const share = exitParams.shares[exitParams.holderIndex];
  if (share === undefined) {
    throw new VtxoAmountError('exit holderIndex is out of range');
  }
  if (share !== prepared.output.amount) {
    throw new VtxoAmountError(
      `exit share ${share} does not equal the transferred amount ${prepared.output.amount}`,
    );
  }

  const recipientExitParams: ExitTxParams = {
    ...exitParams,
    vtxo: prepared.output,
    holders: exitParams.holders.map((holder, index) =>
      index === exitParams.holderIndex ? prepared.output.owner : holder,
    ),
    root: prepared.output.proof.root,
    epoch: prepared.output.epoch,
  };

  const exit = await buildExitTransaction(recipientExitParams, exitDeps);
  const entitlement = createVtxoExitEntitlement(recipientExitParams, exit);
  const check = verifyVtxoExitEntitlement(entitlement, prepared.output, { requireWitness: false });
  if (!check.valid) {
    throw new VtxoAmountError(
      `rebuilt exit entitlement does not verify for the recipient output: ${check.errors.join('; ')}`,
    );
  }

  // Locally rebuilt, so the witness check is not repeated against a peer claim.
  const transferred = transferVtxo(vtxo, { ...params, exitEntitlement: entitlement }, ts, {
    allowUnverifiedExit: true,
  });
  return { ...transferred, exitEntitlement: entitlement };
}

/** Alias for {@link transferVtxoWithExit}: derive a fresh entitlement for the recipient. */
export const transferVtxoWithEntitlement = transferVtxoWithExit;
