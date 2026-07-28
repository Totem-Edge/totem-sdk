/**
 * MqttClientPort — transport-agnostic MQTT port interface.
 *
 * This package does NOT import mqtt.js, net, tls, ws, http, fs, or browser APIs.
 * All network behavior is injected via MqttClientPort.
 */

export interface MqttMessage {
  topic: string;
  payload: Uint8Array | string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  receivedAt: number;
  properties?: Record<string, unknown>;
}

export interface MqttPublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
  properties?: Record<string, unknown>;
}

export interface MqttSubscribeOptions {
  qos?: 0 | 1 | 2;
}

export interface MqttSubscription {
  topic: string;
  unsubscribe(): Promise<void>;
}

export interface MqttClientPort {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  subscribe(topic: string, options?: MqttSubscribeOptions): Promise<MqttSubscription>;
  unsubscribe?(topic: string): Promise<void>;
  publish(topic: string, payload: Uint8Array | string, options?: MqttPublishOptions): Promise<void>;
  onMessage(handler: (message: MqttMessage) => void | Promise<void>): () => void;
}
