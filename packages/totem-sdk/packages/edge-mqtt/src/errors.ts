/**
 * Typed error classes for @totemsdk/edge-mqtt.
 *
 * Public methods prefer EdgeOperationResult where practical.
 * These errors are thrown only for programmer/configuration mistakes.
 */

export class MqttEdgeError extends Error {
  readonly code: string;
  constructor(message: string, code = 'MQTT_EDGE_ERROR') {
    super(message);
    this.name = 'MqttEdgeError';
    this.code = code;
  }
}

export class MqttClientUnavailableError extends MqttEdgeError {
  constructor(message = 'MQTT client is not available') {
    super(message, 'MQTT_CLIENT_UNAVAILABLE');
    this.name = 'MqttClientUnavailableError';
  }
}

export class MqttPolicyRejectedError extends MqttEdgeError {
  constructor(message = 'Command rejected by policy') {
    super(message, 'MQTT_POLICY_REJECTED');
    this.name = 'MqttPolicyRejectedError';
  }
}

export class MqttPaymentRequiredError extends MqttEdgeError {
  constructor(message = 'Payment required to process this message') {
    super(message, 'MQTT_PAYMENT_REQUIRED');
    this.name = 'MqttPaymentRequiredError';
  }
}

export class MqttCreditExceededError extends MqttEdgeError {
  constructor(message = 'Unpaid credit limit exceeded') {
    super(message, 'MQTT_CREDIT_EXCEEDED');
    this.name = 'MqttCreditExceededError';
  }
}

export class MqttProofCreationError extends MqttEdgeError {
  constructor(message = 'Failed to create proof from MQTT message') {
    super(message, 'MQTT_PROOF_CREATION_ERROR');
    this.name = 'MqttProofCreationError';
  }
}

export class MqttQueueError extends MqttEdgeError {
  constructor(message = 'MQTT queue operation failed') {
    super(message, 'MQTT_QUEUE_ERROR');
    this.name = 'MqttQueueError';
  }
}
