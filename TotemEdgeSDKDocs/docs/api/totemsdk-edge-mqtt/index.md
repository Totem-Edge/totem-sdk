**@totemsdk/edge-mqtt**

***

# @totemsdk/edge-mqtt

## Classes

- [MqttClientUnavailableError](classes/MqttClientUnavailableError.md)
- [MqttCreditExceededError](classes/MqttCreditExceededError.md)
- [MqttEdgeError](classes/MqttEdgeError.md)
- [MqttPaymentRequiredError](classes/MqttPaymentRequiredError.md)
- [MqttPolicyRejectedError](classes/MqttPolicyRejectedError.md)
- [MqttProofCreationError](classes/MqttProofCreationError.md)
- [MqttQueueError](classes/MqttQueueError.md)

## Interfaces

- [MqttClientPort](interfaces/MqttClientPort.md)
- [MqttCommand](interfaces/MqttCommand.md)
- [MqttCommandExecutor](interfaces/MqttCommandExecutor.md)
- [MqttCommandHandler](interfaces/MqttCommandHandler.md)
- [MqttCommandHandlerConfig](interfaces/MqttCommandHandlerConfig.md)
- [MqttCommandRule](interfaces/MqttCommandRule.md)
- [MqttCreditDecision](interfaces/MqttCreditDecision.md)
- [MqttCreditGate](interfaces/MqttCreditGate.md)
- [MqttCreditGateConfig](interfaces/MqttCreditGateConfig.md)
- [MqttEdgeGateway](interfaces/MqttEdgeGateway.md)
- [MqttEdgeGatewayConfig](interfaces/MqttEdgeGatewayConfig.md)
- [MqttEdgeQueue](interfaces/MqttEdgeQueue.md)
- [MqttEdgeServiceManifestInput](interfaces/MqttEdgeServiceManifestInput.md)
- [MqttGatewayStatus](interfaces/MqttGatewayStatus.md)
- [MqttMessage](interfaces/MqttMessage.md)
- [MqttPaymentRule](interfaces/MqttPaymentRule.md)
- [MqttProofEnvelope](interfaces/MqttProofEnvelope.md)
- [MqttProofOptions](interfaces/MqttProofOptions.md)
- [MqttProofPublisher](interfaces/MqttProofPublisher.md)
- [MqttProofPublisherConfig](interfaces/MqttProofPublisherConfig.md)
- [MqttProofRule](interfaces/MqttProofRule.md)
- [MqttPublishOptions](interfaces/MqttPublishOptions.md)
- [MqttQueuedEvent](interfaces/MqttQueuedEvent.md)
- [MqttReceiptInput](interfaces/MqttReceiptInput.md)
- [MqttRouteDecision](interfaces/MqttRouteDecision.md)
- [MqttRouteRule](interfaces/MqttRouteRule.md)
- [MqttRuleEngine](interfaces/MqttRuleEngine.md)
- [MqttSensorBinding](interfaces/MqttSensorBinding.md)
- [MqttSensorBridge](interfaces/MqttSensorBridge.md)
- [MqttSensorBridgeConfig](interfaces/MqttSensorBridgeConfig.md)
- [MqttSubscribeOptions](interfaces/MqttSubscribeOptions.md)
- [MqttSubscription](interfaces/MqttSubscription.md)
- [MqttTopicMatch](interfaces/MqttTopicMatch.md)
- [MqttTopicRule](interfaces/MqttTopicRule.md)
- [MqttTopicSet](interfaces/MqttTopicSet.md)
- [MqttTransportInfo](interfaces/MqttTransportInfo.md)
- [MqttUsageEvent](interfaces/MqttUsageEvent.md)
- [MqttUsageMeter](interfaces/MqttUsageMeter.md)
- [MqttUsageMeterConfig](interfaces/MqttUsageMeterConfig.md)
- [RealtimePort](interfaces/RealtimePort.md)

## Type Aliases

- [MqttRuleKind](type-aliases/MqttRuleKind.md)
- [MqttServiceType](type-aliases/MqttServiceType.md)
- [MqttTransportKind](type-aliases/MqttTransportKind.md)
- [MqttUsageUnit](type-aliases/MqttUsageUnit.md)

## Variables

- [createDefaultMqttTopics](variables/createDefaultMqttTopics.md)
- [createSensorTopic](variables/createSensorTopic.md)
- [matchMqttTopic](variables/matchMqttTopic.md)
- [toHex](variables/toHex.md)

## Functions

- [announceMqttService](functions/announceMqttService.md)
- [announceToAll](functions/announceToAll.md)
- [canonicalJson](functions/canonicalJson.md)
- [computeMqttEventId](functions/computeMqttEventId.md)
- [createDeadLetterEvent](functions/createDeadLetterEvent.md)
- [createEdgeReceipt](functions/createEdgeReceipt.md)
- [createEdgeRuntime](functions/createEdgeRuntime.md)
- [createMemoryMqttEdgeQueue](functions/createMemoryMqttEdgeQueue.md)
- [createMqttCommandHandler](functions/createMqttCommandHandler.md)
- [createMqttCreditGate](functions/createMqttCreditGate.md)
- [createMqttEdgeGateway](functions/createMqttEdgeGateway.md)
- [createMqttEdgeServiceManifest](functions/createMqttEdgeServiceManifest.md)
- [createMqttProofPublisher](functions/createMqttProofPublisher.md)
- [createMqttReceipt](functions/createMqttReceipt.md)
- [createMqttRuleEngine](functions/createMqttRuleEngine.md)
- [createMqttSensorBridge](functions/createMqttSensorBridge.md)
- [createMqttUsageMeter](functions/createMqttUsageMeter.md)
- [decodeMqttEdgeMessage](functions/decodeMqttEdgeMessage.md)
- [encodeMqttEdgeMessage](functions/encodeMqttEdgeMessage.md)
- [findMatchingRules](functions/findMatchingRules.md)
- [flushQueuedEvents](functions/flushQueuedEvents.md)
- [mirrorMqttToRealtime](functions/mirrorMqttToRealtime.md)
- [publishMqttManifest](functions/publishMqttManifest.md)
- [publishMqttReceipt](functions/publishMqttReceipt.md)
- [routeMqttMessage](functions/routeMqttMessage.md)
- [verifyEdgeReceipt](functions/verifyEdgeReceipt.md)
