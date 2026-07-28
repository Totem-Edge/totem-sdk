/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Treasury management templates for recursive MAST.
 *
 * These templates encode organisational treasury operations as KISSVM
 * scripts that can be inserted into any layer of the policy chain.
 * Each template generates a PolicyLayer ready for use with
 * buildLayeredPolicy().
 *
 * Models:
 *   Multi-sig treasury        — N-of-M spending with per-period limits
 *   Budget allocation          — Category envelopes with PREVSTATE tracking
 *   Time-locked reserves       — Gradual release schedule with cliff
 *   Proposal execution         — DAO-style propose → approve → execute
 *   Streaming payment          — Continuous payment stream with cancellation
 *   Treasury delegation        — Authority delegation with amount/scope caps
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Multi-sig treasury ──────────────────────────────────────────────────────

export function buildMultiSigTreasuryScript(
  custodians: string[],
  threshold: number,
  options: {
    treasuryId: string;
    maxSpendPerPeriod: string;
    periodBlocks: number;
    periodStartPort: number;
    spentThisPeriodPort: number;
  },
): PolicyLayer {
  const custodianList = custodians.map(c => `0x${c}`).join(' ');

  return {
    id: 'treasury',
    name: `Treasury: ${options.treasuryId}`,
    script: [
      `// Multi-sig treasury: ${options.treasuryId}`,
      `// ${threshold} of ${custodians.length} custodians`,
      `ASSERT MULTISIG(${threshold} ${custodianList})`,
      ``,
      `// Spending limit per period`,
      `LET periodStart = PREVSTATE(${options.periodStartPort})`,
      `LET spent = PREVSTATE(${options.spentThisPeriodPort})`,
      `LET elapsed = @BLOCK SUB periodStart`,
      ``,
      `// Reset period if elapsed`,
      `IF elapsed GTE ${options.periodBlocks} THEN`,
      `  LET spent = 0`,
      `ENDIF`,
      ``,
      `ASSERT spent ADD @AMOUNT LTE ${options.maxSpendPerPeriod}`,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: custodians[0],
    constraints: options,
  };
}

// ─── Budget allocation ───────────────────────────────────────────────────────

export function buildBudgetAllocationScript(
  financePkd: string,
  options: {
    budgetId: string;
    fiscalPeriodBlocks: number;
    categories: Array<{
      name: string;
      cap: string;
      spentPort: number;
    }>;
    periodStartPort: number;
  },
): PolicyLayer {
  const categoryChecks = options.categories.map(cat =>
    `ASSERT PREVSTATE(${cat.spentPort}) ADD @AMOUNT LTE ${cat.cap}`,
  );

  return {
    id: 'budget',
    name: `Budget: ${options.budgetId}`,
    script: [
      `// Budget allocation: ${options.budgetId}`,
      `LET finance = 0x${financePkd}`,
      `ASSERT SIGNEDBY(finance)`,
      ``,
      `// Fiscal period enforcement`,
      `LET periodStart = PREVSTATE(${options.periodStartPort})`,
      `LET elapsed = @BLOCK SUB periodStart`,
      `ASSERT elapsed LTE ${options.fiscalPeriodBlocks}`,
      ``,
      `// Category caps`,
      ...categoryChecks,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: financePkd,
    constraints: options,
  };
}

// ─── Time-locked reserves ────────────────────────────────────────────────────

export function buildTimeLockedReserveScript(
  governancePkd: string,
  options: {
    reserveId: string;
    totalReserve: string;
    cliffBlocks: number;
    vestingBlocks: number;
    beneficiaryPkd: string;
    reservePort: number;
    claimedPort: number;
  },
): PolicyLayer {
  return {
    id: 'reserve',
    name: `Reserve: ${options.reserveId}`,
    script: [
      `// Time-locked reserve: ${options.reserveId}`,
      `LET governance = 0x${governancePkd}`,
      `LET beneficiary = 0x${options.beneficiaryPkd}`,
      ``,
      `// Cliff: no withdrawals before cliffBlocks`,
      `LET reserveStart = PREVSTATE(${options.reservePort})`,
      `ASSERT @BLOCK GTE reserveStart ADD ${options.cliffBlocks}`,
      ``,
      `// Vesting: linear release over vestingBlocks`,
      `LET elapsed = @BLOCK SUB reserveStart`,
      `LET vested = ${options.totalReserve} MUL elapsed DIV ${options.vestingBlocks}`,
      `LET prevClaimed = PREVSTATE(${options.claimedPort})`,
      `LET claimable = vested SUB prevClaimed`,
      ``,
      `ASSERT claimable GT 0`,
      `ASSERT @AMOUNT LTE claimable`,
      `ASSERT SIGNEDBY(governance)`,
      `ASSERT VERIFYOUT(@INPUT beneficiary @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: governancePkd,
    constraints: options,
  };
}

// ─── Proposal execution ──────────────────────────────────────────────────────

export function buildProposalExecutionScript(
  governancePkd: string,
  options: {
    proposalId: string;
    quorum: number;
    votingPeriodBlocks: number;
    executionDelayBlocks: number;
    proposalStartPort: number;
    votesForPort: number;
    votesAgainstPort: number;
    totalVoters: number;
  },
): PolicyLayer {
  return {
    id: 'proposal',
    name: `Proposal: ${options.proposalId}`,
    script: [
      `// Proposal execution: ${options.proposalId}`,
      `LET governance = 0x${governancePkd}`,
      ``,
      `// Voting period must have elapsed`,
      `LET proposalStart = PREVSTATE(${options.proposalStartPort})`,
      `ASSERT @BLOCK SUB proposalStart GTE ${options.votingPeriodBlocks}`,
      ``,
      `// Quorum check`,
      `LET votesFor = PREVSTATE(${options.votesForPort})`,
      `LET votesAgainst = PREVSTATE(${options.votesAgainstPort})`,
      `LET totalVotes = votesFor ADD votesAgainst`,
      `ASSERT totalVotes GTE ${options.quorum}`,
      ``,
      `// Majority`,
      `ASSERT votesFor GT votesAgainst`,
      ``,
      `// Execution delay`,
      `ASSERT @BLOCK SUB proposalStart GTE ${options.votingPeriodBlocks} ADD ${options.executionDelayBlocks}`,
      ``,
      `ASSERT SIGNEDBY(governance)`,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: governancePkd,
    constraints: options,
  };
}

// ─── Streaming payment ───────────────────────────────────────────────────────

export function buildStreamingPaymentScript(
  payerPkd: string,
  options: {
    streamId: string;
    payeePkd: string;
    ratePerBlock: string;
    startBlock: number;
    maxDurationBlocks?: number;
    cancellationPort: number;
    totalStreamedPort: number;
  },
): PolicyLayer {
  const lines = [
    `// Streaming payment: ${options.streamId}`,
    `LET payer = 0x${payerPkd}`,
    `LET payee = 0x${options.payeePkd}`,
    ``,
    `// Stream must have started`,
    `ASSERT @BLOCK GTE ${options.startBlock}`,
    ``,
    `// Not cancelled`,
    `ASSERT PREVSTATE(${options.cancellationPort}) EQ 0`,
    ``,
    `// Calculate streamed amount`,
    `LET elapsed = @BLOCK SUB ${options.startBlock}`,
  ];

  if (options.maxDurationBlocks !== undefined) {
    lines.push(`ASSERT elapsed LTE ${options.maxDurationBlocks}`);
  }

  lines.push(
    `LET streamed = elapsed MUL ${options.ratePerBlock}`,
    `LET prevClaimed = PREVSTATE(${options.totalStreamedPort})`,
    `LET claimable = streamed SUB prevClaimed`,
    ``,
    `ASSERT claimable GT 0`,
    `ASSERT @AMOUNT LTE claimable`,
    `ASSERT SIGNEDBY(payer)`,
    `ASSERT VERIFYOUT(@INPUT payee @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  );

  return {
    id: 'streaming',
    name: `Stream: ${options.streamId}`,
    script: lines.join('\n'),
    authorityPkd: payerPkd,
    constraints: options,
  };
}

// ─── Treasury delegation chain ───────────────────────────────────────────────

export function buildTreasuryDelegationChain(
  rootAuthorityPkd: string,
  options: {
    delegationId: string;
    delegates: Array<{
      pkd: string;
      role: string;
      maxAmount: string;
      scopes: string[];
      expiryBlock: number;
    }>;
  },
): PolicyLayer {
  const delegateChecks = options.delegates.map((d, i) => {
    const scopeList = d.scopes.map(s => s).join(' ');
    return [
      `// Delegate ${i}: ${d.role}`,
      `IF STATE(${50 + i}) EQ 0x${d.pkd} THEN`,
      `  ASSERT SIGNEDBY(0x${d.pkd})`,
      `  ASSERT @AMOUNT LTE ${d.maxAmount}`,
      `  ASSERT CONTAINS([${scopeList}] STATE(0))`,
      `  ASSERT @BLOCK LTE ${d.expiryBlock}`,
      `ENDIF`,
    ].join('\n');
  });

  return {
    id: 'treasury-delegation',
    name: `Delegation: ${options.delegationId}`,
    script: [
      `// Treasury delegation: ${options.delegationId}`,
      `LET root = 0x${rootAuthorityPkd}`,
      `ASSERT SIGNEDBY(root)`,
      ...delegateChecks,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: rootAuthorityPkd,
    constraints: options,
  };
}
