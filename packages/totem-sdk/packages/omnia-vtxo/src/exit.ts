import { OmniaVtxo, ExitDraft, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoExitError, VtxoProofError } from './errors.js';
import { MOCK_OPERATOR_SIGNATURE } from './constants.js';
import { computeReceiptId, computeVtxoLeaf } from './commitment.js';

/**
 * Transitions an active VTXO to 'exiting' status.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function markExiting(vtxo: OmniaVtxo, now?: number): OmniaVtxo {
  const ts = now !== undefined ? now : Date.now();
  if (vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot initiate exit for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  return {
    ...vtxo,
    status: 'exiting',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      { op: 'exit_initiated', at: ts },
    ],
  };
}

/**
 * Transitions an exiting VTXO to 'exited' status.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function markExited(vtxo: OmniaVtxo, now?: number): OmniaVtxo {
  const ts = now !== undefined ? now : Date.now();
  if (vtxo.status !== 'exiting') {
    throw new VtxoStatusError(
      `Cannot mark VTXO ${vtxo.vtxoId} as exited: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  return {
    ...vtxo,
    status: 'exited',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      { op: 'exit_complete', at: ts },
    ],
  };
}

/**
 * Validates the VTXO's proof leaf integrity before creating an exit draft.
 * Throws VtxoProofError if the proof leaf is present but does not match the VTXO fields.
 */
function assertProofLeafValid(vtxo: OmniaVtxo): void {
  if (!vtxo.proof.leaf) return;
  const expectedLeaf = computeVtxoLeaf(vtxo);
  if (vtxo.proof.leaf !== expectedLeaf) {
    throw new VtxoProofError(
      `Exit draft rejected: VTXO ${vtxo.vtxoId} proof leaf mismatch. ` +
      `Expected ${expectedLeaf}, got ${vtxo.proof.leaf}`
    );
  }
}

/**
 * Creates a mock exit draft for a VTXO. Validates the proof leaf before drafting.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function createExitDraft(
  vtxo: OmniaVtxo,
  now?: number,
): { draft: ExitDraft; receipt: VtxoOperatorReceipt } {
  const ts = now !== undefined ? now : Date.now();

  if (vtxo.status !== 'active' && vtxo.status !== 'exiting') {
    throw new VtxoExitError(
      `Cannot create exit draft for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`
    );
  }

  assertProofLeafValid(vtxo);

  const draft: ExitDraft = {
    vtxoId: vtxo.vtxoId,
    poolId: vtxo.poolId,
    owner: vtxo.owner,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    draftType: 'mock-exit',
    timelockSeconds: 86400,
    createdAt: ts,
  };

  const receiptId = computeReceiptId(vtxo.poolId, 'exit_initiated', [vtxo.vtxoId], [], ts);

  const receipt: VtxoOperatorReceipt = {
    receiptId,
    poolId: vtxo.poolId,
    op: 'exit_initiated',
    inputIds: [vtxo.vtxoId],
    outputIds: [],
    epoch: vtxo.epoch,
    at: ts,
    signature: MOCK_OPERATOR_SIGNATURE,
    draftType: 'mock-exit',
  };

  return { draft, receipt };
}
