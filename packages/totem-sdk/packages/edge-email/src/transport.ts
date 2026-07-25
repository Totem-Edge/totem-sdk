export interface EmailMessage {
  id: string
  messageId: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  subject: string
  bodyText: string
  bodyHtml?: string
  receivedAt: Date
  flags: string[]
  attachments: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  mimeType: string
  size: number
  content: Uint8Array
}

export interface SendOptions {
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  bcc?: { name: string; email: string }[]
  subject: string
  bodyText: string
  bodyHtml?: string
  attachments?: { filename: string; content: Uint8Array; mimeType: string }[]
  references?: string[]
}

export interface EmailTransportPort {
  connect(): Promise<void>
  close(): Promise<void>
  sendMail(options: SendOptions): Promise<{ messageId: string }>
  listMailboxes(): Promise<{ name: string; path: string; delimiter: string }[]>
  searchMessages(options: {
    mailbox?: string
    query?: string
    since?: Date
    before?: Date
    from?: string
    to?: string
    subject?: string
    unreadOnly?: boolean
    limit?: number
    page?: number
  }): Promise<{ messages: EmailMessage[]; total: number }>
  readMessage(mailbox: string, id: string): Promise<EmailMessage>
  moveMessage(mailbox: string, id: string, destinationMailbox: string): Promise<void>
  deleteMessage(mailbox: string, id: string): Promise<void>
  markAsRead(mailbox: string, id: string): Promise<void>
  onNewMessage(handler: (mailbox: string, message: EmailMessage) => void): () => void
  onError(handler: (err: Error) => void): () => void
}
