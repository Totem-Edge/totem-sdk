import type {
  IndustrialActionDefinition,
  ActionSchema,
  ParameterSchema,
  ContextSchema,
  ParameterType,
} from './types.js'
import { ActionValidationError } from './errors.js'

export function createActionDefinition<TParameters = unknown, TResult = unknown>(
  kind: string,
  description: string,
  schema: ActionSchema,
  handler: { execute(params: TParameters, context: Record<string, unknown>): Promise<{ ok: boolean; data?: TResult; error?: string; errorCode?: string }> },
): IndustrialActionDefinition<TParameters, TResult> {
  return { kind, description, schema, handler }
}

export function validateParameters(
  schema: ActionSchema,
  parameters: Record<string, unknown>,
): string[] {
  const errors: string[] = []
  for (const field of schema.parameters) {
    const value = parameters[field.name]
    if (value === undefined || value === null) {
      if (field.required) {
        errors.push(`parameter '${field.name}' is required`)
      }
      continue
    }
    const typeErr = checkType(field.type, value)
    if (typeErr) {
      errors.push(`parameter '${field.name}': ${typeErr}`)
    }
    if (field.validation) {
      const validationErr = field.validation(value)
      if (validationErr) {
        errors.push(`parameter '${field.name}': ${validationErr}`)
      }
    }
  }
  return errors
}

export function validateContext(
  schema: ActionSchema,
  context: Record<string, unknown>,
  now: number,
): string[] {
  const errors: string[] = []
  for (const field of schema.context) {
    const value = context[field.name]
    if (value === undefined || value === null) {
      if (field.required) {
        errors.push(`context '${field.name}' is required`)
      }
      continue
    }
    const typeErr = checkType(field.type, value)
    if (typeErr) {
      errors.push(`context '${field.name}': ${typeErr}`)
    }
  }
  return errors
}

export function checkType(expected: ParameterType, value: unknown): string | null {
  switch (expected) {
    case 'string':
      return typeof value === 'string' ? null : `expected string, got ${typeof value}`
    case 'number':
      return typeof value === 'number' ? null : `expected number, got ${typeof value}`
    case 'boolean':
      return typeof value === 'boolean' ? null : `expected boolean, got ${typeof value}`
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? null
        : `expected object, got ${typeof value}`
    case 'array':
      return Array.isArray(value) ? null : `expected array, got ${typeof value}`
    default:
      return `unknown type '${expected}'`
  }
}

export function assertValidParameters(schema: ActionSchema, parameters: Record<string, unknown>): void {
  const errors = validateParameters(schema, parameters)
  if (errors.length > 0) {
    throw new ActionValidationError('parameter validation failed', { errors })
  }
}

export function assertValidContext(schema: ActionSchema, context: Record<string, unknown>, now: number): void {
  const errors = validateContext(schema, context, now)
  if (errors.length > 0) {
    throw new ActionValidationError('context validation failed', { errors })
  }
}
