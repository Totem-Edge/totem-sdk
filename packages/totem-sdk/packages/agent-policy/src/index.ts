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
 *
 * ## Language-agnostic schema
 *
 * The canonical schema is defined in Protobuf at:
 *   proto/totem/agent/policy/v1/agent_policy.proto
 *
 * TypeScript types are generated from this schema. Python, Go, and Rust
 * consumers can generate their own bindings from the same .proto file.
 */

// Original TypeScript types (backward-compatible, string unions)
export type {
  PaymentIntent,
  AgentProposal,
  AgentPolicy,
  AgentReceipt,
  AgentIdentity,
} from './types.js';

// Proto-generated types (enums, serializable, language-agnostic)
export {
  IntentType,
  RiskLevel,
  ReceiptStatus,
} from './generated/agent_policy.js';

export type {
  PaymentIntent as ProtoPaymentIntent,
  AgentProposal as ProtoAgentProposal,
  AgentReceipt as ProtoAgentReceipt,
  AgentIdentity as ProtoAgentIdentity,
  AgentPolicyConfig,
} from './generated/agent_policy.js';
