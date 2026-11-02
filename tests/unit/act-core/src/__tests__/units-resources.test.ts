/**
 * RFC-011 Phase A — units/quantities and resources.
 */

import {
  createUnitRegistry,
  createDefaultUnitRegistry,
  defaultUnitRegistry,
  isQuantity,
  checkQuantity,
} from '../units.js';
import { createResourceRegistry, resourceIdKey, toWireQuantity, type Resource } from '../resources.js';
import { validateParameters, assertValidParameters } from '../definition.js';
import { ActionValidationError } from '../errors.js';
import type { ActionSchema } from '../types.js';

describe('UnitRegistry (RFC-011 §4.1)', () => {
  const units = createDefaultUnitRegistry();

  it('converts within a dimension', () => {
    expect(units.convert({ value: 0, unit: '°C' }, 'K').value).toBeCloseTo(273.15);
    expect(units.convert({ value: 212, unit: '°F' }, '°C').value).toBeCloseTo(100);
    expect(units.convert({ value: 1, unit: 'bar' }, 'kPa').value).toBeCloseTo(100);
    expect(units.convert({ value: 1, unit: 'm3/h' }, 'm3/s').value).toBeCloseTo(1 / 3600);
  });

  it('reports dimension compatibility', () => {
    expect(units.compatible('°C', 'K')).toBe(true);
    expect(units.compatible('°C', 'bar')).toBe(false);
    expect(units.dimensionOf('bar')).toBe('pressure');
  });

  it('throws on cross-dimension conversion', () => {
    expect(() => units.convert({ value: 1, unit: 'bar' }, '°C')).toThrow(/incompatible/);
  });

  it('supports profile-registered units', () => {
    const custom = createUnitRegistry();
    custom.register('widgets', 'dimensionless', (v) => v, (v) => v);
    expect(custom.has('widgets')).toBe(true);
    expect(custom.convert({ value: 3, unit: 'widgets' }, 'widgets').value).toBe(3);
  });
});

describe('checkQuantity (RFC-011 §4.1)', () => {
  const units = defaultUnitRegistry();

  it('accepts a valid quantity and rejects malformed values', () => {
    expect(checkQuantity({ value: 22.5, unit: '°C' }, { dimension: 'temperature', unit: '°C' }, units)).toBeNull();
    expect(checkQuantity(22.5, { dimension: 'temperature', unit: '°C' }, units)).toMatch(/expected quantity/);
    expect(isQuantity({ value: 1, unit: '°C' })).toBe(true);
  });

  it('rejects a wrong dimension', () => {
    expect(
      checkQuantity({ value: 2, unit: 'bar' }, { dimension: 'temperature', unit: '°C' }, units),
    ).toMatch(/expected temperature, got pressure/);
  });

  it('enforces min/max in the canonical unit', () => {
    const constraint = { dimension: 'temperature' as const, unit: '°C', min: { value: 10, unit: '°C' }, max: { value: 35, unit: '°C' } };
    expect(checkQuantity({ value: 5, unit: '°C' }, constraint, units)).toMatch(/below minimum/);
    expect(checkQuantity({ value: 400, unit: 'K' }, constraint, units)).toMatch(/above maximum/);
    expect(checkQuantity({ value: 22, unit: '°C' }, constraint, units)).toBeNull();
  });
});

describe('ResourceRegistry (RFC-011 §4.2)', () => {
  const setpoint: Resource = {
    id: { site: 'plant-1', area: 'hvac', asset: 'AHU-03', point: 'setpoint' },
    kind: 'actuator',
    addresses: [
      { protocol: 'modbus', endpoint: 'holding:40001', unit: '°C' },
      { protocol: 'opcua', endpoint: 'ns=2;s=AHU03.Setpoint', unit: '°C' },
    ],
  };

  it('keys and resolves resources', () => {
    expect(resourceIdKey(setpoint.id)).toBe('plant-1/hvac/AHU-03/setpoint');
    const registry = createResourceRegistry();
    registry.register(setpoint);
    expect(registry.get(setpoint.id)?.kind).toBe('actuator');
    expect(registry.resolveAddress(setpoint.id, 'opcua')?.endpoint).toBe('ns=2;s=AHU03.Setpoint');
    expect(registry.resolveAddress(setpoint.id)?.protocol).toBe('modbus');
    expect(registry.resolveAddress({ site: 'nope', asset: 'x' })).toBeUndefined();
  });

  it('rejects duplicate registration', () => {
    const registry = createResourceRegistry();
    registry.register(setpoint);
    expect(() => registry.register(setpoint)).toThrow(/already registered/);
  });

  it('converts a canonical quantity to the address wire unit', () => {
    const address = { protocol: 'modbus', endpoint: 'holding:40001', unit: 'K' };
    expect(toWireQuantity({ value: 0, unit: '°C' }, address).value).toBeCloseTo(273.15);
    expect(toWireQuantity({ value: 22, unit: '°C' }, { protocol: 'modbus', endpoint: 'x' })).toEqual({
      value: 22,
      unit: '°C',
    });
  });
});

describe('quantity parameters in a schema (RFC-011 §4.1/§4.2)', () => {
  const schema: ActionSchema = {
    parameters: [
      {
        name: 'setpoint',
        type: 'quantity',
        required: true,
        dimension: 'temperature',
        unit: '°C',
        min: { value: 10, unit: '°C' },
        max: { value: 35, unit: '°C' },
      },
    ],
    context: [{ name: 'zoneId', type: 'string', required: true }],
  };

  it('accepts an in-range quantity supplied in another unit', () => {
    expect(validateParameters(schema, { setpoint: { value: 300, unit: 'K' } })).toHaveLength(0);
  });

  it('rejects a wrong dimension and an out-of-range value', () => {
    expect(validateParameters(schema, { setpoint: { value: 2, unit: 'bar' } })[0]).toMatch(/expected temperature/);
    expect(validateParameters(schema, { setpoint: { value: 100, unit: '°C' } })[0]).toMatch(/above maximum/);
  });

  it('assertValidParameters throws on a bad quantity', () => {
    expect(() => assertValidParameters(schema, { setpoint: { value: 1, unit: '°C' } })).toThrow(
      ActionValidationError,
    );
  });
});
