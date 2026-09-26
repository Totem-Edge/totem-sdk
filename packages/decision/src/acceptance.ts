/**
 * @module @totemsdk/decision/acceptance
 *
 * Acceptance evaluation. Acceptance answers only "is this good enough to become
 * the `DecisionResult`?" — never "may this happen?". Authority is downstream.
 */

import type {
  DecisionAcceptanceContext,
  DecisionAcceptanceEvaluation,
  DecisionAcceptanceRule,
  DecisionAnswer,
  DecisionResult,
} from './types.js';
import { normalizedEntropy } from './validation.js';

function answerConfidence(answer: DecisionAnswer): number | undefined {
  switch (answer.type) {
    case 'choice': {
      if (answer.confidence) return answer.confidence.value;
      if (answer.probabilities && answer.selected in answer.probabilities) {
        return answer.probabilities[answer.selected];
      }
      return undefined;
    }
    case 'score': {
      if (answer.confidence) return answer.confidence.value;
      if (answer.distribution && answer.selected in answer.distribution) {
        return answer.distribution[answer.selected];
      }
      return undefined;
    }
    case 'probability':
      return answer.confidence?.value;
    case 'action': {
      if (answer.confidence) return answer.confidence.value;
      if (answer.operationProbabilities && answer.operation in answer.operationProbabilities) {
        return answer.operationProbabilities[answer.operation];
      }
      return undefined;
    }
  }
}

function actionOperationConfidence(decision: DecisionResult): number | undefined {
  if (decision.kind !== 'action') return undefined;
  const a = decision.answer;
  if (a.confidence) return a.confidence.value;
  return a.operationProbabilities?.[a.operation];
}

function actionTargetConfidence(decision: DecisionResult): number | undefined {
  if (decision.kind !== 'action') return undefined;
  const a = decision.answer;
  if (a.target === undefined) return undefined;
  return a.targetProbabilities?.[a.target];
}

/**
 * Aggregate confidence for a decision.
 *
 * For batched questions this is the **minimum** across answers; if any answer
 * lacks a confidence value the aggregate is `undefined` (so `minConfidence`
 * treats a missing confidence as a failure).
 */
export function aggregateConfidence(decision: DecisionResult): number | undefined {
  if (decision.kind === 'action') {
    return actionOperationConfidence(decision);
  }
  if (decision.answers.length === 0) return undefined;
  let min: number | undefined;
  for (const answer of decision.answers) {
    const value = answerConfidence(answer);
    if (value === undefined) return undefined;
    min = min === undefined ? value : Math.min(min, value);
  }
  return min;
}

/** Evaluate a route's acceptance rule. */
export function evaluateAcceptance(
  rule: DecisionAcceptanceRule | undefined,
  context: DecisionAcceptanceContext,
): DecisionAcceptanceEvaluation {
  const { decision } = context;
  const confidence = context.confidence ?? aggregateConfidence(decision);

  if (rule?.minConfidence !== undefined) {
    if (confidence === undefined || confidence < rule.minConfidence) {
      return { accepted: false, reason: 'LOW_CONFIDENCE', confidence };
    }
  }

  if (rule?.minSelectedProbability !== undefined) {
    const ok = selectedProbabilitiesMeet(decision, rule.minSelectedProbability);
    if (!ok) return { accepted: false, reason: 'LOW_SELECTED_PROBABILITY', confidence };
  }

  if (rule?.requireProbabilities === true) {
    if (!hasRequiredProbabilities(decision)) {
      return { accepted: false, reason: 'LOW_SELECTED_PROBABILITY', confidence };
    }
  }

  if (rule?.maxEntropy !== undefined) {
    const entropy = maxCompleteEntropy(decision);
    if (entropy !== undefined && entropy > rule.maxEntropy) {
      return { accepted: false, reason: 'CUSTOM_REJECTION', confidence };
    }
  }

  if (rule?.minOperationConfidence !== undefined && decision.kind === 'action') {
    const opConfidence = actionOperationConfidence(decision);
    if (opConfidence === undefined || opConfidence < rule.minOperationConfidence) {
      return { accepted: false, reason: 'LOW_CONFIDENCE', confidence };
    }
  }

  if (rule?.minTargetConfidence !== undefined && decision.kind === 'action') {
    const target = decision.answer.target;
    if (target !== undefined) {
      const targetConfidence = actionTargetConfidence(decision);
      if (targetConfidence === undefined || targetConfidence < rule.minTargetConfidence) {
        return { accepted: false, reason: 'LOW_CONFIDENCE', confidence };
      }
    }
  }

  if (rule?.predicate) {
    const result = rule.predicate({ ...context, confidence });
    if (typeof result === 'boolean') {
      if (!result) return { accepted: false, reason: 'CUSTOM_REJECTION', confidence };
    } else if (!result.accepted) {
      return { ...result, confidence: result.confidence ?? confidence };
    }
  }

  return { accepted: true, confidence };
}

function selectedProbabilitiesMeet(decision: DecisionResult, threshold: number): boolean {
  if (decision.kind === 'action') {
    const a = decision.answer;
    if (a.operationProbabilities && a.operation in a.operationProbabilities) {
      return a.operationProbabilities[a.operation] >= threshold;
    }
    return false;
  }
  for (const answer of decision.answers) {
    if (answer.type === 'choice' && answer.probabilities) {
      if (!(answer.selected in answer.probabilities)) return false;
      if (answer.probabilities[answer.selected] < threshold) return false;
    } else if (answer.type === 'score' && answer.distribution) {
      if (!(answer.selected in answer.distribution)) return false;
      if (answer.distribution[answer.selected] < threshold) return false;
    }
  }
  return true;
}

function hasRequiredProbabilities(decision: DecisionResult): boolean {
  if (decision.kind === 'action') {
    const a = decision.answer;
    return a.operationProbabilities !== undefined && a.operation in a.operationProbabilities;
  }
  for (const answer of decision.answers) {
    if (answer.type === 'choice' && !answer.probabilities) return false;
  }
  return true;
}

function maxCompleteEntropy(decision: DecisionResult): number | undefined {
  let max: number | undefined;
  const consider = (dist: Record<string, number> | undefined, complete: boolean | undefined): void => {
    if (!dist || complete !== true) return;
    const entropy = normalizedEntropy(dist);
    max = max === undefined ? entropy : Math.max(max, entropy);
  };
  if (decision.kind === 'action') {
    // Action distributions carry no explicit completeness marker, so normalized
    // entropy (which is only meaningful for complete distributions) is not
    // applied to actions. See RFC-012 §20.
    return max;
  }
  for (const answer of decision.answers) {
    if (answer.type === 'choice') consider(answer.probabilities, answer.complete);
    else if (answer.type === 'score') consider(answer.distribution, answer.complete);
  }
  return max;
}
