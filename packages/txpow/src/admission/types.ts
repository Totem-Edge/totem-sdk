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
 * test fixture.
 *
 * `MinimaWorkRelay` is the preferred long-term relay boundary. The legacy
 * `broadcastBlockCandidate` callback is retained as a compatibility/fallback
 * path only — new consumers should use `relay` via `MinimaWorkRelay` and not
 * build around the lossy `candidate: unknown` shape.
 */
export interface MinimaWorkTemplateProvider {
  /** Fetch the current block-candidate template. */
  getCurrentTemplate(): Promise<MinimaWorkTemplate>;
  /** Optional: fetch the latest template for freshness checks. Falls back to getCurrentTemplate. */
  getLatestTemplate?(): Promise<MinimaWorkTemplate>;
  /** Optional: validate a template before mining against it. */
  validateTemplate?(template: MinimaWorkTemplate): Promise<boolean>;
  /**
   * @deprecated Prefer `MinimaWorkRelay.submitBlock` (complete envelope).
   * Retained for compatibility; only invoked for genuine Minima blocks
   * (Super-0 … Super-31) when no relay is configured.
   */
  broadcastBlockCandidate?(candidate: MachineWorkAdmissionProof): Promise<void>;
}

/**
 * Relay boundary for a complete Minima TxPoW envelope.
 *
 * Keeps Minima networking outside core mining logic. A future
 * @totemsdk/minima-rpc or chain-provider adapter may implement this port.
 * Duplicate relay attempts must be safe/idempotent at the integration boundary.
 */
export interface MinimaWorkRelay {
  /** Submit a complete Minima TxPoW envelope for block relay. */
  submitBlock(envelope: Uint8Array): Promise<void>;
}

/**
 * The mined Machine Work Admission proof.
 *
 * Reuses the existing TxPoW types where possible:
 *   - `txpow`          — serialized TxHeader bytes (SHA3-256 of these is `txpowId`)
 *   - `txpowEnvelope`  — the COMPLETE Minima TxPoW wire format
 *                        (header | 0x01 hasBody | body), required for network
 *                        submission of a genuine Minima block
 *   - `txpowId`        — SHA3-256(header)
 *
 * `qualifiesAsMinimaBlock`, `isBlock`, and `superLevel` are DERIVED METADATA
 * recorded at mining time. They are never trusted by verification —
 * verification recomputes all of them from the re-derived txpowId and the
 * template's block difficulty.
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
  /** Serialized TxHeader bytes (SHA3-256 of these is the TxPoW ID). */
  txpow: string;
  /** Complete Minima TxPoW envelope (header | 0x01 | body) for block relay. */
  txpowEnvelope: string;
  /** SHA3-256(header) — the canonical TxPoW ID. */
  txpowId: string;
  /** The winning nonce. */
  nonce: string;
  /** Epoch milliseconds when the proof was mined. */
  minedAt: number;
  /** Always true for a valid admission proof. */
  qualifiesForAdmission: true;
  /**
   * DERIVED METADATA: true when the mined hash also beats the block difficulty
   * encoded by the candidate template (i.e. a genuine Minima block). Never
   * trusted by verification — it is recomputed from the re-derived txpowId.
   */
  qualifiesAsMinimaBlock: boolean;
  /**
   * DERIVED METADATA: Minima Super level (-1 = not a block, 0..31 = block
   * strength). Never trusted by verification.
   */
  superLevel: number;
  /** DERIVED METADATA: superLevel >= 0. Never trusted by verification. */
  isBlock: boolean;
  /** Template the proof was mined against (for staleness policy). */
  template: MinimaWorkTemplate;
}

/**
 * Result of verifying a Machine Work Admission proof.
 *
 * Three distinct claims, never to be confused:
 *   A. `valid` — the hash satisfies the challenge target (admission proof).
 *   B. `superLevel` / `isBlock` — the hash ALSO satisfies the block difficulty
 *      encoded by the candidate template, yielding an exact Minima Super level.
 *   C. `broadcastable` — the candidate still corresponds to sufficiently
 *      current live Minima state AND can be submitted through the relay.
 *
 * A stale candidate may remain `valid = true` (and `superLevel >= 0`) while
 * `broadcastable = false`.
 *
 * `superLevel === -1 ⇔ isBlock === false`, and
 * `superLevel >= 0 ⇔ isBlock === true`. Verification recomputes these — it
 * never trusts sender-supplied `isBlock`/`superLevel` metadata.
 */
export interface WorkAdmissionVerification {
  /** Level A: the hash satisfies the challenge target. */
  valid: boolean;
  reason?: string;
  /**
   * Level B: exact Minima Super level of the candidate hash.
   * -1 = not a Minima block; 0..31 = Super-0 … Super-31 block strength.
   */
  superLevel?: number;
  /** Level B: superLevel >= 0 (a genuine Minima block). */
  isBlock?: boolean;
  /**
   * Level C: isBlock AND the template is current AND a live template provider
   * was supplied. Undefined in offline mode (no provider) — offline
   * verification must NOT claim Minima block contribution.
   */
  broadcastable?: boolean;
}
