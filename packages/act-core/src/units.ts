/**
 * RFC-011 §4.1 — quantities and units.
 *
 * Industrial parameters are typed quantities, not bare numbers, so unit errors
 * (a pressure satisfying a temperature guardrail) are impossible. A definition
 * declares a canonical `unit`; adapter profiles declare their wire units and the
 * core converts, recording both.
 */

export type Dimension =
  | 'temperature'
  | 'pressure'
  | 'volumetricFlow'
  | 'mass'
  | 'length'
  | 'ratio'
  | 'time'
  | 'speed'
  | 'dimensionless';

/** Unit symbol (a registry string, not a closed union — profiles add units). */
export type Unit = string;

export interface Quantity {
  value: number;
  unit: Unit;
}

interface UnitDefinition {
  dimension: Dimension;
  toCanonical: (value: number) => number;
  fromCanonical: (value: number) => number;
}

export interface UnitRegistry {
  register(unit: Unit, dimension: Dimension, toCanonical: (v: number) => number, fromCanonical: (v: number) => number): void;
  has(unit: Unit): boolean;
  dimensionOf(unit: Unit): Dimension | undefined;
  /** True when both units belong to the same dimension. */
  compatible(a: Unit, b: Unit): boolean;
  /** Convert a quantity to another unit of the same dimension. Throws otherwise. */
  convert(quantity: Quantity, to: Unit): Quantity;
  units(dimension?: Dimension): Unit[];
}

export function createUnitRegistry(): UnitRegistry {
  const units = new Map<Unit, UnitDefinition>();

  function requireDefinition(unit: Unit): UnitDefinition {
    const def = units.get(unit);
    if (!def) throw new Error(`unknown unit '${unit}'`);
    return def;
  }

  return {
    register(unit, dimension, toCanonical, fromCanonical) {
      units.set(unit, { dimension, toCanonical, fromCanonical });
    },
    has: (unit) => units.has(unit),
    dimensionOf: (unit) => units.get(unit)?.dimension,
    compatible(a, b) {
      const da = units.get(a);
      const db = units.get(b);
      return da !== undefined && db !== undefined && da.dimension === db.dimension;
    },
    convert(quantity, to) {
      const from = requireDefinition(quantity.unit);
      const target = requireDefinition(to);
      if (from.dimension !== target.dimension) {
        throw new Error(`incompatible units: ${quantity.unit} (${from.dimension}) → ${to} (${target.dimension})`);
      }
      return { value: target.fromCanonical(from.toCanonical(quantity.value)), unit: to };
    },
    units(dimension) {
      const all = [...units.entries()];
      return (dimension ? all.filter(([, d]) => d.dimension === dimension) : all).map(([u]) => u);
    },
  };
}

/** Registry seeded with common industrial units. */
export function createDefaultUnitRegistry(): UnitRegistry {
  const r = createUnitRegistry();

  // temperature (canonical °C)
  r.register('°C', 'temperature', (v) => v, (v) => v);
  r.register('K', 'temperature', (v) => v - 273.15, (v) => v + 273.15);
  r.register('°F', 'temperature', (v) => (v - 32) * (5 / 9), (v) => v * (9 / 5) + 32);

  // pressure (canonical bar)
  r.register('bar', 'pressure', (v) => v, (v) => v);
  r.register('kPa', 'pressure', (v) => v / 100, (v) => v * 100);
  r.register('psi', 'pressure', (v) => v * 0.0689476, (v) => v / 0.0689476);

  // volumetric flow (canonical m3/s)
  r.register('m3/s', 'volumetricFlow', (v) => v, (v) => v);
  r.register('m3/h', 'volumetricFlow', (v) => v / 3600, (v) => v * 3600);
  r.register('L/s', 'volumetricFlow', (v) => v / 1000, (v) => v * 1000);

  // mass (canonical kg)
  r.register('kg', 'mass', (v) => v, (v) => v);
  r.register('t', 'mass', (v) => v * 1000, (v) => v / 1000);

  // length (canonical mm)
  r.register('mm', 'length', (v) => v, (v) => v);
  r.register('m', 'length', (v) => v * 1000, (v) => v / 1000);

  // ratio (canonical %)
  r.register('%', 'ratio', (v) => v, (v) => v);
  r.register('ppm', 'ratio', (v) => v / 10000, (v) => v * 10000);

  // time (canonical ms)
  r.register('ms', 'time', (v) => v, (v) => v);
  r.register('s', 'time', (v) => v * 1000, (v) => v / 1000);
  r.register('min', 'time', (v) => v * 60_000, (v) => v / 60_000);

  // speed (canonical rpm)
  r.register('rpm', 'speed', (v) => v, (v) => v);
  r.register('rpm/s', 'speed', (v) => v * 60, (v) => v / 60);

  // dimensionless
  r.register('1', 'dimensionless', (v) => v, (v) => v);

  return r;
}

let _default: UnitRegistry | undefined;

/** Process-wide default registry (profiles may construct their own). */
export function defaultUnitRegistry(): UnitRegistry {
  return (_default ??= createDefaultUnitRegistry());
}

export function isQuantity(value: unknown): value is Quantity {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Quantity).value === 'number' &&
    typeof (value as Quantity).unit === 'string'
  );
}

/** Constraints for a quantity parameter (RFC-011 §4.1). */
export interface QuantityConstraint {
  dimension: Dimension;
  /** Canonical unit for the definition; bounds are compared in this unit. */
  unit: Unit;
  min?: Quantity;
  max?: Quantity;
  step?: Quantity;
}

/** Dimensional + range validation. Returns an error string, or null when valid. */
export function checkQuantity(
  value: unknown,
  constraint: QuantityConstraint,
  units: UnitRegistry = defaultUnitRegistry(),
): string | null {
  if (!isQuantity(value)) {
    return `expected quantity { value, unit }, got ${JSON.stringify(value)}`;
  }
  if (!units.has(value.unit)) {
    return `unknown unit '${value.unit}'`;
  }
  const actualDimension = units.dimensionOf(value.unit);
  if (actualDimension !== constraint.dimension) {
    return `expected ${constraint.dimension}, got ${actualDimension} (${value.unit})`;
  }
  const canonical = units.convert(value, constraint.unit).value;

  if (constraint.min) {
    const min = units.convert(constraint.min, constraint.unit).value;
    if (canonical < min) return `${canonical}${constraint.unit} is below minimum ${min}${constraint.unit}`;
  }
  if (constraint.max) {
    const max = units.convert(constraint.max, constraint.unit).value;
    if (canonical > max) return `${canonical}${constraint.unit} is above maximum ${max}${constraint.unit}`;
  }
  return null;
}
