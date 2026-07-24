import type {
  ActionProposal,
  ActionExecution,
  ActionExecutor,
  ExecuteActionResult,
  ActionReceipt,
} from './types.js'
import { ActionExecutionError, ActionValidationError } from './errors.js'
import { computeActionExecutionId, computeReceiptId } from './ids.js'
import { assertValidProposal, isProposalExecutable } from './proposal.js'
import { assertValidParameters, assertValidContext } from './definition.js'
import { evaluateConditions } from './condition.js'

export async function executeAction(
  proposal: ActionProposal,
  executor: ActionExecutor,
  context: Record<string, unknown>,
  now?: number,
): Promise<ExecuteActionResult> {
  const effectiveNow = now ?? Date.now()
  assertValidProposal(proposal)
  if (!isProposalExecutable(proposal, effectiveNow)) {
    throw new ActionValidationError('proposal is not executable')
  }
  assertValidParameters(executor.kind === proposal.kind ? { parameters: [], context: [] } : { parameters: [], context: [] }, proposal.parameters)
  assertValidContext(executor.kind === proposal.kind ? { parameters: [], context: [] } : { parameters: [], context: [] }, context, effectiveNow)
  const executionId = computeActionExecutionId(proposal.id)
  const execution: ActionExecution = {
    id: executionId,
    proposalId: proposal.id,
    status: 'executing',
    startedAt: effectiveNow,
  }
  try {
    const result = await executor.execute(proposal, proposal.parameters, context)
    execution.status = result.ok ? 'confirmed' : 'failed'
    execution.completedAt = Date.now()
    if (result.ok) {
      execution.result = result.data
    } else {
      execution.error = { code: result.errorCode ?? 'EXECUTION_FAILED', message: result.error ?? 'execution returned failure' }
    }
  } catch (err) {
    execution.status = 'unknown'
    execution.completedAt = Date.now()
    execution.error = {
      code: 'EXECUTION_ERROR',
      message: err instanceof Error ? err.message : 'unknown execution error',
    }
  }
  const receipt: ActionReceipt = {
    receiptId: computeReceiptId(execution.id, proposal.id),
    actionId: execution.id,
    proposalId: proposal.id,
    kind: proposal.kind,
    status: execution.status === 'confirmed' ? 'confirmed' : execution.status === 'failed' ? 'failed' : 'unknown',
    commitmentHash: proposal.commitmentHash,
    parameters: proposal.parameters,
    result: execution.result,
    error: execution.error,
    issuedAt: execution.completedAt ?? Date.now(),
  }
  execution.receipt = receipt
  return { execution, receipt }
}
