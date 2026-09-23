/**
 * RFC-011 §5–6 — extensibility & vertical profiles.
 *
 * A profile is a bundle of registrations that configures the vertical-neutral
 * core for a vertical (units, resources, interlocks, error taxonomy,
 * capabilities, definitions, recipes). A conformance harness validates any
 * profile so reference and third-party profiles share one bar.
 */

import type { EdgeCapability } from '@totemsdk/edge';
import type { UnitRegistry } from './units.js';
import { createDefaultUnitRegistry } from './units.js';
import type { Resource, ResourceRegistry } from './resources.js';
import { createResourceRegistry, resourceIdKey } from './resources.js';
import type { Interlock, InterlockRegistry } from './interlocks.js';
import { createInterlockRegistry } from './interlocks.js';
import type { DeviceErrorTaxonomy } from './error-taxonomy.js';
import { validateRecipe, type ActionRecipe } from './recipes.js';
import type { IndustrialActionDefinition } from './edge-adapter.js';
import { ActionDefinitionError } from './errors.js';

export interface IndustrialProfile {
  id: string;
  version: number;
  units?: UnitRegistry;
  resources?: Resource[];
  interlocks?: Interlock[];
  errorTaxonomy?: DeviceErrorTaxonomy;
  capabilities?: EdgeCapability[];
  definitions?: IndustrialActionDefinition[];
  recipes?: ActionRecipe[];
}

export interface ProfileConformanceIssue {
  scope: string;
  message: string;
}

export interface ProfileConformanceReport {
  profileId: string;
  ok: boolean;
  issues: ProfileConformanceIssue[];
}

/** Validate a profile's structure and internal consistency. */
export function runProfileConformance(profile: IndustrialProfile): ProfileConformanceReport {
  const issues: ProfileConformanceIssue[] = [];
  const units = profile.units ?? createDefaultUnitRegistry();

  const seenResources = new Set<string>();
  for (const resource of profile.resources ?? []) {
    const key = resourceIdKey(resource.id);
    if (seenResources.has(key)) issues.push({ scope: 'resources', message: `duplicate resource '${key}'` });
    seenResources.add(key);
    if (!resource.addresses || resource.addresses.length === 0) {
      issues.push({ scope: 'resources', message: `resource '${key}' has no addresses` });
    }
    for (const address of resource.addresses ?? []) {
      if (address.unit !== undefined && !units.has(address.unit)) {
        issues.push({ scope: 'resources', message: `resource '${key}' address unit '${address.unit}' is not registered` });
      }
    }
  }

  const seenInterlocks = new Set<string>();
  for (const interlock of profile.interlocks ?? []) {
    if (seenInterlocks.has(interlock.id)) {
      issues.push({ scope: 'interlocks', message: `duplicate interlock '${interlock.id}'` });
    }
    seenInterlocks.add(interlock.id);
  }

  for (const def of profile.definitions ?? []) {
    if (def.effect === 'write' && effectiveFailureMode(def) === undefined) {
      issues.push({ scope: 'definitions', message: `write action '${def.kind}' declares no failureMode` });
    }
    if (effectiveFailureMode(def) === 'fail-safe' && !def.safeState) {
      issues.push({ scope: 'definitions', message: `action '${def.kind}' uses fail-safe without a safeState` });
    }
    for (const param of def.schema.parameters) {
      if (param.type !== 'quantity') continue;
      if (param.dimension === undefined || param.unit === undefined) {
        issues.push({ scope: 'definitions', message: `quantity '${def.kind}.${param.name}' is missing dimension/unit` });
      } else if (!units.has(param.unit)) {
        issues.push({ scope: 'definitions', message: `quantity '${def.kind}.${param.name}' unit '${param.unit}' is not registered` });
      }
    }
  }

  for (const recipe of profile.recipes ?? []) {
    try {
      validateRecipe(recipe);
    } catch (error) {
      issues.push({ scope: 'recipes', message: `recipe '${recipe.id}': ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  for (const capability of profile.capabilities ?? []) {
    if (!capability) issues.push({ scope: 'capabilities', message: 'empty capability string' });
  }

  return { profileId: profile.id, ok: issues.length === 0, issues };
}

export function assertProfileConformance(profile: IndustrialProfile): void {
  const report = runProfileConformance(profile);
  if (!report.ok) {
    throw new ActionDefinitionError(
      `profile '${profile.id}' failed conformance: ${report.issues.map((i) => i.message).join('; ')}`,
    );
  }
}

/** Materialize a profile's registries for a runtime. */
export function createProfileRegistries(profile: IndustrialProfile): {
  units: UnitRegistry;
  resources: ResourceRegistry;
  interlocks: InterlockRegistry;
} {
  const units = profile.units ?? createDefaultUnitRegistry();
  const resources = createResourceRegistry();
  for (const resource of profile.resources ?? []) resources.register(resource);
  const interlocks = createInterlockRegistry();
  for (const interlock of profile.interlocks ?? []) interlocks.register(interlock);
  return { units, resources, interlocks };
}

function effectiveFailureMode(def: IndustrialActionDefinition): string | undefined {
  return def.policy?.failureMode ?? (def.effect === 'read' ? 'fail-silent' : undefined);
}

// ─── Reference vertical profiles (data only; device I/O is supplied by the deployment) ──

export function waterProfile(): IndustrialProfile {
  return {
    id: 'water',
    version: 1,
    capabilities: ['industrial:action', 'industrial:read', 'transport:modbus', 'transport:opcua'],
    resources: [
      {
        id: { site: 'plant-1', area: 'pumping', asset: 'PUMP-01', point: 'speed' },
        kind: 'actuator',
        addresses: [
          { protocol: 'modbus', endpoint: 'holding:40010', unit: '%' },
          { protocol: 'opcua', endpoint: 'ns=2;s=PUMP01.Speed', unit: '%' },
        ],
      },
      {
        id: { site: 'plant-1', area: 'pumping', asset: 'TANK-01', point: 'level' },
        kind: 'sensor',
        addresses: [{ protocol: 'modbus', endpoint: 'input:30001', unit: 'm' }],
      },
    ],
    interlocks: [
      { id: 'pump-dry-run', kind: 'precondition', evaluate: () => ({ satisfied: true }) },
      { id: 'tank-overflow', kind: 'precondition', evaluate: () => ({ satisfied: true }) },
    ],
  };
}

export function hvacProfile(): IndustrialProfile {
  return {
    id: 'hvac',
    version: 1,
    capabilities: ['industrial:action', 'industrial:read', 'transport:modbus', 'transport:bacnet'],
    resources: [
      {
        id: { site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'setpoint' },
        kind: 'actuator',
        addresses: [
          { protocol: 'modbus', endpoint: 'holding:40001', unit: '°C' },
          { protocol: 'bacnet', endpoint: 'analogOutput,3,presentValue', unit: '°C' },
        ],
        safeState: { resourceId: { site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'setpoint' }, command: { setpoint: 20 } },
      },
      {
        id: { site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'supplyTemp' },
        kind: 'sensor',
        addresses: [{ protocol: 'modbus', endpoint: 'input:30005', unit: '°C' }],
      },
    ],
    interlocks: [
      { id: 'freezestat', kind: 'precondition', evaluate: () => ({ satisfied: true }), safeState: { resourceId: { site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'setpoint' }, command: { setpoint: 20 } } },
    ],
  };
}
