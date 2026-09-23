/**
 * RFC-011 §4.2 — resources, assets, and protocol-neutral addresses.
 *
 * Industrial actions target resources, not strings. The `ResourceId` models an
 * ISA-95-style hierarchy (`site/area/asset/point`); a resource carries one or
 * more protocol bindings (Modbus/OPC-UA/BACnet/Sparkplug) so the same action
 * can be prepared for different field protocols.
 */

import { type Unit, type Quantity, type UnitRegistry, defaultUnitRegistry } from './units.js';

export interface ResourceId {
  site: string;
  area?: string;
  asset: string;
  point?: string;
}

export type ResourceKind = 'sensor' | 'actuator' | 'controller' | 'gateway' | 'system';

/** Protocol binding identifier (open string; profiles add protocols). */
export type ResourceProtocol = 'modbus' | 'opcua' | 'bacnet' | 'mqtt-sparkplug' | string;

export interface ResourceAddress {
  protocol: ResourceProtocol;
  /** Protocol-specific endpoint: unit/register, nodeId, object instance, topic. */
  endpoint: string;
  /** Wire unit at this address (adapter converts from the definition's unit). */
  unit?: Unit;
}

export interface Resource {
  id: ResourceId;
  kind: ResourceKind;
  addresses: ResourceAddress[];
  metadata?: Record<string, unknown>;
}

/** Stable string key for a `ResourceId` (used for operation ids and logs). */
export function resourceIdKey(id: ResourceId): string {
  return [id.site, id.area ?? '', id.asset, id.point ?? ''].join('/');
}

/**
 * Convert a definition's canonical quantity to a resource address's wire unit
 * (RFC-011 §4.1/§4.2). Returns the quantity unchanged when the address declares
 * no unit.
 */
export function toWireQuantity(
  quantity: Quantity,
  address: ResourceAddress,
  units: UnitRegistry = defaultUnitRegistry(),
): Quantity {
  if (address.unit === undefined || address.unit === quantity.unit) return quantity;
  return units.convert(quantity, address.unit);
}

export interface ResourceRegistry {
  register(resource: Resource): void;
  get(id: ResourceId): Resource | undefined;
  /** Resolve the best address for a protocol (or the first when unspecified). */
  resolveAddress(id: ResourceId, protocol?: ResourceProtocol): ResourceAddress | undefined;
  list(): Resource[];
}

export function createResourceRegistry(): ResourceRegistry {
  const resources = new Map<string, Resource>();

  return {
    register(resource) {
      const key = resourceIdKey(resource.id);
      if (resources.has(key)) {
        throw new Error(`resource '${key}' is already registered`);
      }
      resources.set(key, resource);
    },
    get: (id) => resources.get(resourceIdKey(id)),
    resolveAddress(id, protocol) {
      const resource = resources.get(resourceIdKey(id));
      if (!resource) return undefined;
      if (protocol === undefined) return resource.addresses[0];
      return resource.addresses.find((a) => a.protocol === protocol);
    },
    list: () => [...resources.values()],
  };
}
