import { sha3_256 } from '@noble/hashes/sha3.js';
import type { AgentProposal } from './types.js';

const DOMAIN_PROPOSAL = 'TOTEM_AGENT_POLICY_PROPOSAL_V1';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',') + '}';
}

/**
 * Canonical digest of every policy-relevant field of a proposal.
 *
 * Operation IDs are idempotency keys. To stop a caller from reusing one
 * operation ID with different contents (amount, recipient, intent type,
 * token, risk, …), every stateful policy must bind the operation ID to this
 * digest. A retry that changes any policy-relevant field is a different
 * operation and must be rejected, never treated as an idempotent replay.
 *
 * The digest deliberately includes the authenticated principal (when the
 * trusted execution boundary supplied one) so an operation cannot be moved
 * between principals by relabelling the proposal.
 */
export function proposalPolicyDigest(proposal: AgentProposal): string {
  const canonical = {
    id: proposal.id,
    principal: proposal.principal ?? null,
    agentId: proposal.agentId,
    type: proposal.intent.type,
    amount: proposal.intent.amount ?? null,
    tokenId: proposal.intent.tokenId ?? null,
    recipient: proposal.intent.recipient ?? null,
    reason: proposal.intent.reason ?? null,
    risk: proposal.intent.risk ?? null,
  };
  return toHex(sha3_256(new TextEncoder().encode(DOMAIN_PROPOSAL + canonicalJson(canonical))));
}
