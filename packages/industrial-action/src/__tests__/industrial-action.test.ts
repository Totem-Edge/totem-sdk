import {
  toHex,
  canonicalJson,
  hashCanonical,
  computeActionProposalId,
  computeActionExecutionId,
  computeCommitmentHash,
  computeReceiptId,
  validateParameters,
  validateContext,
  createProposal,
  verifyCommitment,
  assertValidProposal,
  isProposalExpired,
  isProposalExecutable,
  createCommitment,
  verifyCommitmentBinding,
  serializeCommitmentPayload,
  evaluateConditions,
  createCondition,
  ActionCommitmentError,
} from '../index'
import type {
  ActionSchema,
  Condition,
} from '../index'

const NOW = 1000000000000

// ─── 1. Canonical ──────────────────────────────────────────────────────────

describe('canonical', () => {
  it('toHex converts bytes', () => {
    expect(toHex(new Uint8Array([0, 255, 16]))).toBe('00ff10')
  })

  it('canonicalJson sorts keys', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
  })

  it('canonicalJson handles nested', () => {
    const input = { z: { b: 2, a: 1 }, y: 3 }
    expect(canonicalJson(input)).toBe('{"y":3,"z":{"a":1,"b":2}}')
  })

  it('canonicalJson arrays preserve order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]')
  })

  it('canonicalJson null and primitives', () => {
    expect(canonicalJson(null)).toBe('null')
    expect(canonicalJson('hello')).toBe('"hello"')
    expect(canonicalJson(42)).toBe('42')
    expect(canonicalJson(true)).toBe('true')
  })

  it('hashCanonical produces deterministic hex', () => {
    const h1 = hashCanonical('TEST', { a: 1 })
    const h2 = hashCanonical('TEST', { a: 1 })
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
  })

  it('hashCanonical different domains produce different hashes', () => {
    const h1 = hashCanonical('DOMAIN_A', { a: 1 })
    const h2 = hashCanonical('DOMAIN_B', { a: 1 })
    expect(h1).not.toBe(h2)
  })
})

// ─── 2. IDs ────────────────────────────────────────────────────────────────

describe('ids', () => {
  it('computeActionProposalId returns totem:ia:proposal:...', () => {
    const id = computeActionProposalId({
      kind: 'test-action',
      parameters: { target: 'valve-1' },
      context: { temperature: 85 },
      proposedAt: NOW,
    })
    expect(id).toMatch(/^totem:ia:proposal:[a-f0-9]{64}$/)
  })

  it('computeActionProposalId is deterministic', () => {
    const id1 = computeActionProposalId({ kind: 'x', parameters: {}, context: {}, proposedAt: NOW })
    const id2 = computeActionProposalId({ kind: 'x', parameters: {}, context: {}, proposedAt: NOW })
    expect(id1).toBe(id2)
  })

  it('computeActionExecutionId returns totem:ia:exec:...', () => {
    const execId = computeActionExecutionId('proposal-1')
    expect(execId).toMatch(/^totem:ia:exec:[a-f0-9]{64}$/)
  })

  it('computeCommitmentHash returns hex', () => {
    const hash = computeCommitmentHash({ kind: 'write', parameters: { value: 42 }, context: {} })
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('computeReceiptId returns totem:ia:receipt:...', () => {
    const rid = computeReceiptId('exec-1', 'prop-1')
    expect(rid).toMatch(/^totem:ia:receipt:[a-f0-9]{64}$/)
  })
})

// ─── 3. Definitions & Validation ───────────────────────────────────────────

describe('definition', () => {
  const schema: ActionSchema = {
    parameters: [
      { name: 'target', type: 'string', required: true },
      { name: 'value', type: 'number', required: false, defaultValue: 0 },
    ],
    context: [
      { name: 'temperature', type: 'number', required: true },
      { name: 'humidity', type: 'number', required: false },
    ],
  }

  it('validateParameters returns errors for missing required', () => {
    const errors = validateParameters(schema, {})
    expect(errors).toContain("parameter 'target' is required")
  })

  it('validateParameters returns errors for wrong type', () => {
    const errors = validateParameters(schema, { target: 'v1', value: 'not-a-number' })
    expect(errors.some(e => e.includes('expected number'))).toBe(true)
  })

  it('validateParameters passes with correct types', () => {
    const errors = validateParameters(schema, { target: 'v1', value: 42 })
    expect(errors).toHaveLength(0)
  })

  it('validateParameters skips optional missing', () => {
    const errors = validateParameters(schema, { target: 'v1' })
    expect(errors).toHaveLength(0)
  })

  it('validateContext returns errors for missing required', () => {
    const errors = validateContext(schema, {}, NOW)
    expect(errors).toContain("context 'temperature' is required")
  })

  it('validateContext passes with correct context', () => {
    const errors = validateContext(schema, { temperature: 85, humidity: 60 }, NOW)
    expect(errors).toHaveLength(0)
  })
})

// ─── 4. Proposal Lifecycle ─────────────────────────────────────────────────

describe('proposal', () => {
  it('createProposal returns proposal with computed id and commitment', () => {
    const p = createProposal({
      kind: 'write-valve',
      parameters: { target: 'v1', value: 50 },
      context: { temperature: 85 },
      proposedAt: NOW,
    })
    expect(p.id).toMatch(/^totem:ia:proposal:/)
    expect(p.kind).toBe('write-valve')
    expect(p.parameters.target).toBe('v1')
    expect(p.commitmentHash).toHaveLength(64)
    expect(p.proposedAt).toBe(NOW)
  })

  it('createProposal sets expiresAt when provided', () => {
    const p = createProposal({
      kind: 'write-valve',
      parameters: {},
      context: {},
      proposedAt: NOW,
      expiresAt: NOW + 3600000,
    })
    expect(p.expiresAt).toBe(NOW + 3600000)
  })

  it('verifyCommitment returns true for valid commitment', () => {
    const p = createProposal({
      kind: 'write-valve',
      parameters: { target: 'v1' },
      context: {},
      proposedAt: NOW,
    })
    expect(verifyCommitment(p)).toBe(true)
  })

  it('verifyCommitment returns false if parameters tampered', () => {
    const p = createProposal({
      kind: 'write-valve',
      parameters: { target: 'v1' },
      context: {},
      proposedAt: NOW,
    })
    p.parameters = { target: 'v2' }
    expect(verifyCommitment(p)).toBe(false)
  })

  it('assertValidProposal throws on tampered proposal', () => {
    const p = createProposal({
      kind: 'write-valve',
      parameters: { target: 'v1' },
      context: {},
      proposedAt: NOW,
    })
    p.parameters = { target: 'v2' }
    expect(() => assertValidProposal(p)).toThrow(ActionCommitmentError)
  })

  it('isProposalExpired returns true when now > expiresAt', () => {
    const p = createProposal({
      kind: 'write-valve',
      parameters: {},
      context: {},
      proposedAt: NOW,
      expiresAt: NOW + 1000,
    })
    expect(isProposalExpired(p, NOW + 2000)).toBe(true)
    expect(isProposalExpired(p, NOW + 500)).toBe(false)
  })

  it('isProposalExpired returns false when no expiresAt', () => {
    const p = createProposal({ kind: 'test', parameters: {}, context: {}, proposedAt: NOW })
    expect(isProposalExpired(p, NOW + 999999)).toBe(false)
  })

  it('isProposalExecutable returns false when expired', () => {
    const p = createProposal({
      kind: 'test',
      parameters: {},
      context: {},
      proposedAt: NOW,
      expiresAt: NOW + 1000,
    })
    expect(isProposalExecutable(p, NOW + 2000)).toBe(false)
  })

  it('isProposalExecutable returns true when not expired', () => {
    const p = createProposal({ kind: 'test', parameters: {}, context: {}, proposedAt: NOW })
    expect(isProposalExecutable(p, NOW + 1000)).toBe(true)
  })
})

// ─── 5. Commitment ─────────────────────────────────────────────────────────

describe('commitment', () => {
  it('createCommitment matches computeCommitmentHash', () => {
    const h1 = createCommitment({ kind: 'x', parameters: { a: 1 }, context: {} })
    const h2 = computeCommitmentHash({ kind: 'x', parameters: { a: 1 }, context: {} })
    expect(h1).toBe(h2)
  })

  it('verifyCommitmentBinding returns true for valid proposals', () => {
    const p = createProposal({ kind: 'test', parameters: { x: 1 }, context: {}, proposedAt: NOW })
    expect(verifyCommitmentBinding(p)).toBe(true)
  })

  it('serializeCommitmentPayload produces canonical JSON', () => {
    const p = createProposal({ kind: 'test', parameters: { b: 2, a: 1 }, context: {}, proposedAt: NOW })
    const s = serializeCommitmentPayload(p)
    expect(typeof s).toBe('string')
    // keys should be sorted in the JSON
    expect(s).toContain('"a":1')
    expect(s).toContain('"b":2')
  })
})

// ─── 6. Conditions ─────────────────────────────────────────────────────────

describe('conditions', () => {
  it('evaluateConditions passes when all conditions pass', () => {
    const conditions: Condition[] = [
      createCondition({ type: 'parameter_range', field: 'value', operator: 'gte', value: 0 }),
      createCondition({ type: 'parameter_range', field: 'value', operator: 'lte', value: 100 }),
    ]
    const result = evaluateConditions(conditions, { value: 50 }, {})
    expect(result.passed).toBe(true)
    expect(result.failed).toHaveLength(0)
  })

  it('evaluateConditions fails when condition fails', () => {
    const conditions: Condition[] = [
      createCondition({ type: 'parameter_range', field: 'value', operator: 'gte', value: 0 }),
      createCondition({ type: 'parameter_range', field: 'value', operator: 'lte', value: 50 }),
    ]
    const result = evaluateConditions(conditions, { value: 100 }, {})
    expect(result.passed).toBe(false)
    expect(result.failed).toHaveLength(1)
  })

  it('evaluateConditions supports context fields', () => {
    const conditions: Condition[] = [
      createCondition({ type: 'context_match', field: 'context.temperature', operator: 'lt', value: 100 }),
    ]
    const result = evaluateConditions(conditions, {}, { temperature: 85 })
    expect(result.passed).toBe(true)
  })

  it('evaluateConditions supports custom evaluator', () => {
    const conditions: Condition[] = [
      createCondition({
        type: 'custom',
        evaluate: (_p, _c) => 'custom failure',
      }),
    ]
    const result = evaluateConditions(conditions, {}, {})
    expect(result.passed).toBe(false)
    expect(result.failed[0].reason).toBe('custom failure')
  })

  it('evaluateConditions handles in/not_in', () => {
    const conditions: Condition[] = [
      createCondition({ type: 'parameter_range', field: 'state', operator: 'in', value: ['open', 'closed'] }),
    ]
    expect(evaluateConditions(conditions, { state: 'open' }, {}).passed).toBe(true)
    expect(evaluateConditions(conditions, { state: 'broken' }, {}).passed).toBe(false)
  })
})

