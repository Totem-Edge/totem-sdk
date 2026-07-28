/**
 * @totemsdk/edge — Type definitions
 *
 * Covers devices, apps, agents, sensors, robots, gateways, and services.
 * Adapter-neutral — no ROS2, no MQTT, no Python bindings.
 */

import type { ManifestIdentityBinding } from '@totemsdk/identity';
import type { SignedManifest, EdgeServiceManifest } from '@totemsdk/manifest';

export type EdgeDeviceKind =
  | 'device'
  | 'app'
  | 'agent'
  | 'sensor'
  | 'robot'
  | 'gateway'
  | 'service';

export interface EdgeOperationResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface EdgeDevice {
  deviceId: string;
  kind: EdgeDeviceKind;
  identityId?: string;
  address?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface EdgeRuntime {
  version: number;
  deviceId: string;
  capabilities: import('./capabilities.js').EdgeCapabilitySet;
  ports: import('./ports.js').EdgeRuntimePorts;
  hasCapability(cap: import('./capabilities.js').EdgeCapability): boolean;
  assertCapability(cap: import('./capabilities.js').EdgeCapability): void;
}

export interface EdgeProviderProfile {
  profileId: string;
  operatorAddress: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: number;
}

export interface EdgeServiceRegistration {
  registrationId: string;
  profileId: string;
  serviceId: string;
  operatorAddress: string;
  registeredAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface EdgeReceipt {
  receiptId: string;
  kind: string;
  issuedAt: number;
  relatedManifestId?: string;
  relatedIdentityId?: string;
  payload: Record<string, unknown>;
}

export type { ManifestIdentityBinding, SignedManifest, EdgeServiceManifest };
