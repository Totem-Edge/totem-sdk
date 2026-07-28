import type { Condition, ConditionResult, ActionProposal } from './types.js'

export function evaluateConditions(
  conditions: Condition[],
  params: Record<string, unknown>,
  context: Record<string, unknown>,
): ConditionResult {
  const failed: ConditionResult['failed'] = []
  for (const condition of conditions) {
    const reason = evaluateCondition(condition, params, context)
    if (reason !== null) {
      failed.push({ condition, reason })
    }
  }
  return { passed: failed.length === 0, failed }
}

function evaluateCondition(
  condition: Condition,
  params: Record<string, unknown>,
  context: Record<string, unknown>,
): string | null {
  if (condition.evaluate) {
    return condition.evaluate(params, context)
  }

  const value = resolveField(condition.field, params, context)
  if (value === undefined && condition.operator !== 'neq') {
    return `field '${condition.field}' not found`
  }
  return applyOperator(condition.operator ?? 'eq', value, condition.value, condition.field ?? '')
}

function resolveField(
  field: string | undefined,
  params: Record<string, unknown>,
  context: Record<string, unknown>,
): unknown {
  if (field === undefined) return undefined
  if (field.startsWith('context.')) {
    return context[field.slice(8)]
  }
  if (field.startsWith('params.')) {
    return params[field.slice(7)]
  }
  return params[field] ?? context[field]
}

function applyOperator(
  operator: string,
  actual: unknown,
  expected: unknown,
  field: string,
): string | null {
  switch (operator) {
    case 'eq':
      return actual === expected ? null : `'${field}': expected ${String(expected)}, got ${String(actual)}`
    case 'neq':
      return actual !== expected ? null : `'${field}': expected not equal to ${String(expected)}`
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected
        ? null
        : `'${field}': expected > ${String(expected)}, got ${String(actual)}`
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
        ? null
        : `'${field}': expected >= ${String(expected)}, got ${String(actual)}`
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected
        ? null
        : `'${field}': expected < ${String(expected)}, got ${String(actual)}`
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
        ? null
        : `'${field}': expected <= ${String(expected)}, got ${String(actual)}`
    case 'in':
      return Array.isArray(expected) && expected.includes(actual)
        ? null
        : `'${field}': ${String(actual)} not in [${String(expected)}]`
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual)
        ? null
        : `'${field}': ${String(actual)} is in [${String(expected)}]`
    default:
      return `unknown operator '${operator}'`
  }
}

export function createCondition(
  params: Pick<Condition, 'type' | 'field' | 'operator' | 'value'> & { evaluate?: Condition['evaluate'] },
): Condition {
  return { ...params }
}
