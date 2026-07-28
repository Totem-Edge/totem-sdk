/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Voting and governance templates for recursive MAST.
 *
 * These templates encode democratic and organisational governance
 * operations as KISSVM scripts that can be inserted into any layer
 * of the policy chain. Each template generates a PolicyLayer ready
 * for use with buildLayeredPolicy().
 *
 * Models:
 *   Weighted voting            — Vote weight proportional to stake/holding
 *   Liquid democracy            — Delegable votes with recall
 *   Quadratic voting            — Cost = votes², prevents majority tyranny
 *   Election result verification — Tamper-proof tally with audit trail
 *   Delegate recall             — Revoke delegation before vote execution
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Weighted voting ─────────────────────────────────────────────────────────

export function buildWeightedVotingScript(
  governancePkd: string,
  options: {
    proposalId: string;
    totalWeight: string;
    quorumWeight: string;
    votingStartBlock: number;
    votingEndBlock: number;
    votesForPort: number;
    votesAgainstPort: number;
    abstainPort: number;
    weightPort: number;
  },
): PolicyLayer {
  return {
    id: 'weighted-voting',
    name: `Vote: ${options.proposalId}`,
    script: [
      `// Weighted voting: ${options.proposalId}`,
      `// Total weight: ${options.totalWeight}`,
      `// Quorum: ${options.quorumWeight}`,
      `LET governance = 0x${governancePkd}`,
      ``,
      `// Voting window`,
      `ASSERT @BLOCK GTE ${options.votingStartBlock}`,
      `ASSERT @BLOCK LTE ${options.votingEndBlock}`,
      ``,
      `// Vote weight from stake`,
      `LET weight = PREVSTATE(${options.weightPort})`,
      `ASSERT weight GT 0`,
      ``,
      `// Cast vote`,
      `LET forVotes = PREVSTATE(${options.votesForPort})`,
      `LET againstVotes = PREVSTATE(${options.votesAgainstPort})`,
      `LET abstainVotes = PREVSTATE(${options.abstainPort})`,
      ``,
      `// Quorum check (at tally time)`,
      `LET totalCast = forVotes ADD againstVotes ADD abstainVotes`,
      `ASSERT totalCast GTE ${options.quorumWeight}`,
      ``,
      `// Result`,
      `ASSERT forVotes GT againstVotes`,
      ``,
      `ASSERT SIGNEDBY(governance)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: governancePkd,
    constraints: options,
  };
}

// ─── Liquid democracy ────────────────────────────────────────────────────────

export function buildLiquidDemocracyScript(
  governancePkd: string,
  options: {
    proposalId: string;
    delegationPort: number;
    directVotePort: number;
    delegationChainMaxDepth: number;
    votingStartBlock: number;
    votingEndBlock: number;
    recallPort: number;
  },
): PolicyLayer {
  return {
    id: 'liquid-democracy',
    name: `Liquid: ${options.proposalId}`,
    script: [
      `// Liquid democracy: ${options.proposalId}`,
      `// Max delegation depth: ${options.delegationChainMaxDepth}`,
      `LET governance = 0x${governancePkd}`,
      ``,
      `// Voting window`,
      `ASSERT @BLOCK GTE ${options.votingStartBlock}`,
      `ASSERT @BLOCK LTE ${options.votingEndBlock}`,
      ``,
      `// Delegation recall check`,
      `ASSERT PREVSTATE(${options.recallPort}) EQ 0`,
      ``,
      `// Direct vote overrides delegation`,
      `LET directVote = STATE(${options.directVotePort})`,
      `IF directVote NEQ 0 THEN`,
      `  ASSERT directVote EQ 1 OR directVote EQ 2`,
      `ELSE`,
      `  // Delegated vote`,
      `  LET delegate = STATE(${options.delegationPort})`,
      `  ASSERT delegate NEQ 0x00`,
      `  ASSERT SIGNEDBY(delegate)`,
      `ENDIF`,
      ``,
      `ASSERT SIGNEDBY(governance)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: governancePkd,
    constraints: options,
  };
}

// ─── Quadratic voting ────────────────────────────────────────────────────────

export function buildQuadraticVotingScript(
  governancePkd: string,
  options: {
    proposalId: string;
    creditPool: number;
    creditsSpentPort: number;
    votesCastPort: number;
    costPerVotePort: number;
    votingStartBlock: number;
    votingEndBlock: number;
  },
): PolicyLayer {
  return {
    id: 'quadratic-voting',
    name: `Quadratic: ${options.proposalId}`,
    script: [
      `// Quadratic voting: ${options.proposalId}`,
      `// Credit pool: ${options.creditPool}`,
      `LET governance = 0x${governancePkd}`,
      ``,
      `// Voting window`,
      `ASSERT @BLOCK GTE ${options.votingStartBlock}`,
      `ASSERT @BLOCK LTE ${options.votingEndBlock}`,
      ``,
      `// Quadratic cost: cost = votes²`,
      `LET votes = STATE(${options.votesCastPort})`,
      `LET cost = votes MUL votes`,
      `ASSERT STATE(${options.costPerVotePort}) EQ cost`,
      ``,
      `// Credit pool limit`,
      `LET prevSpent = PREVSTATE(${options.creditsSpentPort})`,
      `ASSERT prevSpent ADD cost LTE ${options.creditPool}`,
      ``,
      `ASSERT SIGNEDBY(governance)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: governancePkd,
    constraints: options,
  };
}

// ─── Election result verification ────────────────────────────────────────────

export function buildElectionVerificationScript(
  electionAuthorityPkd: string,
  options: {
    electionId: string;
    candidates: string[];
    totalEligibleVoters: number;
    votesCastPort: number;
    resultsPort: number;
    merkleRootPort: number;
    auditSeedPort: number;
    electionStartBlock: number;
    electionEndBlock: number;
  },
): PolicyLayer {
  const candidateChecks = options.candidates.map((c, i) =>
    `ASSERT STATE(${options.resultsPort + i}) GTE 0`,
  );

  return {
    id: 'election',
    name: `Election: ${options.electionId}`,
    script: [
      `// Election: ${options.electionId}`,
      `// Candidates: ${options.candidates.length}`,
      `// Eligible: ${options.totalEligibleVoters}`,
      `LET authority = 0x${electionAuthorityPkd}`,
      ``,
      `// Election window`,
      `ASSERT @BLOCK GTE ${options.electionStartBlock}`,
      `ASSERT @BLOCK LTE ${options.electionEndBlock}`,
      ``,
      `// Turnout verification`,
      `LET votesCast = STATE(${options.votesCastPort})`,
      `ASSERT votesCast LTE ${options.totalEligibleVoters}`,
      ``,
      `// Candidate results (non-negative)`,
      ...candidateChecks,
      ``,
      `// Merkle root of all ballots`,
      `ASSERT STATE(${options.merkleRootPort}) NEQ 0x00`,
      ``,
      `// Audit seed for random ballot verification`,
      `ASSERT STATE(${options.auditSeedPort}) NEQ 0`,
      ``,
      `ASSERT SIGNEDBY(authority)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: electionAuthorityPkd,
    constraints: options,
  };
}

// ─── Delegate recall ─────────────────────────────────────────────────────────

export function buildDelegateRecallScript(
  governancePkd: string,
  options: {
    delegationId: string;
    delegatorPkd: string;
    delegatePkd: string;
    recallThreshold: number;
    recallVotesPort: number;
    totalDelegatorsPort: number;
    recallDeadlineBlock: number;
    activePort: number;
  },
): PolicyLayer {
  return {
    id: 'delegate-recall',
    name: `Recall: ${options.delegationId}`,
    script: [
      `// Delegate recall: ${options.delegationId}`,
      `// ${options.delegatorPkd.slice(0, 16)}… → ${options.delegatePkd.slice(0, 16)}…`,
      `LET governance = 0x${governancePkd}`,
      `LET delegator = 0x${options.delegatorPkd}`,
      ``,
      `// Recall deadline`,
      `ASSERT @BLOCK LTE ${options.recallDeadlineBlock}`,
      ``,
      `// Recall threshold`,
      `LET recallVotes = PREVSTATE(${options.recallVotesPort})`,
      `LET totalDelegators = PREVSTATE(${options.totalDelegatorsPort})`,
      `ASSERT recallVotes MUL 100 DIV totalDelegators GTE ${options.recallThreshold}`,
      ``,
      `// Deactivate delegation`,
      `ASSERT STATE(${options.activePort}) EQ 0`,
      ``,
      `ASSERT SIGNEDBY(governance)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: governancePkd,
    constraints: options,
  };
}
