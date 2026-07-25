import type { EdgeRuntime } from '@totemsdk/edge'
import type { EmailTransportPort, EmailMessage } from './transport.js'

export interface EmailPollBinding {
  sensorId: string
  mailbox: string
  query?: string
  from?: string
  subject?: string
  intervalMs: number
}

export interface EmailSensorBridgeConfig {
  runtime: EdgeRuntime
  transport: EmailTransportPort
  bindings: EmailPollBinding[]
}

export interface EmailSensorBridge {
  start(): Promise<void>
  stop(): Promise<void>
  pollOnce(): Promise<void>
}

export function createEmailSensorBridge(config: EmailSensorBridgeConfig): EmailSensorBridge {
  let timers: ReturnType<typeof setInterval>[] = []
  let running = false

  async function pollBinding(binding: EmailPollBinding): Promise<void> {
    try {
      const result = await config.transport.searchMessages({
        mailbox: binding.mailbox,
        query: binding.query,
        from: binding.from,
        subject: binding.subject,
        unreadOnly: true,
      })
      for (const msg of result.messages) {
        if (config.runtime.ports.proof) {
          await config.runtime.ports.proof.createProof({
            subject: `email:sensor:${binding.sensorId}`,
            claims: [
              { key: 'messageId', value: msg.messageId },
              { key: 'from', value: msg.from.email },
              { key: 'subject', value: msg.subject },
              { key: 'bodyPreview', value: msg.bodyText.slice(0, 200) },
              { key: 'receivedAt', value: msg.receivedAt.toISOString() },
            ],
          }).catch(() => {})
        }
        await config.transport.markAsRead(binding.mailbox, msg.id)
      }
    } catch {
      // non-fatal
    }
  }

  return {
    async start(): Promise<void> {
      if (running) return
      running = true
      for (const binding of config.bindings) {
        pollBinding(binding)
        const timer = setInterval(() => pollBinding(binding), binding.intervalMs)
        timers.push(timer)
      }
    },

    async stop(): Promise<void> {
      running = false
      timers.forEach((t) => clearInterval(t))
      timers = []
    },

    async pollOnce(): Promise<void> {
      await Promise.allSettled(config.bindings.map((b) => pollBinding(b)))
    },
  }
}
