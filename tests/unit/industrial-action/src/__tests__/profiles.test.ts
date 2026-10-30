/**
 * RFC-011 Phase H — vertical profiles + conformance.
 */

import {
  runProfileConformance,
  assertProfileConformance,
  createProfileRegistries,
  waterProfile,
  hvacProfile,
  type IndustrialProfile,
} from '../profiles.js';
import { ActionDefinitionError } from '../errors.js';
import type { IndustrialActionDefinition } from '../edge-adapter.js';
import type { ActionSchema } from '../types.js';

describe('reference profiles (RFC-011 §6)', () => {
  it('water and HVAC profiles conform', () => {
    expect(runProfileConformance(waterProfile())).toMatchObject({ ok: true, issues: [] });
    expect(runProfileConformance(hvacProfile())).toMatchObject({ ok: true, issues: [] });
  });

  it('materializes registries', () => {
    const profile = hvacProfile();
    const { units, resources, interlocks } = createProfileRegistries(profile);
    expect(units.has('°C')).toBe(true);
    expect(resources.resolveAddress({ site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'setpoint' }, 'bacnet')?.endpoint).toBe(
      'analogOutput,3,presentValue',
    );
    expect(interlocks.list().map((i) => i.id)).toContain('freezestat');
  });
});

describe('profile conformance (RFC-011 §7)', () => {
  const badDefinition: IndustrialActionDefinition = {
    kind: 'bad.write',
    description: 'write without failure mode',
    schema: {
      parameters: [{ name: 'setpoint', type: 'quantity', required: true, dimension: 'temperature' }],
      context: [],
    },
    capability: 'industrial:action',
    effect: 'write',
    async prepare() {
      return {};
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async () => ({ ok: true }),
  };

  const invalidSchema: ActionSchema = badDefinition.schema;

  const badProfile: IndustrialProfile = {
    id: 'bad',
    version: 1,
    resources: [
      { id: { site: 's', asset: 'a' }, kind: 'actuator', addresses: [{ protocol: 'modbus', endpoint: 'holding:1', unit: 'bogus' }] },
    ],
    interlocks: [
      { id: 'dup', kind: 'precondition', evaluate: () => ({ satisfied: true }) },
      { id: 'dup', kind: 'precondition', evaluate: () => ({ satisfied: true }) },
    ],
    definitions: [{ ...badDefinition, schema: invalidSchema }],
    recipes: [
      { id: 'r', version: 1, steps: [{ id: 'a', definition: 'x', dependsOn: ['b'] }, { id: 'b', definition: 'y', dependsOn: ['a'] }] },
    ],
  };

  it('reports issues across scopes', () => {
    const report = runProfileConformance(badProfile);
    expect(report.ok).toBe(false);
    const scopes = report.issues.map((i) => i.scope);
    expect(scopes).toEqual(expect.arrayContaining(['resources', 'interlocks', 'definitions', 'recipes']));
    expect(report.issues.some((i) => i.message.includes("unit 'bogus'"))).toBe(true);
    expect(report.issues.some((i) => i.message.includes('declares no failureMode'))).toBe(true);
    expect(report.issues.some((i) => i.message.includes('missing dimension/unit'))).toBe(true);
    expect(report.issues.some((i) => i.message.includes('dependency cycle'))).toBe(true);
  });

  it('throws from assertProfileConformance', () => {
    expect(() => assertProfileConformance(badProfile)).toThrow(ActionDefinitionError);
    expect(() => assertProfileConformance(waterProfile())).not.toThrow();
  });
});
