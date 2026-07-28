export type {
  EmailTransportPort,
  EmailMessage,
  EmailAttachment,
  SendOptions,
} from './transport.js'

export { createEmailGateway } from './gateway.js'
export type { EmailGatewayConfig, EmailGateway } from './gateway.js'

export { createEmailSensorBridge } from './sensor-bridge.js'
export type { EmailPollBinding, EmailSensorBridgeConfig, EmailSensorBridge } from './sensor-bridge.js'
