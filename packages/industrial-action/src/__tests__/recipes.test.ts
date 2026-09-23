/**
 * RFC-011 Phase D — action composition (recipes / sagas).
 */

import { executeRecipe, createRecipe, type ActionStep } from '../recipes.js';
import { ActionDefinitionError } from '../errors.js';
import type { ActionOutcome, IndustrialExecutionResult } from '../edge-adapter.js';

const OK = (): IndustrialExecutionResult => ({ ok: true, outcome: 'confirmed', failureMode: 'abort', attempts: 1 });
const FAIL = (): IndustrialExecutionResult => ({
  ok: false,
  outcome: 'aborted',
  failureMode: 'abort',
  attempts: 1,
  error: 'boom',
});

function step(id: string, over: Partial<ActionStep> = {}): ActionStep {
  return { id, definition: `industrial:${id}`, ...over };
}

/** Execute stub that records the order of executed step ids. */
function recorder(outcomes: Record<string, ActionOutcome> = {}): {
  executed: string[];
  execute: (s: ActionStep) => Promise<IndustrialExecutionResult>;
} {
  const executed: string[] = [];
  return {
    executed,
    execute: async (s) => {
      executed.push(s.id);
      const outcome = outcomes[s.id] ?? 'confirmed';
      if (outcome === 'confirmed') return OK();
      return { ...FAIL(), outcome };
    },
  };
}

describe('executeRecipe (RFC-011 §4.4)', () => {
  it('runs a linear recipe in dependency order', async () => {
    const rec = recorder();
    const result = await executeRecipe(
      createRecipe({ id: 'startup', version: 1, steps: [step('a'), step('b', { dependsOn: ['a'] }), step('c', { dependsOn: ['b'] })] }),
      { execute: rec.execute },
    );
    expect(rec.executed).toEqual(['a', 'b', 'c']);
    expect(result.ok).toBe(true);
    expect(result.steps.map((s) => s.status)).toEqual(['confirmed', 'confirmed', 'confirmed']);
  });

  it('runs independent steps up to the concurrency limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const rec = recorder();
    const execute = async (s: ActionStep): Promise<IndustrialExecutionResult> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return rec.execute(s);
    };
    const result = await executeRecipe(
      createRecipe({
        id: 'parallel',
        version: 1,
        concurrency: 2,
        steps: [step('a'), step('b'), step('c'), step('d', { dependsOn: ['a', 'b', 'c'] })],
      }),
      { execute },
    );
    expect(maxInFlight).toBe(2);
    expect(result.ok).toBe(true);
    expect(rec.executed[rec.executed.length - 1]).toBe('d');
  });

  it('skips a step whose guardrail fails', async () => {
    const rec = recorder();
    const result = await executeRecipe(
      createRecipe({
        id: 'conditional',
        version: 1,
        steps: [
          step('a'),
          step('b', {
            dependsOn: ['a'],
            params: { setpoint: 99 },
            when: [{ type: 'parameter_range', field: 'setpoint', operator: 'lte', value: 35 }],
          }),
        ],
      }),
      { execute: rec.execute },
    );
    expect(rec.executed).toEqual(['a']);
    expect(result.steps.find((s) => s.stepId === 'b')?.status).toBe('skipped');
    expect(result.ok).toBe(true);
  });

  it('compensates confirmed steps in reverse order on failure', async () => {
    const rec = recorder({ c: 'aborted' });
    const result = await executeRecipe(
      createRecipe({
        id: 'saga',
        version: 1,
        steps: [
          step('a', { compensation: step('undo-a') }),
          step('b', { dependsOn: ['a'], compensation: step('undo-b') }),
          step('c', { dependsOn: ['b'] }),
        ],
      }),
      { execute: rec.execute },
    );
    expect(result.ok).toBe(false);
    expect(result.compensated).toBe(true);
    expect(rec.executed).toEqual(['a', 'b', 'c', 'undo-b', 'undo-a']);
    expect(result.steps.find((s) => s.stepId === 'b')?.compensation?.stepId).toBe('undo-b');
  });

  it('rejects cycles and unknown dependencies', async () => {
    const rec = recorder();
    await expect(
      executeRecipe(
        createRecipe({ id: 'cycle', version: 1, steps: [step('a', { dependsOn: ['b'] }), step('b', { dependsOn: ['a'] })] }),
        { execute: rec.execute },
      ),
    ).rejects.toBeInstanceOf(ActionDefinitionError);

    await expect(
      executeRecipe(
        createRecipe({ id: 'bad', version: 1, steps: [step('a', { dependsOn: ['missing'] })] }),
        { execute: rec.execute },
      ),
    ).rejects.toThrow(/unknown step/);
  });
});
