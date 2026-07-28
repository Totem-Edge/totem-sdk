import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge'
import type { EmailTransportPort, EmailMessage, SendOptions } from './transport.js'

export interface EmailGatewayConfig {
  runtime: EdgeRuntime
  transport: EmailTransportPort
  defaultMailbox?: string
  mailboxPollIntervalMs?: number
}

export interface EmailGateway {
  start(): Promise<void>
  stop(): Promise<void>
  readonly status: 'stopped' | 'running' | 'error'

  sendMail(options: SendOptions): Promise<EdgeOperationResult<{ messageId: string }>>
  searchMessages(options: {
    mailbox?: string
    query?: string
    since?: Date
    before?: Date
    from?: string
    subject?: string
    unreadOnly?: boolean
    limit?: number
  }): Promise<EdgeOperationResult<{ messages: EmailMessage[]; total: number }>>
  readMessage(mailbox: string, id: string): Promise<EdgeOperationResult<{ message: EmailMessage }>>
  moveMessage(mailbox: string, id: string, destination: string): Promise<EdgeOperationResult>
  deleteMessage(mailbox: string, id: string): Promise<EdgeOperationResult>
  markAsRead(mailbox: string, id: string): Promise<EdgeOperationResult>
  listMailboxes(): Promise<EdgeOperationResult<{ mailboxes: { name: string; path: string }[] }>>
}

export function createEmailGateway(config: EmailGatewayConfig): EmailGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped'
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let cleanup: (() => void)[] = []

  return {
    get status() {
      return status
    },

    async start(): Promise<void> {
      if (status === 'running') return
      try {
        await config.transport.connect()
        status = 'running'

        const unsubNew = config.transport.onNewMessage((mailbox, message) => {
          if (config.runtime.ports.proof) {
            config.runtime.ports.proof.createProof({
              subject: `email:${mailbox}:${message.messageId}`,
              claims: [
                { key: 'from', value: message.from.email },
                { key: 'subject', value: message.subject },
                { key: 'receivedAt', value: message.receivedAt.toISOString() },
              ],
            }).catch(() => {})
          }
        })
        cleanup.push(unsubNew)

        const unsubErr = config.transport.onError((err) => {
          status = 'error'
          console.error('[edge-email] transport error:', err)
        })
        cleanup.push(unsubErr)
      } catch (err) {
        status = 'error'
        throw err
      }
    },

    async stop(): Promise<void> {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      cleanup.forEach((fn) => fn())
      cleanup = []
      await config.transport.close()
      status = 'stopped'
    },

    async sendMail(options: SendOptions): Promise<EdgeOperationResult<{ messageId: string }>> {
      try {
        const result = await config.transport.sendMail(options)
        return { ok: true, data: result }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'SEND_FAILED' }
      }
    },

    async searchMessages(options): Promise<EdgeOperationResult<{ messages: EmailMessage[]; total: number }>> {
      try {
        const result = await config.transport.searchMessages({
          ...options,
          mailbox: options.mailbox ?? config.defaultMailbox,
        })
        return { ok: true, data: result }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'SEARCH_FAILED' }
      }
    },

    async readMessage(mailbox: string, id: string): Promise<EdgeOperationResult<{ message: EmailMessage }>> {
      try {
        const message = await config.transport.readMessage(mailbox, id)
        return { ok: true, data: { message } }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'READ_FAILED' }
      }
    },

    async moveMessage(mailbox: string, id: string, destination: string): Promise<EdgeOperationResult> {
      try {
        await config.transport.moveMessage(mailbox, id, destination)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'MOVE_FAILED' }
      }
    },

    async deleteMessage(mailbox: string, id: string): Promise<EdgeOperationResult> {
      try {
        await config.transport.deleteMessage(mailbox, id)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'DELETE_FAILED' }
      }
    },

    async markAsRead(mailbox: string, id: string): Promise<EdgeOperationResult> {
      try {
        await config.transport.markAsRead(mailbox, id)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'MARK_READ_FAILED' }
      }
    },

    async listMailboxes(): Promise<EdgeOperationResult<{ mailboxes: { name: string; path: string }[] }>> {
      try {
        const mailboxes = await config.transport.listMailboxes()
        return { ok: true, data: { mailboxes: mailboxes.map((m) => ({ name: m.name, path: m.path })) } }
      } catch (e) {
        return { ok: false, error: String(e), errorCode: 'LIST_FAILED' }
      }
    },
  }
}
