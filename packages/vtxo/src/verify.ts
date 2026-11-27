import {
  OmniaVtxo,
  OmniaVtxoPool,
  VtxoProof,
  VtxoTransfer,
  VerifyVtxoResult,
} from './types.js';
import { computeVtxoLeaf, verifyMerkleProof, MerkleProofNode } from './commitment.js';
import { poolEpochRoot, poolPublishedRoots } from './pool.js';

export interface VerifyVtxoOptions {
  /**
   * The root published by the pool / epoch authority. Required on the
   * authoritative path: a proof is only accepted when it anchors here.
   */
  expectedRoot?: string;
  /**
   * Explicitly opt out of pool anchoring for non-pool or structural
   * inspection. A VTXO verified this way is NOT a verified claim; never use
   * this to authorize a transfer or an exit.
   */
  allowUnanchored?: boolean;
}

export function verifyVtxo(
  vtxo: OmniaVtxo,
  options: VerifyVtxoOptions = {},
): VerifyVtxoResult {
  const errors: string[] = [];

  if (!vtxo.vtxoId) errors.push('Missing vtxoId');
  if (!vtxo.poolId) errors.push('Missing poolId');
  if (!vtxo.owner) errors.push('Missing owner');
  if (vtxo.amount <= BigInt(0)) errors.push(`Amount must be > 0, got ${vtxo.amount}`);
  if (!vtxo.tokenId) errors.push('Missing tokenId');
  if (!vtxo.status) errors.push('Missing status');

  const hasProof = Boolean(vtxo.proof && vtxo.proof.leaf && vtxo.proof.root);
  if (!hasProof) {
    if (!options.allowUnanchored) {
      errors.push(
        'Missing membership proof: a pool VTXO must carry a proof and must be ' +
        'verified against a published root (expectedRoot or verifyVtxoMembership)',
      );
    }
  } else {
    const proofResult = verifyVtxoProof(vtxo, vtxo.proof);
    if (!proofResult.valid) {
      errors.push(...proofResult.errors.map(e => `Proof: ${e}`));
    }
    if (options.expectedRoot !== undefined) {
      if (vtxo.proof.root !== options.expectedRoot) {
        errors.push(
          `Proof root ${vtxo.proof.root} is not the anchored root ${options.expectedRoot}`,
        );
      }
    } else if (!options.allowUnanchored) {
      errors.push(
        'Missing anchored root: pass expectedRoot (or verifyVtxoMembership(vtxo, pool))',
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Anchor a VTXO proof to a pool: the proof must be present, its root must be
 * a root the pool published, and (when the pool records membership) the VTXO
 * must be a member with the matching leaf.
 *
 * Accepts historical epoch roots, so a VTXO minted in an earlier epoch remains
 * verifiable after later batches (OMN-002 + OMN-010).
 */
export function verifyVtxoMembership(
  vtxo: OmniaVtxo,
  pool: OmniaVtxoPool,
): VerifyVtxoResult {
  const errors: string[] = [];

  if (vtxo.poolId !== pool.poolId) {
    errors.push(`Pool mismatch: VTXO ${vtxo.poolId} vs pool ${pool.poolId}`);
  }
  if (!vtxo.proof || !vtxo.proof.leaf || !vtxo.proof.root) {
    errors.push('Missing membership proof');
    return { valid: false, errors };
  }

  const proofResult = verifyVtxoProof(vtxo, vtxo.proof);
  if (!proofResult.valid) {
    errors.push(...proofResult.errors.map(e => `Proof: ${e}`));
  }

  const published = poolPublishedRoots(pool);
  if (!published.includes(vtxo.proof.root)) {
    errors.push(`Proof root ${vtxo.proof.root} is not a published pool root`);
  } else {
    const epochRoot = poolEpochRoot(pool, vtxo.epoch);
    if (epochRoot) {
      if (epochRoot.root !== vtxo.proof.root) {
        errors.push(
          `Proof root ${vtxo.proof.root} is not the published root for epoch ${vtxo.epoch}`,
        );
      }
    } else if (vtxo.epoch === pool.epoch) {
      if (vtxo.proof.root !== pool.commitmentRoot) {
        errors.push(
          `Proof root ${vtxo.proof.root} is not the current pool root ${pool.commitmentRoot}`,
        );
      }
    } else {
      errors.push(`No published root for epoch ${vtxo.epoch}`);
    }
  }

  const members = pool.members ?? [];
  if (members.length > 0) {
    const member = members.find((entry) => entry.vtxoId === vtxo.vtxoId);
    if (!member) {
      errors.push(`VTXO ${vtxo.vtxoId} is not a member of the pool commitment`);
    } else {
      if (member.leaf !== computeVtxoLeaf(vtxo)) {
        errors.push('Pool membership leaf mismatch');
      }
      if (member.epoch !== vtxo.epoch) {
        errors.push(
          `Pool membership epoch ${member.epoch} does not match VTXO epoch ${vtxo.epoch}`,
        );
      }
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
  if (proof.epoch !== vtxo.epoch) {
    errors.push(`Proof epoch ${proof.epoch} does not match VTXO epoch ${vtxo.epoch}`);
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
  if (transfer.amount <= 0n) {
    errors.push(`Transfer amount must be positive, got ${transfer.amount}`);
  }
  if (transfer.amount > input.amount) {
    errors.push(`Transfer amount ${transfer.amount} exceeds input amount ${input.amount}`);
  }
  if (transfer.from !== input.owner) {
    errors.push(`Transfer from '${transfer.from}' does not match input owner '${input.owner}'`);
  }
  if (transfer.to !== output.owner) {
    errors.push(`Transfer to '${transfer.to}' does not match output owner '${output.owner}'`);
  }
  if (transfer.amount !== output.amount) {
    errors.push(`Transfer amount ${transfer.amount} does not match output amount ${output.amount}`);
  }
  if (transfer.poolId !== input.poolId || transfer.poolId !== output.poolId) {
    errors.push('Transfer poolId does not match the input/output pool');
  }
  if (transfer.tokenId !== input.tokenId || transfer.tokenId !== output.tokenId) {
    errors.push('Transfer tokenId does not match the input/output token');
  }
  if (transfer.changeAmount !== undefined && transfer.changeAmount < 0n) {
    errors.push(`Transfer changeAmount must be non-negative, got ${transfer.changeAmount}`);
  }
  if (transfer.amount !== input.amount) {
    if (transfer.changeAmount === undefined || transfer.changeId === undefined) {
      errors.push('Partial transfer requires a change output and changeAmount');
    } else if (transfer.amount + transfer.changeAmount !== input.amount) {
      errors.push('Transfer amount plus changeAmount does not equal the input amount');
    }
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

  // OMN-118: duplicate or negative records must fail centrally, before any
  // aggregate is compared — a doubled input inflates the sum and a negative
  // output lets a crafted set pass conservation.
  const seenInputs = new Set<string>();
  for (const vtxo of inputs) {
    if (!vtxo.vtxoId) errors.push('Input is missing vtxoId');
    else if (seenInputs.has(vtxo.vtxoId)) errors.push(`Duplicate input ${vtxo.vtxoId}`);
    else seenInputs.add(vtxo.vtxoId);
    if (vtxo.amount < BigInt(0)) errors.push(`Input ${vtxo.vtxoId} has a negative amount ${vtxo.amount}`);
  }
  const seenOutputs = new Set<string>();
  for (const vtxo of outputs) {
    if (!vtxo.vtxoId) errors.push('Output is missing vtxoId');
    else if (seenOutputs.has(vtxo.vtxoId)) errors.push(`Duplicate output ${vtxo.vtxoId}`);
    else seenOutputs.add(vtxo.vtxoId);
    if (vtxo.amount < BigInt(0)) errors.push(`Output ${vtxo.vtxoId} has a negative amount ${vtxo.amount}`);
  }
  // An id cannot appear on both sides of the transition.
  for (const id of seenOutputs) {
    if (seenInputs.has(id)) errors.push(`VTXO ${id} appears as both input and output`);
  }

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
