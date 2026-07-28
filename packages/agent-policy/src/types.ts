/**
 * @totemsdk/agent-policy — Interface contracts
 *
 * This package contains NO logic — only types and interface contracts.
 * It is the seam between the deterministic Phase 1.5 sovereignty stack
 * and the optional Phase 2 intelligence layer.
 *
 * Principle: the AI proposes, Totem validates and signs.
 * The AI never holds a private key. It never calls reserveKeyUse.
 * It never constructs a raw transaction. It fills in a PaymentIntent.
 */

/**
 * The action an agent wants the wallet to take.
 * Agents produce intents; they do not execute them.
 */
export interface PaymentIntent {
  /** Discriminator — what kind of operation this intent represents. */
  type: 'payment' | 'channel_update' | 'settlement' | 'lookup' | 'receipt';
  /** Amount in the token's native unit (string to preserve precision). */
  amount?: string;
  /** Minima tokenId, or '0x00' for native Minima. */
  tokenId?: string;
  /** Recipient Minima address (Mx… or hex). */
  recipient?: string;
  /** Human-readable reason for the payment (shown to user in approval UI). */
  reason?: string;
  /** Agent's self-assessed risk level — used by AgentPolicy routing. */
  risk?: 'low' | 'medium' | 'high';
  /** Arbitrary extra context the agent wants to attach (e.g. invoice ref). */
  metadata?: Record<string, unknown>;
}

/**
 * A concrete proposal from an agent, wrapping a PaymentIntent.
 * The wallet evaluates this against an AgentPolicy before signing anything.
 */
export interface AgentProposal {
  /** Unique proposal identifier (UUID or agent-generated opaque string). */
  id: string;
  /**
   * Opaque agent identifier — NOT a public key, NOT a root-identity reference.
   * Just a string the agent chooses (e.g. "qvac-payment-agent-v1").
   */
  agentId: string;
  /** The intent this proposal wants executed. */
  intent: PaymentIntent;
  /** Human-readable justification shown to the user in the approval UI. */
  explanation: string;
  /** Agent's confidence in the proposal (0 = uncertain, 1 = certain). */
  confidence: number;
  /** Unix timestamp (ms) when this proposal was created. */
  createdAt: number;
}

/**
 * Policy evaluated by the Totem wallet layer — NEVER by the agent.
 *
 * The wallet implements this interface to decide whether to auto-sign or
 * route to the user. The AI never has access to the policy implementation.
 */
export interface AgentPolicy {
  /**
   * Return true if the wallet should sign the intent without user interaction.
   * Implementations typically check risk, amount thresholds, and known agents.
   */
  canAutoApprove(proposal: AgentProposal): Promise<boolean>;
  /**
   * Return true if the wallet must show a user-approval UI before signing.
   * Generally the complement of canAutoApprove, but may have independent logic
   * (e.g. always require approval for settlements regardless of risk).
   */
  requiresUserApproval(proposal: AgentProposal): Promise<boolean>;
}

/**
 * Result returned to the agent after Totem has processed the intent.
 * The agent uses this to learn whether its proposal was executed.
 */
export interface AgentReceipt {
  /** Matches AgentProposal.id — ties the receipt back to the original proposal. */
  proposalId: string;
  /**
   * - 'approved'      — wallet signed and broadcast the transaction
   * - 'rejected'      — wallet or policy rejected the proposal
   * - 'pending_user'  — waiting for explicit user approval in the UI
   */
  status: 'approved' | 'rejected' | 'pending_user';
  /** TxPoW ID, set when a transaction was successfully mined and broadcast. */
  txpowId?: string;
  /** Serialised Omnia channel state, set when an off-chain channel was updated. */
  channelState?: string;
  /** Human-readable reason, set when status is 'rejected'. */
  rejectionReason?: string;
  /** Unix timestamp (ms) when the intent was settled (signed/rejected). */
  settledAt?: number;
}

/**
 * Minimal agent identity for lookup-node registration and capability
 * advertisement. Contains NO private keys — just an address and capability list.
 *
 * Signing the capability announcement is always the wallet's responsibility,
 * never the agent's.
 */
export interface AgentIdentity {
  /** Opaque string chosen by the agent (e.g. "my-invoice-agent-1"). */
  agentId: string;
  /**
   * Minima address where this agent accepts payments.
   * This is NOT a signing key — it is just an address for receiving funds.
   */
  address: string;
  /** Capability names this agent can service (e.g. ["invoice-parse", "fx-quote"]). */
  capabilities: string[];
}
