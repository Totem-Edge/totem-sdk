import { createProof } from '@totemsdk/proof'
import type { SignedProof, UnsignedProof } from '@totemsdk/proof'
import type { MandateBody } from '@totemsdk/authority'
import type { Proposal, ProposalOutcome, ProposalAction, VoteTally } from './types.js'
import { computeTallyProofHash } from './tally.js'

export function createOutcome(params: {
  proposal: Proposal
  tally: VoteTally
  determinedBy: string
  determinedAt?: number
}): ProposalOutcome {
  const tallyHash = computeTallyProofHash(params.tally)
  const now = params.determinedAt ?? Date.now()

  return {
    proposalId: params.proposal.id,
    status: params.tally.passed ? 'passed' : 'failed',
    tallyHash,
    passed: params.tally.passed,
    determinedAt: now,
    determinedBy: params.determinedBy,
  }
}

export function createOutcomeProofDraft(
  outcome: ProposalOutcome,
  issuer: string,
): UnsignedProof {
  return createProof({
    kind: 'custom',
    subject: { id: outcome.proposalId, kind: 'proposal-outcome' },
    issuer,
    issuedAt: outcome.determinedAt,
    payload: {
      schema: 'totem:governance:outcome/v1',
      outcome: {
        proposalId: outcome.proposalId,
        status: outcome.status,
        tallyHash: outcome.tallyHash,
        passed: outcome.passed,
      },
    },
  })
}

export function createGovernedMandate(
  outcome: ProposalOutcome,
  action: ProposalAction,
  actionIndex: number,
  governanceIdentity: string,
  executor: string,
  params: {
    membershipSnapshotHash: string
    voteTallyHash: string
    outcomeProofId: string
  },
): MandateBody {
  const constraints: MandateBody['constraints'] = [
    { field: 'proposalId', operator: 'eq', value: outcome.proposalId },
    { field: 'actionIndex', operator: 'eq', value: actionIndex },
    { field: 'actionType', operator: 'eq', value: action.type },
    { field: 'membershipSnapshotHash', operator: 'eq', value: params.membershipSnapshotHash },
    { field: 'voteTallyHash', operator: 'eq', value: params.voteTallyHash },
    { field: 'outcomeProofId', operator: 'eq', value: params.outcomeProofId },
  ]

  if (action.target) {
    constraints.push({ field: 'target', operator: 'eq', value: action.target })
  }

  const actionPayload = action.payload
  const payloadKeys = Object.keys(actionPayload).sort()
  for (const key of payloadKeys) {
    constraints.push({
      field: `payload.${key}`,
      operator: 'eq',
      value: actionPayload[key],
    })
  }

  return {
    grantor: governanceIdentity,
    grantee: executor,
    principal: outcome.proposalId,
    scope: `governance:${action.type}:execute`,
    constraints,
    usageLimit: { maxCount: 1 },
    issuedAt: outcome.determinedAt,
  }
}

export function finalizeProposalExecution(
  proposal: Proposal,
  outcomeProofSigned: SignedProof,
  txId: string,
): Proposal {
  return {
    ...proposal,
    status: 'executed',
    executedAt: Date.now(),
    executionTxId: txId,
  }
}
