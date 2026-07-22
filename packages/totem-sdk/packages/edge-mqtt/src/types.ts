/**
 * Public types for @totemsdk/edge-mqtt.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { SignedManifest, EdgeServiceManifest } from '@totemsdk/manifest';
import type { TotemIdentityDocument } from '@totemsdk/identity';
import type { MqttClientPort, MqttMessage, MqttPublishOptions } from './client-port.js';

// ─── Transport metadata ────────────────────────────────────────────────────

export type MqttTransportKind =
  | 'broker'
  | 'websocket'
  | 'embedded'
  | 'hyperswarm'
  | 'pear'
  | 'mock'
  | 'custom';

export interface MqttTransportInfo {
  kind: MqttTransportKind;
  peerId?: string;
  topic?: string;
  brokerUrl?: string;
  swarmTopic?: string;
  metadata?: Record<string, unknown>;
}

// ─── Topics ───────────────────────────────────────────────────────────────

export interface MqttTopicSet {
  status: string;
  manifest: string;
  proofs: string;
  receipts: string;
  payments: string;
  commands: string;
  errors: string;
}

export interface MqttTopicMatch {
  matched: boolean;
  params?: Record<string, string>;
}

// ─── Rule engine ──────────────────────────────────────────────────────────

export type MqttRuleKind =
  | 'proof'
  | 'payment'
  | 'command'
  | 'receipt'
  | 'lookup'
  | 'realtime'
  | 'custom';

export interface MqttTopicRule {
  id: string;
  kind: MqttRuleKind;
  topicPattern: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MqttProofRule extends MqttTopicRule {
  kind: 'proof';
  subjectFromTopic?: boolean;
  sensorIdFromTopic?: boolean;
  proofKind?: string;
}

export interface MqttPaymentRule extends MqttTopicRule {
  kind: 'payment';
  price?: string;
  tokenId?: string;
  paymentRequired?: boolean;
}

export interface MqttCommandRule extends MqttTopicRule {
  kind: 'command';
  requiresPolicy?: boolean;
  allowedCommands?: string[];
}

export interface MqttRouteRule extends MqttTopicRule {
  outputTopic: string;
}

export interface MqttRouteDecision {
  rule: MqttTopicRule;
  message: MqttMessage;
  outputTopic?: string;
}

// ─── Rule engine object ───────────────────────────────────────────────────

export interface MqttRuleEngine {
  rules: MqttTopicRule[];
}

// ─── Gateway ──────────────────────────────────────────────────────────────

export interface MqttEdgeGatewayConfig {
  deviceId: string;
  client: MqttClientPort;
  runtime: EdgeRuntime;
  identity?: TotemIdentityDocument;
  manifest?: SignedManifest<EdgeServiceManifest>;
  rules?: MqttTopicRule[];
  topics?: Partial<MqttTopicSet>;
  queue?: MqttEdgeQueue;
  transport?: MqttTransportInfo;
  sensorBridge?: MqttSensorBridge;
  proofPublisher?: MqttProofPublisher;
  commandHandler?: MqttCommandHandler;
  metadata?: Record<string, unknown>;
}

export interface MqttGatewayStatus {
  deviceId: string;
  running: boolean;
  connectedAt?: number;
  stoppedAt?: number;
  transport?: MqttTransportInfo;
  metadata?: Record<string, unknown>;
}

export interface MqttEdgeGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): MqttGatewayStatus;
  publishStatus(): Promise<void>;
  publishManifest(): Promise<void>;
  handleMessage(message: MqttMessage): Promise<void>;
}

// ─── Sensor bridge ────────────────────────────────────────────────────────

export interface MqttSensorBinding {
  sensorId: string;
  inputTopic: string;
  proofTopic?: string;
  receiptTopic?: string;
  dataType?: string;
  subjectType?: string;
  metadata?: Record<string, unknown>;
}

export interface MqttSensorBridgeConfig {
  gateway: MqttEdgeGateway;
  bindings: MqttSensorBinding[];
  proofPublisher?: MqttProofPublisher;
  client?: MqttClientPort;
  /**
   * Queue that receives failed proof events instead of silently dropping them.
   * When set, any error thrown by proofPublisher.createProofFromMessage or
   * publishProof is caught and the raw message is enqueued for later retry
   * or inspection, rather than being lost.
   */
  deadLetterQueue?: MqttEdgeQueue;
}

export interface MqttSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  handleMessage(message: MqttMessage): Promise<void>;
  handleSensorMessage(binding: MqttSensorBinding, message: MqttMessage): Promise<void>;
}

// ─── Proof publisher ──────────────────────────────────────────────────────

export interface MqttProofOptions {
  proofKind?: string;
  subjectId?: string;
  subjectKind?: string;
  metadata?: Record<string, unknown>;
}

export interface MqttProofEnvelope {
  envelopeId: string;
  topic: string;
  message: MqttMessage;
  proof?: unknown;
  proofId?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface MqttProofPublisherConfig {
  runtime: EdgeRuntime;
  client: MqttClientPort;
  defaultProofTopic: string;
  defaultReceiptTopic?: string;
  proofMode?: 'edge-port' | 'proof-package';
  /** Issuer identity used in proof-package mode. Falls back to runtime.deviceId then 'unknown'. */
  issuer?: string;
  /** 32-byte WOTS seed for signing proofs in proof-package mode. */
  seed?: Uint8Array;
  /** WOTS key index for direct signing (used when no leaseProvider is given). */
  keyIndex?: number;
  /**
   * WOTS lease provider for coordinated key-index reservation.
   * When set, keyIndex is ignored and the index is reserved via the provider.
   */
  leaseProvider?: {
    reserveKeyUse(params: {
      treeId: string;
      ttlMs?: number;
      payloadHash?: string;
    }): Promise<{ reservationId: string; indices: { addressIndex: number; l1: number; l2: number } }>;
    commitKeyUse(reservationId: string, txId: string): Promise<void>;
    burnReservation(reservationId: string, reason: string): Promise<void>;
  };
  leaseTreeId?: string;
  metadata?: Record<string, unknown>;
}

export interface MqttProofPublisher {
  createProofFromMessage(message: MqttMessage, options?: MqttProofOptions): Promise<MqttProofEnvelope>;
  publishProof(envelope: MqttProofEnvelope, topic?: string): Promise<void>;
  publishProofReceipt(envelope: MqttProofEnvelope, topic?: string): Promise<void>;
}

// ─── Command handler ──────────────────────────────────────────────────────

export interface MqttCommand {
  commandId: string;
  command: string;
  payload?: unknown;
  requestedBy?: string;
  createdAt: number;
}

export interface SignedCommandEnvelope {
  commandId: string;
  command: string;
  payloadHash: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  issuerIdentity: string;
  signature: string;
}

export interface MqttCommandExecutor {
  execute(command: MqttCommand): Promise<EdgeOperationResult>;
}

export interface MqttCommandHandlerConfig {
  runtime: EdgeRuntime;
  client: MqttClientPort;
  commandTopic?: string;
  receiptTopic?: string;
  executor?: MqttCommandExecutor;
  metadata?: Record<string, unknown>;
  /** Maximum age of a command in milliseconds (default 60_000). */
  maxCommandAgeMs?: number;
  /** Function to verify a command signature. */
  verifyCommandSignature?: (envelope: SignedCommandEnvelope) => Promise<boolean>;
}

export interface MqttCommandHandler {
  handleCommand(message: MqttMessage): Promise<EdgeOperationResult>;
}

// ─── Usage meter ──────────────────────────────────────────────────────────

export type MqttUsageUnit =
  | 'message'
  | 'byte'
  | 'second'
  | 'minute'
  | 'kwh'
  | 'reading'
  | 'command'
  | 'custom';

export interface MqttUsageEvent {
  eventId: string;
  deviceId: string;
  unit: MqttUsageUnit;
  quantity: string;
  topic?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface MqttUsageMeterConfig {
  runtime: EdgeRuntime;
  deviceId: string;
  pricePerUnit?: string;
  tokenId?: string;
  unpaidLimit?: string;
  metadata?: Record<string, unknown>;
}

export interface MqttUsageMeter {
  recordUsage(event: MqttUsageEvent): Promise<EdgeOperationResult>;
  getUnpaidUsage(): string;
  resetUsage(): void;
  createUsageReceipt(event: MqttUsageEvent): import('@totemsdk/edge').EdgeReceipt;
  /**
   * Pay the accumulated unpaid usage to `recipient` via runtime.ports.payment.
   * Resets the usage counter on success. No-ops (ok:true) when usage is zero.
   * Returns ok:false when no payment port is configured.
   */
  settle(recipient: string): Promise<EdgeOperationResult<{ settled: string; txpowId?: string }>>;
}

// ─── Credit gate ──────────────────────────────────────────────────────────

export interface MqttCreditGateConfig {
  runtime: EdgeRuntime;
  deviceId: string;
  unpaidLimit?: string;
  shutdownTopic?: string;
  statusTopic?: string;
  mode?: 'block' | 'warn' | 'shutdown';
  client: MqttClientPort;
  /**
   * Optional hook to read accumulated unpaid usage from an external source
   * (e.g. a linked MqttUsageMeter). When provided, this overrides the gate's
   * internal usage counter. Useful when usage and credit are tracked separately.
   */
  getUsage?: () => string;
}

export interface MqttCreditDecision {
  allowed: boolean;
  reason?: string;
  unpaidUsage?: string;
}

export interface MqttCreditGate {
  /**
   * Record usage directly on the gate, accumulating toward the limit.
   * Call this when not using an external usage meter via config.getUsage.
   */
  recordUsage(quantity: string): void;
  getUnpaidUsage(): string;
  checkCredit(): Promise<MqttCreditDecision>;
  gatePublish(topic: string, payload: Uint8Array | string, options?: MqttPublishOptions): Promise<EdgeOperationResult>;
  publishShutdownNotice(reason: string): Promise<void>;
}

// ─── Offline queue ────────────────────────────────────────────────────────

export interface MqttQueuedEvent {
  id: string;
  type: 'message' | 'proof' | 'receipt' | 'error' | 'status';
  topic: string;
  payload: Uint8Array | string;
  createdAt: number;
  attempts: number;
  nextAttemptAt?: number;
  metadata?: Record<string, unknown>;
}

export interface MqttEdgeQueue {
  enqueue(event: MqttQueuedEvent): Promise<void>;
  dequeue(): Promise<MqttQueuedEvent | undefined>;
  peek(): Promise<MqttQueuedEvent | undefined>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

// ─── Realtime port ────────────────────────────────────────────────────────

export interface RealtimePort {
  publish(topic: string, payload: unknown): Promise<void>;
}

// Re-export dependencies types used in public API
export type { MqttClientPort, MqttMessage, MqttPublishOptions, MqttSubscribeOptions, MqttSubscription } from './client-port.js';
export type { EdgeRuntime, EdgeOperationResult, EdgeReceipt } from '@totemsdk/edge';
export type { SignedManifest } from '@totemsdk/manifest';
export type { TotemIdentityDocument } from '@totemsdk/identity';
