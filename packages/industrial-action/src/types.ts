import type { AuthorityDecision } from '@totemsdk/authority'
import type { EdgeOperationResult } from '@totemsdk/edge'

export type ActionStatus =
  | 'proposed'
  | 'approved'
  | 'reserved'
  | 'executing'
  | 'confirmed'
  | 'failed'
  | 'unknown'
  | 'cancelled'

export type ExecutionStatus =
  | 'pending'
  | 'executing'
  | 'confirmed'
  | 'failed'
  | 'unknown'

export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export interface ParameterSchema {
  name: string
  type: ParameterType
  required: boolean
  description?: string
  defaultValue?: unknown
  validation?: (value: unknown) => string | null
}

export interface ContextField {
  name: string
  value: unknown
  timestamp: number
  source?: string
}

export interface ContextSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object'
  required: boolean
  description?: string
  maxAgeMs?: number
}

export interface ActionSchema {
  parameters: ParameterSchema[]
  context: ContextSchema[]
}

export interface ActionError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ActionProposal {
  id: string
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
  proposedAt: number
  expiresAt?: number
  commitmentHash: string
  mandateProofId?: string
  authorityDecision?: AuthorityDecision
}

export interface ActionExecution {
  id: string
  proposalId: string
  status: ExecutionStatus
  result?: unknown
  error?: ActionError
  startedAt: number
  completedAt?: number
  receipt?: ActionReceipt
}

export interface ActionReceipt {
  receiptId: string
  actionId: string
  proposalId: string
  kind: string
  status: ActionStatus
  commitmentHash: string
  parameters: Record<string, unknown>
  result?: unknown
  error?: ActionError
  issuedAt: number
}

export interface ActionHandler<TParameters = unknown, TResult = unknown> {
  execute(params: TParameters, context: Record<string, unknown>): Promise<EdgeOperationResult<TResult>>
}

export interface IndustrialActionDefinition<TParameters = unknown, TResult = unknown> {
  kind: string
  description: string
  schema: ActionSchema
  handler: ActionHandler<TParameters, TResult>
}

export interface Condition {
  type: 'parameter_range' | 'context_match' | 'time_window' | 'custom'
  field?: string
  operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in'
  value?: unknown
  evaluate?: (params: Record<string, unknown>, context: Record<string, unknown>) => string | null
}

export interface ConditionResult {
  passed: boolean
  failed: Array<{ condition: Condition; reason: string }>
}

export interface ActionExecutor<TParameters = unknown, TResult = unknown> {
  kind: string
  execute(
    proposal: ActionProposal,
    params: TParameters,
    context: Record<string, unknown>,
  ): Promise<EdgeOperationResult<TResult>>
}

export interface GovernanceBridge {
  reserve(
    proposal: ActionProposal,
    mandateProofId: string,
  ): Promise<EdgeOperationResult<{ reservationId: string }>>
  commit(
    reservationId: string,
    execution: ActionExecution,
  ): Promise<EdgeOperationResult<void>>
  abort(
    reservationId: string,
    error: ActionError,
  ): Promise<EdgeOperationResult<void>>
}

export interface ActionStorage {
  saveProposal(proposal: ActionProposal): Promise<EdgeOperationResult<void>>
  getProposal(id: string): Promise<EdgeOperationResult<ActionProposal>>
  saveExecution(execution: ActionExecution): Promise<EdgeOperationResult<void>>
  getExecution(id: string): Promise<EdgeOperationResult<ActionExecution>>
  saveReceipt(receipt: ActionReceipt): Promise<EdgeOperationResult<void>>
}

export interface CreateProposalParams {
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
  proposedAt?: number
  expiresAt?: number
  mandateProofId?: string
}

export interface ExecuteActionResult<TResult = unknown> {
  execution: ActionExecution
  receipt?: ActionReceipt
}
