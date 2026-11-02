/**
 * RFC-011 §4.10 — standards mapping adapters.
 *
 * Pure codecs translating between the vertical-neutral core model and the field
 * standards (ISA-95 hierarchy, Modbus register addressing, OPC-UA node ids,
 * Sparkplug B topics, BACnet object addresses). Mappings live here, never in
 * core types.
 */

import type { ResourceId, ResourceAddress } from './resources.js';

// ─── ISA-95 ──────────────────────────────────────────────────────────────────

export function toIsa95Path(id: ResourceId): string {
  return [id.site, id.area, id.asset, id.point]
    .filter((part): part is string => part !== undefined && part !== '')
    .join('/');
}

/**
 * ISA-95 hierarchy path `site[/area]/asset[/point]`:
 *   2 parts → site/asset; 3 parts → site/area/asset; 4 parts → +point.
 */
export function parseIsa95Path(path: string): ResourceId {
  const parts = path.split('/').filter((p) => p !== '');
  if (parts.length < 2 || parts.length > 4) {
    throw new Error(`invalid ISA-95 path '${path}'`);
  }
  const [site, second, third, fourth] = parts;
  if (parts.length === 2) return { site: site!, asset: second! };
  if (parts.length === 3) return { site: site!, area: second!, asset: third! };
  return { site: site!, area: second!, asset: third!, point: fourth! };
}

// ─── Modbus ──────────────────────────────────────────────────────────────────

export type ModbusRegisterType = 'coil' | 'discrete' | 'input' | 'holding';

export interface ModbusRegister {
  registerType: ModbusRegisterType;
  address: number;
}

export function formatModbusEndpoint(register: ModbusRegister): string {
  return `${register.registerType}:${register.address}`;
}

export function parseModbusEndpoint(endpoint: string): ModbusRegister {
  const [type, addr] = endpoint.split(':');
  const address = Number(addr);
  if (!type || Number.isNaN(address)) throw new Error(`invalid Modbus endpoint '${endpoint}'`);
  return { registerType: type as ModbusRegisterType, address };
}

// ─── OPC-UA ──────────────────────────────────────────────────────────────────

export type OpcuaIdentifierType = 'i' | 's' | 'g' | 'b';

export interface OpcuaNodeId {
  namespace: number;
  identifierType: OpcuaIdentifierType;
  identifier: string;
}

export function formatOpcuaNodeId(node: OpcuaNodeId): string {
  return `ns=${node.namespace};${node.identifierType}=${node.identifier}`;
}

export function parseOpcuaNodeId(nodeId: string): OpcuaNodeId {
  const match = /^ns=(\d+);([isgb])=(.+)$/.exec(nodeId);
  if (!match) throw new Error(`invalid OPC-UA node id '${nodeId}'`);
  return { namespace: Number(match[1]), identifierType: match[2] as OpcuaIdentifierType, identifier: match[3]! };
}

// ─── Sparkplug B (MQTT UNS) ──────────────────────────────────────────────────

export type SparkplugMessageType = 'NBIRTH' | 'NDEATH' | 'NDATA' | 'NCMD' | 'DBIRTH' | 'DDEATH' | 'DDATA' | 'DCMD';

export interface SparkplugTopic {
  groupId: string;
  messageType: SparkplugMessageType;
  edgeNodeId: string;
  deviceId?: string;
  metric?: string;
}

export function formatSparkplugTopic(topic: SparkplugTopic): string {
  const parts = ['spBv1.0', topic.groupId, topic.messageType, topic.edgeNodeId];
  if (topic.deviceId !== undefined) parts.push(topic.deviceId);
  if (topic.metric !== undefined) parts.push(topic.metric);
  return parts.join('/');
}

export function parseSparkplugTopic(topic: string): SparkplugTopic {
  const [version, groupId, messageType, edgeNodeId, deviceId, metric] = topic.split('/');
  if (version !== 'spBv1.0' || !groupId || !messageType || !edgeNodeId) {
    throw new Error(`invalid Sparkplug topic '${topic}'`);
  }
  return {
    groupId,
    messageType: messageType as SparkplugMessageType,
    edgeNodeId,
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(metric !== undefined ? { metric } : {}),
  };
}

// ─── BACnet ──────────────────────────────────────────────────────────────────

export interface BacnetAddress {
  objectType: string;
  instance: number;
  property?: string;
}

export function formatBacnetAddress(address: BacnetAddress): string {
  const base = `${address.objectType},${address.instance}`;
  return address.property !== undefined ? `${base},${address.property}` : base;
}

export function parseBacnetAddress(address: string): BacnetAddress {
  const [objectType, instanceText, property] = address.split(',');
  const instance = Number(instanceText);
  if (!objectType || Number.isNaN(instance)) throw new Error(`invalid BACnet address '${address}'`);
  return { objectType, instance, ...(property !== undefined ? { property } : {}) };
}

// ─── Resource-address helpers ────────────────────────────────────────────────

/** Build a protocol-bound resource address from an ISA-95 id + standard codec. */
export function resourceAddressFor(
  protocol: ResourceAddress['protocol'],
  endpoint: string,
  unit?: string,
): ResourceAddress {
  return { protocol, endpoint, ...(unit !== undefined ? { unit } : {}) };
}
