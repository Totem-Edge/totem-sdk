import type { AuthorityDecision } from '@totemsdk/authority'
import type { Dimension, Unit, Quantity } from './units.js'

export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'quantity'

export interface ParameterSchema {
  name: string
  type: ParameterType
  required: boolean
  description?: string
  defaultValue?: unknown
  validation?: (value: unknown) => string | null
  // Quantity fields (used when `type === 'quantity'` — RFC-011 §4.1).
  dimension?: Dimension
  unit?: Unit
  min?: Quantity
  max?: Quantity
  step?: Quantity
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

export interface CreateProposalParams {
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
  proposedAt?: number
  expiresAt?: number
  mandateProofId?: string
}
