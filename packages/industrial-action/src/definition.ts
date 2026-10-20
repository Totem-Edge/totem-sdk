import type {
  ActionSchema,
  ParameterSchema,
  ParameterType,
} from './types.js'
import { ActionValidationError } from './errors.js'
import { checkQuantity, defaultUnitRegistry, type UnitRegistry } from './units.js'

export function validateParameters(
  schema: ActionSchema,
  parameters: Record<string, unknown>,
  units: UnitRegistry = defaultUnitRegistry(),
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
    const typeErr = field.type === 'quantity'
      ? checkQuantityField(field, value, units)
      : checkType(field.type, value)
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

function checkQuantityField(
  field: ParameterSchema,
  value: unknown,
  units: UnitRegistry,
): string | null {
  if (field.dimension === undefined || field.unit === undefined) {
    return `quantity parameter is missing dimension/unit`
  }
  return checkQuantity(
    value,
    {
      dimension: field.dimension,
      unit: field.unit,
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.max !== undefined ? { max: field.max } : {}),
      ...(field.step !== undefined ? { step: field.step } : {}),
    },
    units,
  )
}

function observedAtOf(value: unknown): number | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const observedAt = record.observedAt ?? record.timestamp
  return typeof observedAt === 'number' && Number.isFinite(observedAt)
    ? observedAt
    : undefined
}

function unwrapContextValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as { value: unknown }).value
  }
  return value
}

export function validateContext(
  schema: ActionSchema,
  context: Record<string, unknown>,
  now: number,
): string[] {
  const errors: string[] = []
  for (const field of schema.context) {
    const raw = context[field.name]
    if (raw === undefined || raw === null) {
      if (field.required) {
        errors.push(`context '${field.name}' is required`)
      }
      continue
    }

    let value: unknown = raw
    if (field.maxAgeMs !== undefined) {
      const observedAt = observedAtOf(raw)
      if (observedAt === undefined) {
        errors.push(
          `context '${field.name}': freshness metadata (observedAt) is required when maxAgeMs is set`,
        )
        continue
      }
      const age = now - observedAt
      if (age < 0) {
        errors.push(`context '${field.name}': observedAt is in the future`)
      } else if (age > field.maxAgeMs) {
        errors.push(
          `context '${field.name}': stale (age ${age}ms > maxAgeMs ${field.maxAgeMs}ms)`,
        )
      }
      value = unwrapContextValue(raw)
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

export function assertValidParameters(
  schema: ActionSchema,
  parameters: Record<string, unknown>,
  units: UnitRegistry = defaultUnitRegistry(),
): void {
  const errors = validateParameters(schema, parameters, units)
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
