/**
 * Manifest helpers for @totemsdk/edge-mqtt.
 *
 * createMqttEdgeServiceManifest builds an unsigned EdgeServiceManifest.
 * The caller signs it when needed (requires seed + keyIndex).
 * publishMqttManifest serialises any manifest-shaped object to JSON and publishes.
 */

import type { EdgeServiceManifest } from '@totemsdk/manifest';
import type { MqttClientPort } from './client-port.js';

export type MqttServiceType =
  | 'sensor'
  | 'mqtt-feed'
  | 'machine-service'
  | 'verifier'
  | 'other';

export interface MqttEdgeServiceManifestInput {
  serviceId: string;
  name: string;
  description?: string;
  version?: string;
  serviceType?: MqttServiceType;
  operatorAddress: string;
  tags?: string[];
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export function createMqttEdgeServiceManifest(
  input: MqttEdgeServiceManifestInput
): EdgeServiceManifest {
  return {
    type: 'edge-service',
    serviceId: input.serviceId,
    name: input.name,
    version: input.version ?? '0.1.0',
    description: input.description ?? '',
    serviceType: (input.serviceType ?? 'mqtt-feed') as EdgeServiceManifest['serviceType'],
    operatorAddress: input.operatorAddress,
    tags: input.tags ?? ['mqtt', 'totem-edge'],
    capabilities: input.capabilities ?? [],
  };
}

export async function publishMqttManifest(
  client: MqttClientPort,
  manifest: Record<string, unknown> | EdgeServiceManifest,
  topic: string
): Promise<void> {
  await client.publish(topic, JSON.stringify(manifest));
}
