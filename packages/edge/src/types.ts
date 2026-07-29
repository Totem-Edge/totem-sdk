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
  /**
   * Execute an action through the runtime.
   *
   * If a policy port is configured, the action is first checked against it.
   * If the policy rejects the action, execution is blocked and the rejection
   * reason is returned.
   *
   * The action string determines which port handles execution:
   *   - 'payment:*'        → EdgePaymentPort.pay()
   *   - 'lookup:*'         → EdgeLookupPort.query() / announce()
   *   - 'proof:*'          → EdgeProofPort.createProof() / verifyProof()
   *
   * Unknown action strings return an error without attempting execution.
   */
  executeAction(params: EdgeActionParams): Promise<EdgeActionResult>;
}

export interface EdgeActionParams {
  action: string;
  subject: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface EdgeActionResult {
  ok: boolean;
  action: string;
  data?: unknown;
  policyResult?: { allowed: boolean; reason?: string };
  error?: string;
  errorCode?: string;
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
