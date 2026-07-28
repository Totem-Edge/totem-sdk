/**
 * Core types for nested MAST + PREVSTATE workflows.
 *
 * Nested MAST is proof-authenticated dynamic loading of bounded executable
 * modules. A MAST statement references a Merkle/MMR root; the transaction
 * witness supplies a script + proof resolving to that root. The loaded
 * script executes in the same contract context and may itself contain
 * another MAST statement referencing a different root.
 *
 * VM limits: 64 stack depth, 1,024 instructions shared across all frames.
 */

import type { MiniNumber } from '@totemsdk/core';

// ─── Policy tree ────────────────────────────────────────────────────────────

/** A single node in a policy tree. */
export interface PolicyNode {
  /** Unique identifier for this policy node. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** SHA3-256 hash of the KISSVM script this node authorizes. */
  scriptHash: string;
  /** The KISSVM script text. */
  script: string;
  /** Merkle root of all authorized scripts at this level. */
  policyRoot: string;
  /** Child policy nodes (delegated authority). */
  children: PolicyNode[];
  /** Parent policy node ID. */
  parentId?: string;
  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;
}

/** A complete policy tree with a single root. */
export interface PolicyTree {
  root: PolicyNode;
  /** Flat map of all nodes by ID for O(1) lookup. */
  nodeMap: Map<string, PolicyNode>;
  /** Total depth of the tree. */
  depth: number;
  /** Total number of nodes. */
  nodeCount: number;
}

// ─── Proof chain ────────────────────────────────────────────────────────────

/** A single link in a recursive MAST proof chain. */
export interface ProofLink {
  /** The script hash being proven at this level. */
  scriptHash: string;
  /** The policy root that authorizes this script. */
  policyRoot: string;
  /** Merkle inclusion proof (hex-encoded). */
  proof: string;
  /** The KISSVM script text at this level. */
  script: string;
  /** MMR leaf sum value (default MiniNumber(0)). */
  leafSum?: MiniNumber;
  /** MMR root sum value (default MiniNumber(0)). */
  rootSum?: MiniNumber;
  /** Human-readable label for this level. */
  label?: string;
  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;
}

/** A complete recursive MAST proof chain. */
export interface ProofChain {
  /** Ordered chain of proof links (root → leaf). */
  links: ProofLink[];
  /** Total depth of the chain. */
  depth: number;
  /** Whether the chain has been cryptographically verified. */
  verified: boolean;
  /** The final script hash at the leaf. */
  leafScriptHash: string;
}

// ─── State transition ───────────────────────────────────────────────────────

/** A PREVSTATE-based state transition definition. */
export interface StateTransition {
  /** Port number for STATE/PREVSTATE storage. */
  port: number;
  /** Human-readable name for this state variable. */
  name: string;
  /** Current state value. */
  currentValue: string;
  /** Previous state value (from PREVSTATE). */
  previousValue: string;
  /** Transition function description. */
  transition: string;
  /** Whether this transition is valid. */
  valid: boolean;
}

/** A complete PREVSTATE workflow. */
export interface PrevStateWorkflow {
  /** Workflow identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Ordered list of state transitions. */
  transitions: StateTransition[];
  /** The KISSVM script that enforces this workflow. */
  script: string;
  /** Script hash for MAST inclusion. */
  scriptHash: string;
}

// ─── Delegation chain ───────────────────────────────────────────────────────

/** A single delegation in an authority chain. */
export interface DelegationLink {
  /** The delegator's identity/public key digest. */
  delegator: string;
  /** The delegate's identity/public key digest. */
  delegate: string;
  /** The policy root authorizing this delegation. */
  policyRoot: string;
  /** Merkle proof that the delegation script is in the policy root. */
  proof: string;
  /** The KISSVM delegation script. */
  script: string;
  /** Constraints on the delegation (time, amount, scope). */
  constraints: DelegationConstraints;
  /** Sequence number in the chain. */
  sequence: number;
}

export interface DelegationConstraints {
  /** Maximum block height for validity. */
  maxBlock?: number;
  /** Maximum amount that can be delegated. */
  maxAmount?: string;
  /** Allowed action scopes. */
  scopes?: string[];
  /** Required co-signers. */
  coSigners?: string[];
}

/** A complete delegation chain. */
export interface DelegationChain {
  /** Ordered chain of delegation links. */
  links: DelegationLink[];
  /** The root authority. */
  rootAuthority: string;
  /** The final delegate. */
  currentDelegate: string;
  /** Whether the chain has been verified. */
  verified: boolean;
}

// ─── Cross-domain trust ─────────────────────────────────────────────────────

/** A cross-domain trust bridge between two policy spaces. */
export interface CrossDomainBridge {
  /** Source domain identifier. */
  sourceDomain: string;
  /** Target domain identifier. */
  targetDomain: string;
  /** The policy root in the source domain that accepts target proofs. */
  sourcePolicyRoot: string;
  /** The policy root in the target domain being accepted. */
  targetPolicyRoot: string;
  /** Merkle proof that the acceptance script is in the source policy root. */
  acceptanceProof: string;
  /** The KISSVM acceptance script. */
  acceptanceScript: string;
  /** Constraints on accepted proofs. */
  constraints: CrossDomainConstraints;
}

export interface CrossDomainConstraints {
  /** Maximum proof depth accepted. */
  maxDepth?: number;
  /** Required attributes in the target proof. */
  requiredAttributes?: string[];
  /** Expiry block for this bridge. */
  expiryBlock?: number;
}

// ─── Migration path ─────────────────────────────────────────────────────────

/** A single step in a policy migration path. */
export interface MigrationStep {
  /** The old policy root being migrated from. */
  fromPolicyRoot: string;
  /** The new policy root being migrated to. */
  toPolicyRoot: string;
  /** The KISSVM migration script. */
  migrationScript: string;
  /** Merkle proof that the migration script is in the old policy root. */
  proof: string;
  /** Block height at which this migration activates. */
  activationBlock: number;
  /** Block height at which the old policy is fully deprecated. */
  deprecationBlock: number;
}

/** A complete migration path. */
export interface MigrationPath {
  /** Ordered migration steps. */
  steps: MigrationStep[];
  /** The original policy root. */
  originalRoot: string;
  /** The current (latest) policy root. */
  currentRoot: string;
  /** Whether the migration is complete. */
  complete: boolean;
}

// ─── Verification result ────────────────────────────────────────────────────

export interface VerificationResult {
  valid: boolean;
  /** Which level failed verification (if any). */
  failedAt?: number;
  /** Human-readable reason for failure. */
  reason?: string;
  /** The verified proof chain (if valid). */
  chain?: ProofChain;
}
