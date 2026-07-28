# @totemsdk/edge-email

Edge runtime adapter for email — IMAP/SMTP polling, notification delivery, command parsing, and sensor ingestion via email.

```
npm install @totemsdk/edge-email
```

## Design

The adapter follows the [@totemsdk/edge](https://www.npmjs.com/package/@totemsdk/edge) port-injection pattern: it does **not** bundle any email protocol library. The caller provides an `EmailTransportPort` implementation (IMAP, SMTP, Microsoft Graph, Maildir, or any custom backend). This keeps the adapter protocol-agnostic and testable.

The package ships with [Himalaya](https://github.com/pimalaya/himalaya) as the reference transport backend — a Rust CLI/library that supports IMAP, SMTP, JMAP, Gmail REST, Microsoft Graph, Proton Mail Bridge, and Maildir with TLS, SASL auth, PGP, and auto-discovery.

## Quick Start

```typescript
import { createEdgeRuntime } from '@totemsdk/edge'
import { createEmailGateway, createEmailSensorBridge } from '@totemsdk/edge-email'
import type { EmailTransportPort, SendOptions } from '@totemsdk/edge-email'

// 1. Implement the transport port
const transport: EmailTransportPort = {
  async connect() { /* open IMAP/SMTP connection */ },
  async close() { /* tear down */ },
  async sendMail(opts: SendOptions) {
    // call Himalaya SMTP CLI / REST API / etc.
    return { messageId: '<abc@example.com>' }
  },
  async searchMessages(opts) { /* IMAP SEARCH */ },
  async readMessage(mailbox, id) { /* IMAP FETCH */ },
  async moveMessage(mailbox, id, dest) { /* IMAP MOVE */ },
  async deleteMessage(mailbox, id) { /* IMAP STORE +FLAGS.SILENT \Deleted + EXPUNGE */ },
  async markAsRead(mailbox, id) { /* IMAP STORE +FLAGS.SILENT \Seen */ },
  async listMailboxes() { /* IMAP LIST */ },
  onNewMessage(handler) { /* register IDLE/POLL callback */ return () => {} },
  onError(handler) { /* register error callback */ return () => {} },
}

// 2. Wire into EdgeRuntime
const runtime = createEdgeRuntime({ deviceId: 'email-gateway-01' })

// 3. Create the gateway
const gateway = createEmailGateway({
  runtime,
  transport,
  defaultMailbox: 'INBOX',
})

await gateway.start()

// 4. Send a notification
await gateway.sendMail({
  from: { name: 'Line Controller', email: 'controller@factory.local' },
  to: [{ name: 'Supervisor', email: 'supervisor@example.com' }],
  subject: 'Batch 7 temperature exceeded threshold',
  bodyText: 'Line A, station 3 reached 92°C at 2026-07-25T14:30:00Z',
})

// 5. Poll for incoming commands
const results = await gateway.searchMessages({
  mailbox: 'INBOX',
  subject: 'CMD:',
  unreadOnly: true,
})

for (const msg of results.data.messages) {
  console.log('Command received:', msg.subject, msg.bodyText)
  await gateway.markAsRead('INBOX', msg.id)
}

// 6. Start sensor bridge for periodic polling
const bridge = createEmailSensorBridge({
  runtime,
  transport,
  bindings: [
    {
      sensorId: 'alerts',
      mailbox: 'INBOX',
      from: 'alerts@scada.local',
      intervalMs: 30_000,
    },
  ],
})

await bridge.start()
```

## Use Cases

### Governance & DAO Notifications

Send proposal lifecycle events (created, voting open, passed, rejected, executed) to a distribution list. Vote by replying to the notification email:

```typescript
// On proposal creation:
await gateway.sendMail({
  from: { name: 'DAO Bot', email: 'dao@totem.ing' },
  to: [{ name: 'DAO Members', email: 'members@dao.totem.ing' }],
  subject: `[PROPOSAL] #${proposalId}: Increase liquidity bond`,
  bodyText: [
    `Proposal: Increase liquidity bond from 1000 to 2000 MINIMA`,
    ``,
    `Reply with APPROVE or REJECT to cast your vote.`,
    `Deadline: 2026-08-01T00:00:00Z`,
  ].join('\n'),
})

// Poll for votes (sensor bridge):
const voteResults = await gateway.searchMessages({
  mailbox: 'INBOX',
  subject: `Re: [PROPOSAL] #${proposalId}`,
  unreadOnly: true,
})
for (const msg of voteResults.data.messages) {
  const choice = msg.bodyText.trim().toUpperCase()
  if (choice === 'APPROVE' || choice === 'REJECT') {
    await governance.castVote(proposalId, msg.from.email, choice)
  }
}
```

### Industrial Action Approval Workflow

Multi-signer approval for critical actions — each approver replies with their commitment hash:

```typescript
// Executor sends approval request:
await gateway.sendMail({
  from: { name: 'Executor', email: 'executor@factory.local' },
  to: [
    { name: 'Approver A', email: 'approver-a@example.com' },
    { name: 'Approver B', email: 'approver-b@example.com' },
  ],
  subject: `[ACTION] #${actionId}: Emergency shutdown line 3`,
  bodyText: [
    `Action: emergency-shutdown`,
    `Target: line-3`,
    `Reason: coolant leak detected`,
    ``,
    `Reply with your commitment hash to approve.`,
    `Commitment: ${actionCommitment}`,
  ].join('\n'),
})

// Collect signed commitments:
// (sensor bridge polls for replies, extracts hash from body)
```

### Email-Based Identity Recovery

Challenge-response for key rotation — prove email ownership by signing a challenge:

```typescript
// Send challenge:
await gateway.sendMail({
  from: { name: 'Identity Service', email: 'identity@totem.ing' },
  to: [{ name: 'User', email: 'user@example.com' }],
  subject: 'Verify your email address for key recovery',
  bodyText: `Your challenge token: ${challengeToken}\n\nSign this with your new key and send it back.`,
})

// Poll for signed response:
const inbox = await gateway.searchMessages({
  mailbox: 'INBOX',
  from: 'user@example.com',
  subject: 'Signed challenge',
  unreadOnly: true,
})
for (const msg of inbox.data.messages) {
  const isValid = await verifySignature(challengeToken, msg.bodyText.trim())
  if (isValid) {
    await rootIdentity.rotateKey(msg.from.email, newPublicKey)
  }
}
```

### Oracle Email Verification

Prove an email was sent or received at a specific time by anchoring its hash on-chain:

```typescript
const msg = await gateway.readMessage('INBOX', someId)
const emailHash = sha3_256(new TextEncoder().encode(
  `${msg.messageId}\n${msg.from.email}\n${msg.receivedAt.toISOString()}\n${msg.bodyText}`
))

await runtime.ports.proof.createProof({
  subject: `email:receipt:${msg.messageId}`,
  claims: [
    { key: 'hash', value: toHex(emailHash) },
    { key: 'from', value: msg.from.email },
    { key: 'receivedAt', value: msg.receivedAt.toISOString() },
  ],
})
```

### Command & Control via Email

In air-gapped or legacy environments where email is the only WAN egress, the adapter polls an IMAP mailbox for machine commands and forwards them to the appropriate protocol adapter:

```typescript
const inbound = await gateway.searchMessages({
  mailbox: 'INBOX',
  subject: 'CMD:',
  unreadOnly: true,
})

for (const msg of inbound.data.messages) {
  const [action, ...args] = msg.bodyText.trim().split(/\s+/)

  switch (action) {
    case 'START_BATCH':
      await edgeModbus.writeRegister('line-3', 0x01, parseInt(args[0]))
      break
    case 'STOP_LINE':
      await edgeBacnet.writeProperty(42, 'analogOutput', 1, 0)
      break
    case 'EMERGENCY_STOP':
      await Promise.all([
        edgeCan.sendMessage(0x100, Buffer.from([0xFF])),
        edgeModbus.writeCoil('pump-7', false),
      ])
      break
  }

  await gateway.markAsRead('INBOX', msg.id)
  await gateway.sendMail({
    from: { name: 'Line Controller', email: 'controller@factory.local' },
    to: [{ name: msg.from.name, email: msg.from.email }],
    subject: `ACK: ${msg.subject}`,
    bodyText: `Command ${action} executed at ${new Date().toISOString()}`,
  })
}
```

### Store-and-Forward Queue for Disconnected Sites

When connectivity is intermittent, outbound messages queue as IMAP drafts and flush when the link returns:

```typescript
// While disconnected:
await gateway.sendMail({
  // ... fails gracefully
})

// Implementation: fall back to saving as IMAP draft
// On reconnect: move drafted messages to outbox for delivery
```

### Audit Trail — Immutable Email Archive

Archive governance emails on-chain for tamper-evident audit trails:

```typescript
// After processing a governance email:
const hash = hashCanonical('TOTEM_EMAIL_ARCHIVE_V1', {
  messageId: msg.messageId,
  from: msg.from.email,
  to: msg.to.map((r) => r.email),
  subject: msg.subject,
  bodyHash: toHex(sha3_256(new TextEncoder().encode(msg.bodyText))),
  receivedAt: msg.receivedAt.toISOString(),
})

await runtime.ports.proof.createProof({
  subject: `email:archive:${msg.messageId}`,
  claims: [{ key: 'hash', value: hash }],
})
```

### Encrypted Communications via Proton Mail Bridge

When privacy is required (sensitive DAO communications, industrial secrets), route all email through Proton Mail's encrypted infrastructure:

```typescript
// Point the transport at the local Proton Bridge IMAP/SMTP endpoint:
const transport: EmailTransportPort = {
  async connect() {
    // imap://127.0.0.1:1143 with Proton Bridge cert
    // smtp://127.0.0.1:1025 with Proton Bridge cert
  },
  // ...
}
// All email is now E2E-encrypted by Proton
```

### PGP-Signed Proposals

Sign governance proposals with PGP before on-chain submission:

```typescript
const proposalBody = `proposal:increase-liquidity-bond\nfrom:1000\nto:2000`
const pgpSignature = await gpgSign(proposalBody, privateKey)

await gateway.sendMail({
  from: { name: 'DAO Member', email: 'member@example.com' },
  to: [{ name: 'DAO', email: 'dao@totem.ing' }],
  subject: `[PROPOSAL] Increase liquidity bond`,
  bodyText: `${proposalBody}\n\n---\nPGP Signature:\n${pgpSignature}`,
})

// Recipients verify the signature before voting
```

### AI / MCP Tool Integration

AI agents can use the email adapter as a read-write communication channel:

```typescript
// Example MCP tool exposed by @totemsdk/mcp-server:
// Tool: email_send — send an email on behalf of the system
// Tool: email_search — search inbox with natural language query
// Tool: email_read — read a specific message and extract structured data

// "email the line supervisor that batch 7 exceeded threshold"
const result = await gateway.sendMail({
  from: { name: 'AI Monitor', email: 'ai@factory.local' },
  to: [{ name: 'Supervisor', email: 'supervisor@example.com' }],
  subject: '[ALERT] Batch 7 temperature exceeded threshold',
  bodyText: 'Line A station 3 reached 92°C at 14:30:00Z. Requires manual inspection.',
})
```

### Calendar-Driven Scheduling

Sync governance deadlines with a Microsoft 365 calendar via Himalaya's `msgraph` backend:

```typescript
// Read next calendar event
const events = await msgraph.listEvents({ start: now, end: oneWeekFromNow })
for (const event of events) {
  if (event.subject.startsWith('PROPOSAL_DEADLINE:')) {
    const proposalId = event.subject.split(':')[1]
    const deadline = new Date(event.end.datetime)
    await governance.scheduleDeadline(proposalId, deadline)
  }
}
```

### Maildir as a Data Pipeline

Legacy SCADA systems dump logs as `.eml` files. Himalaya's Maildir backend ingests them into the Totem streaming pipeline:

```typescript
const transport: EmailTransportPort = {
  async searchMessages(opts) {
    // Read from ~/Mail/scada-logs/new/ via Himalaya maildir backend
  },
  // ...
}

// Ingest email logs as proofs
bridge.pollOnce() // each .eml file becomes a proof on-chain
```

## Transport Port Interface

The `EmailTransportPort` interface defines all protocol operations. The reference implementation uses [Himalaya](https://github.com/pimalaya/himalaya) CLI commands via child process, but the port can be backed by any email protocol library, REST API, or local Maildir filesystem.

```typescript
interface EmailTransportPort {
  connect(): Promise<void>
  close(): Promise<void>
  sendMail(options: SendOptions): Promise<{ messageId: string }>
  listMailboxes(): Promise<{ name: string; path: string; delimiter: string }[]>
  searchMessages(options: { ... }): Promise<{ messages: EmailMessage[]; total: number }>
  readMessage(mailbox: string, id: string): Promise<EmailMessage>
  moveMessage(mailbox: string, id: string, destinationMailbox: string): Promise<void>
  deleteMessage(mailbox: string, id: string): Promise<void>
  markAsRead(mailbox: string, id: string): Promise<void>
  onNewMessage(handler: (mailbox: string, message: EmailMessage) => void): () => void
  onError(handler: (err: Error) => void): () => void
}
```

## Capabilities

| Capability | Description |
|---|---|
| `edge-email:send` | Send email messages |
| `edge-email:receive` | Receive / poll email messages |
| `edge-email:search` | Search messages by query, date range, sender |
| `edge-email:archive` | Move messages between mailboxes |
| `edge-email:sensor` | Periodic polling bridge for email-based sensors |
| `edge-email:command` | Parse inbound email as machine commands |
| `edge-email:proof` | Forward email events as on-chain proofs |

## License

MIT
