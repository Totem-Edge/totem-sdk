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
  /**
   * WOTS lease provider for coordinated key-index reservation.
   * Required when a seed is supplied in proof-package mode. The provider must
   * reserve indices durably and exclusively across publishers and restarts.
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

/**
 * Atomic durable replay claims. Plain StorageAdapter get/set is insufficient.
 * All handlers for a device must share the same store and validity settings.
 */
export interface ReplayLedgerStore {
  /**
   * Atomically insert a claim only when no claim exists or its expiresAt < now.
   * Return true only after the new claim is durable; false means duplicate.
   * Entries must remain present through expiresAt (inclusive). This operation
   * must be exclusive across every process using the store. On uncertainty,
   * throw; never return true for a claim whose persistence is unknown.
   */
  claim(key: string, expiresAt: number, now: number): Promise<boolean>;
}

export interface MqttCommandHandlerConfig {
  runtime: EdgeRuntime;
  client: MqttClientPort;
  commandTopic?: string;
  receiptTopic?: string;
  executor?: MqttCommandExecutor;
  metadata?: Record<string, unknown>;
  /** Positive safe-integer maximum age/lifetime in ms (default 60_000). No future timestamps are accepted. */
  maxCommandAgeMs?: number;
  /**
   * Atomic durable store for device/verified-issuer/command claims. When provided,
   * claims survive handler restarts (RFC-007 G4). Without it replay protection
   * is limited to a single handler's lifetime; it is not a durable profile.
   */
  replayStore?: ReplayLedgerStore;
  /** Function to verify a command signature. */
  verifyCommandSignature?: (envelope: SignedCommandEnvelope) => Promise<boolean>;
  /**
   * Require every command to carry a well-formed signed envelope (default true).
   * When true, unsigned or malformed-envelope messages are rejected with
   * MQTT_POLICY_REJECTED before any policy/executor work. Set to false only to
   * restore the legacy unsigned-command mode on private/trusted networks.
   */
  requireSignedCommands?: boolean;
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

export interface MqttQueueReleaseOptions {
  /** Attempt counter to persist with the returned event. */
  attempts?: number;
  /** Earliest time (ms epoch) at which the event may be claimed again. */
  nextAttemptAt?: number;
}

/**
 * Claim/ack/retry queue contract (RFC-007 G4).
 *
 * `dequeue()` claims an event; the event is only forgotten after `ack()`.
 * `release()` returns a claimed event to pending for retry, and `deadLetter()`
 * removes a claimed event from the active queue while durably recording it.
 * A crash between `dequeue()` and `ack()` leaves the claim durable, so
 * `recoverInFlight()` on startup re-delivers rather than loses.
 */
export interface MqttEdgeQueue {
  enqueue(event: MqttQueuedEvent): Promise<void>;
  dequeue(): Promise<MqttQueuedEvent | undefined>;
  peek(): Promise<MqttQueuedEvent | undefined>;
  size(): Promise<number>;
  clear(): Promise<void>;
  /** Durable acknowledgment — forget the event after it has been published. */
  ack?(id: string): Promise<void>;
  /** Return a claimed event to pending for a later retry attempt. */
  release?(id: string, options?: MqttQueueReleaseOptions): Promise<void>;
  /** Move a claimed event into the durable dead-letter set (never re-delivered). */
  deadLetter?(id: string, reason?: string): Promise<void>;
  /**
   * Reset any in-flight (claimed-but-unacked) events back to pending so they
   * re-deliver after a crash. Returns the number recovered.
   */
  recoverInFlight?(maxAgeMs?: number): Promise<number>;
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
