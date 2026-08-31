/**
 * admission/types.ts — Machine Work Admission core types.
 *
 * Machine Work Admission lets a receiver require a sender to perform bounded
 * computational work before scarce machine resources are allocated. The work
 * searches the nonce space of a real current Minima block candidate, so the
 * same hashes that admit the machine action also search for Minima L1 blocks.
 *
 * The three distinct concepts:
 *   - WorkChallenge  — the receiver-controlled admission requirement
 *   - MachineWorkAction — the domain-separated application action commitment
 *   - MachineWorkAdmissionProof — the mined result
 *
 * The TxPoW package knows only "there is an application action represented by
 * canonical bytes". It does NOT know about negotiation, compute, storage, or
 * any particular Edge resource. Domain-specific packages supply the action.
 */

/** Current Machine Work Admission protocol version. */
export const MACHINE_WORK_ADMISSION_VERSION = 1;

/** Canonical protocol domain prefix for the commitment hash. */
export const MACHINE_WORK_DOMAIN = 'totem.machine-work-admission';

/**
 * The receiver controls the admission requirement.
 *
 * A challenge must be unique enough to prevent useful pre-mining, must expire,
 * must bind to the intended receiver, and must bind to an application domain.
 * `target` is an absolute cryptographic target: verification is `hash < target`.
 */
export interface WorkChallenge {
  /** Protocol version. */
  version: number;
  /** Unique challenge identifier (receiver-generated, prevents pre-mining). */
  challengeId: string;
  /** The intended receiver this challenge is bound to. */
  recipient: string;
  /** Application domain (e.g. "totem.negotiation.proposal"). Open-ended. */
  domain: string;
  /** Absolute 32-byte cryptographic target (big-endian 256-bit). */
  target: string;
  /** Receiver-generated random nonce to prevent pre-mining. */
  nonce: string;
  /** Epoch milliseconds when the challenge was issued. */
  issuedAt: number;
  /** Epoch milliseconds after which the challenge is invalid. */
  expiresAt: number;
  /** Optional network identifier (e.g. "mainnet", "testnet"). */
  network?: string;
}

/**
 * The application action, represented in a generic domain-separated form.
 *
 * Only a commitment to this action enters the TxPoW header — never the
 * application payload itself. The application remains off-chain.
 */
export interface MachineWorkAction {
  /** Protocol version. */
  version: number;
  /** Application domain (e.g. "totem.compute.reserve"). Open-ended. */
  domain: string;
  /** The sender performing the work. */
  sender: string;
  /** The intended recipient. */
  recipient: string;
  /** Unique action identifier. */
  actionId: string;
  /** SHA3-256 hex commitment to the application payload (off-chain). */
  payloadHash: string;
  /** Optional domain-specific context (canonicalized into the commitment). */
  context?: Record<string, string>;
}

/**
 * A Minima block-candidate work template.
 *
 * This is the chain state a candidate is mined against. It is structurally
 * capable of becoming a legitimate Minima block: block number, block
 * difficulty, super-parents, MMR root/total, magic, and time are all taken
 * from the current chain tip (see TxPoWGenerator.generateTxPoW in Minima).
 */
export interface MinimaWorkTemplate {
  /** Chain ID (MAIN_NET = 0x00). */
  chainId: string;
  /** Block number = current tip + 1. */
  blockNumber: bigint;
  /** Current block difficulty target (32-byte hex). */
  blockDifficulty: string;
  /** Super-parent hashes at each cascade level (RLE-serialized). */
  superParents: string[];
  /** Current MMR root (32-byte hex). */
  mmrRoot: string;
  /** Current MMR total (sum of all coins). */
  mmrTotal: bigint;
  /** Serialized Magic struct (hex). */
  magic: string;
  /** Candidate timestamp in epoch milliseconds. */
  timeMilli: bigint;
  /** Template identifier (e.g. tip txpowId) for staleness checks. */
  templateId: string;
  /** Epoch milliseconds when the template was captured. */
  capturedAt: number;
}

/**
 * Provider abstraction for the current Minima block-candidate template.
 *
 * The TxPoW package remains transport/node-client agnostic: callers inject a
 * provider that fetches the current template from a Minima node, Axia, or a
 * test fixture. `broadcastBlockCandidate` is only invoked for genuine L1
 * winners.
 */
export interface MinimaWorkTemplateProvider {
  /** Fetch the current block-candidate template. */
  getCurrentTemplate(): Promise<MinimaWorkTemplate>;
  /** Optional: validate a template before mining against it. */
  validateTemplate?(template: MinimaWorkTemplate): Promise<boolean>;
  /** Optional: broadcast a genuine L1 block candidate. */
  broadcastBlockCandidate?(candidate: unknown): Promise<void>;
}

/**
 * The mined Machine Work Admission proof.
 *
 * Reuses the existing TxPoW types where possible: `txpow` is the serialized
 * TxPoW envelope (header | 0x01 | body) and `txpowId` is SHA3-256(header).
 */
export interface MachineWorkAdmissionProof {
  /** Protocol version. */
  version: number;
  /** Hex commitment placed in the TxPoW header's customHash field. */
  actionCommitment: string;
  /** The challenge this proof was mined against. */
  challengeId: string;
  /** The admission target (32-byte hex) the proof satisfies. */
  admissionTarget: string;
  /** Serialized TxPoW envelope (header | 0x01 | body). */
  txpow: string;
  /** SHA3-256(header) — the canonical TxPoW ID. */
  txpowId: string;
  /** The winning nonce. */
  nonce: string;
  /** Epoch milliseconds when the proof was mined. */
  minedAt: number;
  /** Always true for a valid admission proof. */
  qualifiesForAdmission: true;
  /** True when the same hash also beats the current Minima block target. */
  qualifiesAsMinimaBlock: boolean;
  /** Template the proof was mined against (for staleness policy). */
  template: MinimaWorkTemplate;
}

/** Result of verifying a Machine Work Admission proof. */
export interface WorkAdmissionVerification {
  valid: boolean;
  reason?: string;
  /** True when the proof also beats the block target AND the template is current. */
  broadcastable?: boolean;
}
