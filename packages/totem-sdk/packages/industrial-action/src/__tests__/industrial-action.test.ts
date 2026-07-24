import {
  toHex,
  canonicalJson,
  hashCanonical,
  computeActionProposalId,
  computeActionExecutionId,
  computeCommitmentHash,
  computeReceiptId,
  createActionDefinition,
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
  executeAction,
  ActionRegistry,
  createGovernanceBridge,
  checkGovernanceConstraints,
  createReceipt,
  verifyReceiptIntegrity,
  ActionValidationError,
  ActionCommitmentError,
  ActionDefinitionError,
} from '../index'
import type {
  IndustrialActionDefinition,
  ActionProposal,
  ActionExecutor,
  ActionExecution,
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

  it('createActionDefinition returns definition', () => {
    const def = createActionDefinition('write-valve', 'Write a valve position', schema, {
      async execute(_params, _context) {
        return { ok: true }
      },
    })
    expect(def.kind).toBe('write-valve')
    expect(def.schema.parameters).toHaveLength(2)
  })

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

// ─── 7. Execution ──────────────────────────────────────────────────────────

describe('execution', () => {
  it('executeAction succeeds and returns receipt', async () => {
    const proposal = createProposal({
      kind: 'write-valve',
      parameters: { target: 'v1', value: 50 },
      context: {},
      proposedAt: NOW,
    })
    const executor: ActionExecutor = {
      kind: 'write-valve',
      async execute(_proposal, params, _context) {
        return { ok: true, data: { applied: true } }
      },
    }
    const result = await executeAction(proposal, executor, {}, NOW)
    expect(result.execution.status).toBe('confirmed')
    expect(result.receipt).toBeDefined()
    expect(result.receipt!.status).toBe('confirmed')
    expect(result.execution.result).toEqual({ applied: true })
  })

  it('executeAction returns failed status on handler failure', async () => {
    const proposal = createProposal({
      kind: 'fail-action',
      parameters: {},
      context: {},
      proposedAt: NOW,
    })
    const executor: ActionExecutor = {
      kind: 'fail-action',
      async execute() {
        return { ok: false, error: 'device not reachable', errorCode: 'DEVICE_OFFLINE' }
      },
    }
    const result = await executeAction(proposal, executor, {}, NOW)
    expect(result.execution.status).toBe('failed')
    expect(result.execution.error?.code).toBe('DEVICE_OFFLINE')
    expect(result.execution.error?.message).toBe('device not reachable')
  })

  it('executeAction returns unknown status on thrown error', async () => {
    const proposal = createProposal({
      kind: 'crash-action',
      parameters: {},
      context: {},
      proposedAt: NOW,
    })
    const executor: ActionExecutor = {
      kind: 'crash-action',
      async execute() {
        throw new Error('unexpected crash')
      },
    }
    const result = await executeAction(proposal, executor, {}, NOW)
    expect(result.execution.status).toBe('unknown')
    expect(result.receipt!.status).toBe('unknown')
  })

  it('executeAction throws on expired proposal', async () => {
    const proposal = createProposal({
      kind: 'test',
      parameters: {},
      context: {},
      proposedAt: NOW - 10000,
      expiresAt: NOW - 5000,
    })
    const executor: ActionExecutor = {
      kind: 'test',
      async execute() {
        return { ok: true }
      },
    }
    await expect(executeAction(proposal, executor, {}, NOW)).rejects.toThrow(ActionValidationError)
  })

  it('executeAction records start and end times', async () => {
    const proposal = createProposal({ kind: 'test', parameters: {}, context: {}, proposedAt: NOW })
    const executor: ActionExecutor = {
      kind: 'test',
      async execute() {
        return { ok: true }
      },
    }
    const result = await executeAction(proposal, executor, {}, NOW)
    expect(result.execution.startedAt).toBe(NOW)
    expect(result.execution.completedAt).toBeGreaterThanOrEqual(NOW)
  })
})

// ─── 8. Registry ───────────────────────────────────────────────────────────

describe('ActionRegistry', () => {
  it('registerDefinition and getDefinition', () => {
    const reg = new ActionRegistry()
    const def = createActionDefinition('test', 'test action', { parameters: [], context: [] }, {
      async execute() { return { ok: true } },
    })
    reg.registerDefinition(def)
    expect(reg.getDefinition('test')).toBe(def)
    expect(reg.hasDefinition('test')).toBe(true)
  })

  it('registerDefinition throws on duplicate', () => {
    const reg = new ActionRegistry()
    const def = createActionDefinition('dup', 'dup', { parameters: [], context: [] }, {
      async execute() { return { ok: true } },
    })
    reg.registerDefinition(def)
    expect(() => reg.registerDefinition(def)).toThrow(ActionDefinitionError)
  })

  it('getDefinition returns undefined for unknown', () => {
    const reg = new ActionRegistry()
    expect(reg.getDefinition('nope')).toBeUndefined()
  })

  it('getDefinitionOrThrow throws on unknown', () => {
    const reg = new ActionRegistry()
    expect(() => reg.getDefinitionOrThrow('nope')).toThrow(ActionDefinitionError)
  })

  it('registerExecutor and getExecutor', () => {
    const reg = new ActionRegistry()
    const exec: ActionExecutor = {
      kind: 'test-exec',
      async execute() { return { ok: true } },
    }
    reg.registerExecutor(exec)
    expect(reg.getExecutor('test-exec')).toBe(exec)
    expect(reg.hasExecutor('test-exec')).toBe(true)
  })

  it('listKinds returns all registered kinds', () => {
    const reg = new ActionRegistry()
    reg.registerDefinition(createActionDefinition('a', '', { parameters: [], context: [] }, {
      async execute() { return { ok: true } },
    }))
    reg.registerDefinition(createActionDefinition('b', '', { parameters: [], context: [] }, {
      async execute() { return { ok: true } },
    }))
    const kinds = reg.listKinds()
    expect(kinds).toContain('a')
    expect(kinds).toContain('b')
  })
})

// ─── 9. Governance Bridge ──────────────────────────────────────────────────

describe('governance-bridge', () => {
  it('createGovernanceBridge wraps reserve function', async () => {
    const bridge = createGovernanceBridge(async (_proposal, _proofId) => {
      return { ok: true, data: { reservationId: 'res-1' } }
    })
    const result = await bridge.reserve(undefined as unknown as ActionProposal, 'proof-1')
    expect(result.ok).toBe(true)
    expect(result.data?.reservationId).toBe('res-1')
  })

  it('commit and abort return ok by default', async () => {
    const bridge = createGovernanceBridge(async () => {
      return { ok: true, data: { reservationId: 'res-1' } }
    })
    const commitResult = await bridge.commit('res-1', undefined as unknown as ActionExecution)
    expect(commitResult.ok).toBe(true)
    const abortResult = await bridge.abort('res-1', { code: 'ERR', message: 'fail' })
    expect(abortResult.ok).toBe(true)
  })

  it('checkGovernanceConstraints returns errors for denied authority', () => {
    const p = createProposal({ kind: 'test', parameters: {}, context: {}, proposedAt: NOW })
    p.authorityDecision = { allowed: false, reason: 'not permitted', matchedRules: [], failedRules: [], intentId: 'i1', mandateId: 'm1', decisionId: 'd1', evaluatedAt: NOW, policyVersion: '1', mandateVerification: {} as any, usageSnapshot: {} as any, usageSnapshotHash: '', evidenceIds: [] }
    const errors = checkGovernanceConstraints(p, NOW)
    expect(errors.some(e => e.includes('not permitted'))).toBe(true)
  })

  it('checkGovernanceConstraints returns errors for expired proposal', () => {
    const p = createProposal({ kind: 'test', parameters: {}, context: {}, proposedAt: NOW - 10000, expiresAt: NOW - 1 })
    const errors = checkGovernanceConstraints(p, NOW)
    expect(errors.some(e => e.includes('expired'))).toBe(true)
  })

  it('checkGovernanceConstraints returns no errors for valid proposal', () => {
    const p = createProposal({ kind: 'test', parameters: {}, context: {}, proposedAt: NOW })
    const errors = checkGovernanceConstraints(p, NOW)
    expect(errors).toHaveLength(0)
  })
})

// ─── 10. Receipts ──────────────────────────────────────────────────────────

describe('receipt', () => {
  it('createReceipt produces receipt with computed id', () => {
    const r = createReceipt({
      actionId: 'exec-1',
      proposalId: 'prop-1',
      kind: 'test',
      status: 'confirmed',
      commitmentHash: 'abc123',
      parameters: { x: 1 },
      issuedAt: NOW,
    })
    expect(r.receiptId).toMatch(/^totem:ia:receipt:/)
    expect(r.actionId).toBe('exec-1')
    expect(r.status).toBe('confirmed')
  })

  it('verifyReceiptIntegrity returns true for valid receipt', () => {
    const r = createReceipt({
      actionId: 'exec-1',
      proposalId: 'prop-1',
      kind: 'test',
      status: 'confirmed',
      commitmentHash: 'abc123',
      parameters: {},
      issuedAt: NOW,
    })
    expect(verifyReceiptIntegrity(r)).toBe(true)
  })

  it('verifyReceiptIntegrity returns false for tampered receipt id', () => {
    const r = createReceipt({
      actionId: 'exec-1',
      proposalId: 'prop-1',
      kind: 'test',
      status: 'confirmed',
      commitmentHash: 'abc123',
      parameters: {},
      issuedAt: NOW,
    })
    r.receiptId = 'tampered'
    expect(verifyReceiptIntegrity(r)).toBe(false)
  })

  it('receipt can carry error info', () => {
    const r = createReceipt({
      actionId: 'exec-1',
      proposalId: 'prop-1',
      kind: 'test',
      status: 'failed',
      commitmentHash: 'abc123',
      parameters: {},
      error: { code: 'DEVICE_OFFLINE', message: 'device unreachable', details: { ip: '10.0.0.1' } },
      issuedAt: NOW,
    })
    expect(r.error?.code).toBe('DEVICE_OFFLINE')
    expect(r.error?.details?.ip).toBe('10.0.0.1')
  })
})
