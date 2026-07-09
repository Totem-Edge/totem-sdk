import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { PaymentIntent, AgentPolicy, AgentReceipt, AgentProposal } from '@totemsdk/agent-policy';
import type {
  OmniaChannel,
  ChannelSigner,
  IntentResult,
  UpdateDelta,
} from './types.js';
import { updateState } from './channel.js';

/**
 * Agent entry point for channel payment execution.
 *
 * Spec: `executeIntent(channel, intent, policy, leaseProvider)` — signer is optional
 * and falls back to `channel.localSigner`.
 *
 * Evaluates `policy.canAutoApprove(proposal)`. If approved, calls `updateState` and
 * returns an `AgentReceipt`. If approval is required, returns `{ status: 'pending_user' }`
 * without signing.
 *
 * `canAutoApprove` is the primary and only gate — no bypass path exists.
 */
export async function executeIntent(
  channel: OmniaChannel,
  intent: PaymentIntent,
  policy: AgentPolicy,
  leaseProvider: WotsLeaseProvider,
  signer?: ChannelSigner,
): Promise<IntentResult> {
  const effectiveSigner = signer ?? channel.localSigner;

  const proposal: AgentProposal = {
    id: `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    agentId: 'omnia-channel-agent',
    intent,
    explanation: intent.reason ?? `Channel ${intent.type} for ${intent.amount ?? 'unknown'} ${intent.tokenId ?? '0x00'}`,
    confidence: 0.9,
    createdAt: Date.now(),
  };

  // canAutoApprove is the primary gate. If it returns false for any reason
  // (policy rejection, spend-limit, user-approval required, etc.), block signing
  // and return pending_user. Never bypass this check.
  const canAuto = await policy.canAutoApprove(proposal);
  if (!canAuto) {
    const receipt: AgentReceipt = {
      proposalId: proposal.id,
      status: 'pending_user',
      settledAt: Date.now(),
    };
    return { status: 'pending_user', receipt };
  }

  if (intent.type !== 'channel_update' || !intent.amount || !intent.recipient) {
    const receipt: AgentReceipt = {
      proposalId: proposal.id,
      status: 'rejected',
      rejectionReason: 'Intent must be channel_update with amount and recipient',
      settledAt: Date.now(),
    };
    return { status: 'rejected', receipt };
  }

  // PaymentIntent.recipient is a Minima address (settlementAddress or publicKeyDigest).
  // Match against all known address fields; fall back to partyId for off-chain flows.
  const recipientParty = channel.parties.find(
    p =>
      p.settlementAddress === intent.recipient ||
      p.publicKeyDigest === intent.recipient ||
      p.partyId === intent.recipient,
  );
  if (!recipientParty) {
    const receipt: AgentReceipt = {
      proposalId: proposal.id,
      status: 'rejected',
      rejectionReason: `Recipient ${intent.recipient} is not a channel participant`,
      settledAt: Date.now(),
    };
    return { status: 'rejected', receipt };
  }

  if (!effectiveSigner) {
    const receipt: AgentReceipt = {
      proposalId: proposal.id,
      status: 'rejected',
      rejectionReason: 'No signer available: provide signer param or set channel.localSigner',
      settledAt: Date.now(),
    };
    return { status: 'rejected', receipt };
  }

  const senderParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!senderParty) {
    throw new Error('Signer is not a channel participant');
  }

  const transferAmount = BigInt(intent.amount);
  const senderBalance = channel.balances[senderParty.partyId] ?? 0n;
  const recipientBalance = channel.balances[recipientParty.partyId] ?? 0n;

  if (transferAmount > senderBalance) {
    const receipt: AgentReceipt = {
      proposalId: proposal.id,
      status: 'rejected',
      rejectionReason: `Insufficient balance: ${senderBalance} < ${transferAmount}`,
      settledAt: Date.now(),
    };
    return { status: 'rejected', receipt };
  }

  const newBalances: Record<string, bigint> = { ...channel.balances };
  newBalances[senderParty.partyId] = senderBalance - transferAmount;
  newBalances[recipientParty.partyId] = recipientBalance + transferAmount;

  const delta: UpdateDelta = { newBalances, memo: intent.reason };
  const { channel: updatedChannel, signedState, error } = await updateState(channel, delta, leaseProvider, effectiveSigner);

  // If updateState returned an error (e.g. CAPACITY_NEAR_EXHAUSTION), no signing
  // occurred — do NOT emit approved. Map to pending_user so the caller can act
  // (e.g. propose cooperative settlement before retrying).
  if (error) {
    const receipt: AgentReceipt = {
      proposalId: proposal.id,
      status: 'pending_user',
      rejectionReason: error,
      settledAt: Date.now(),
    };
    return { status: 'pending_user', receipt };
  }

  const receipt: AgentReceipt = {
    proposalId: proposal.id,
    status: 'approved',
    channelState: signedState.transactionHex,
    settledAt: Date.now(),
  };

  return { status: 'approved', receipt, channel: updatedChannel };
}
