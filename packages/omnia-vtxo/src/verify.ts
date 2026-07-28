import { OmniaVtxo, VtxoProof, VtxoTransfer, VerifyVtxoResult } from './types.js';
import { computeVtxoLeaf, verifyMerkleProof, MerkleProofNode } from './commitment.js';

export function verifyVtxo(vtxo: OmniaVtxo): VerifyVtxoResult {
  const errors: string[] = [];

  if (!vtxo.vtxoId) errors.push('Missing vtxoId');
  if (!vtxo.poolId) errors.push('Missing poolId');
  if (!vtxo.owner) errors.push('Missing owner');
  if (vtxo.amount <= BigInt(0)) errors.push(`Amount must be > 0, got ${vtxo.amount}`);
  if (!vtxo.tokenId) errors.push('Missing tokenId');
  if (!vtxo.status) errors.push('Missing status');

  if (vtxo.proof && vtxo.proof.leaf && vtxo.proof.root) {
    const proofResult = verifyVtxoProof(vtxo, vtxo.proof);
    if (!proofResult.valid) {
      errors.push(...proofResult.errors.map(e => `Proof: ${e}`));
    }
  }

  return { valid: errors.length === 0, errors };
}

export function verifyVtxoProof(vtxo: OmniaVtxo, proof: VtxoProof): VerifyVtxoResult {
  const errors: string[] = [];

  const expectedLeaf = computeVtxoLeaf(vtxo);
  if (proof.leaf !== expectedLeaf) {
    errors.push(
      `Proof leaf mismatch: expected ${expectedLeaf}, got ${proof.leaf}`
    );
  }

  if (proof.siblings.length > 0) {
    const proofNodes: MerkleProofNode[] = proof.siblings.map((sibling, i) => ({
      sibling,
      position: proof.positions[i],
    }));

    const valid = verifyMerkleProof(proof.leaf, proofNodes, proof.root);
    if (!valid) {
      errors.push('Merkle proof verification failed');
    }
  } else {
    if (proof.leaf !== proof.root) {
      errors.push('Single-leaf proof: leaf must equal root');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function verifyVtxoTransfer(
  input: OmniaVtxo,
  output: OmniaVtxo,
  transfer: VtxoTransfer,
): VerifyVtxoResult {
  const errors: string[] = [];

  if (transfer.inputId !== input.vtxoId) {
    errors.push(`Transfer inputId ${transfer.inputId} does not match input VTXO ${input.vtxoId}`);
  }
  if (transfer.outputId !== output.vtxoId) {
    errors.push(`Transfer outputId ${transfer.outputId} does not match output VTXO ${output.vtxoId}`);
  }
  if (input.poolId !== output.poolId) {
    errors.push(`Pool mismatch: input ${input.poolId}, output ${output.poolId}`);
  }
  if (input.tokenId !== output.tokenId) {
    errors.push(`Token mismatch: input ${input.tokenId}, output ${output.tokenId}`);
  }
  if (transfer.amount > input.amount) {
    errors.push(`Transfer amount ${transfer.amount} exceeds input amount ${input.amount}`);
  }

  return { valid: errors.length === 0, errors };
}

export interface ConservationInput {
  inputs: OmniaVtxo[];
  outputs: OmniaVtxo[];
  /**
   * Conservation mode:
   * - `'lte'` (default) — outputs may be less than or equal to inputs (allows exit/fee/burn flows)
   * - `'strict'` — outputs must equal inputs exactly (required for transfer, split, merge)
   */
  mode?: 'lte' | 'strict';
}

/**
 * Verifies amount conservation across a set of inputs and outputs.
 *
 * Default mode (`'lte'`): `sum(outputs) <= sum(inputs)` — allows exits, fees, and burn flows.
 * Strict mode (`'strict'`): `sum(outputs) === sum(inputs)` — required for transfer, split, merge.
 *
 * Always requires: same `poolId` and `tokenId` across all inputs and outputs.
 */
export function verifyConservation(params: ConservationInput): VerifyVtxoResult {
  const errors: string[] = [];
  const { inputs, outputs, mode = 'lte' } = params;

  if (inputs.length === 0 || outputs.length === 0) {
    errors.push('Conservation check requires at least one input and one output');
    return { valid: false, errors };
  }

  const poolId = inputs[0].poolId;
  const tokenId = inputs[0].tokenId;

  for (const vtxo of inputs) {
    if (vtxo.poolId !== poolId) {
      errors.push(`Input pool mismatch: ${vtxo.poolId} vs ${poolId}`);
    }
    if (vtxo.tokenId !== tokenId) {
      errors.push(`Input token mismatch: ${vtxo.tokenId} vs ${tokenId}`);
    }
  }

  for (const vtxo of outputs) {
    if (vtxo.poolId !== poolId) {
      errors.push(`Output pool mismatch: ${vtxo.poolId} vs ${poolId}`);
    }
    if (vtxo.tokenId !== tokenId) {
      errors.push(`Output token mismatch: ${vtxo.tokenId} vs ${tokenId}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const inputSum = inputs.reduce((sum, v) => sum + v.amount, BigInt(0));
  const outputSum = outputs.reduce((sum, v) => sum + v.amount, BigInt(0));

  if (mode === 'strict') {
    if (outputSum !== inputSum) {
      errors.push(
        `Conservation violation (strict): input sum ${inputSum} !== output sum ${outputSum}`
      );
    }
  } else {
    if (outputSum > inputSum) {
      errors.push(
        `Conservation violation: output sum ${outputSum} exceeds input sum ${inputSum}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
