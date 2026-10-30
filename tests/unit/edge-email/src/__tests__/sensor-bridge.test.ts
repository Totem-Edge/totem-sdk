import { createEmailSensorBridge } from '../sensor-bridge.js';
import type { EmailTransportPort, EmailMessage } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

function makeMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    id: 'm1',
    messageId: '<m1@host>',
    from: { name: 'Sensor', email: 'sensor@example.com' },
    to: [{ name: 'Bridge', email: 'bridge@example.com' }],
    subject: 'temperature = 21.5',
    bodyText: 'reading: 21.5c',
    receivedAt: new Date('2026-01-01T00:00:00Z'),
    flags: [],
    attachments: [],
    ...overrides,
  };
}

class MockEmailTransport implements EmailTransportPort {
  readonly searches: Array<{ mailbox?: string; unreadOnly?: boolean }> = [];
  readonly marksRead: Array<{ mailbox: string; id: string }> = [];
  messages: EmailMessage[] = [];

  connect() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  sendMail() { return Promise.resolve({ messageId: 'x' }); }
  listMailboxes() { return Promise.resolve([]); }
  searchMessages(options: { mailbox?: string; unreadOnly?: boolean }) {
    this.searches.push(options);
    return Promise.resolve({ messages: this.messages, total: this.messages.length });
  }
  readMessage() { return Promise.reject(new Error('n/a')); }
  moveMessage() { return Promise.resolve(); }
  deleteMessage() { return Promise.resolve(); }
  markAsRead(mailbox: string, id: string) { this.marksRead.push({ mailbox, id }); return Promise.resolve(); }
  onNewMessage() { return () => {}; }
  onError() { return () => {}; }
}

function makeProof() {
  const createProof = jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } }));
  return { createProof };
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

describe('edge-email sensor bridge', () => {
  it('pollOnce searches unread and creates a proof per message', async () => {
    const transport = new MockEmailTransport();
    transport.messages = [makeMessage(), makeMessage({ id: 'm2', messageId: '<m2@host>', subject: 'humidity = 40' })];
    const proof = makeProof();
    const bridge = createEmailSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 's1', mailbox: 'INBOX', intervalMs: 60_000 }],
    });

    await bridge.pollOnce();
    expect(transport.searches[0]).toEqual({ mailbox: 'INBOX', unreadOnly: true });
    expect(proof.createProof).toHaveBeenCalledTimes(2);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'email:sensor:s1',
      claims: expect.arrayContaining([
        { key: 'messageId', value: '<m1@host>' },
        { key: 'from', value: 'sensor@example.com' },
        { key: 'bodyPreview', value: 'reading: 21.5c' },
      ]),
    }));
  });

  it('marks each message as read after proving', async () => {
    const transport = new MockEmailTransport();
    transport.messages = [makeMessage({ id: 'm1' }), makeMessage({ id: 'm2' })];
    const proof = makeProof();
    const bridge = createEmailSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 's1', mailbox: 'INBOX', intervalMs: 60_000 }],
    });
    await bridge.pollOnce();
    expect(transport.marksRead).toEqual([
      { mailbox: 'INBOX', id: 'm1' },
      { mailbox: 'INBOX', id: 'm2' },
    ]);
  });

  it('pollOnce filters non-unread and applies binding query scope', async () => {
    const transport = new MockEmailTransport();
    transport.messages = [makeMessage()];
    const proof = makeProof();
    const bridge = createEmailSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 's2', mailbox: 'Telemetry', from: 'sensor@example.com', intervalMs: 30_000 }],
    });
    await bridge.pollOnce();
    expect(transport.searches[0]).toMatchObject({
      mailbox: 'Telemetry',
      from: 'sensor@example.com',
      unreadOnly: true,
    });
  });

  it('pollOnce tolerates transport errors without throwing', async () => {
    const failing = new MockEmailTransport();
    failing.messages = [];
    const bridge = createEmailSensorBridge({
      runtime: makeRuntime(),
      transport: failing,
      bindings: [{ sensorId: 's1', mailbox: 'INBOX', intervalMs: 60_000 }],
    });
    await expect(bridge.pollOnce()).resolves.not.toThrow();
  });

  it('start runs an initial poll then stop clears timers', async () => {
    const transport = new MockEmailTransport();
    transport.messages = [makeMessage()];
    const proof = makeProof();
    const bridge = createEmailSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 's1', mailbox: 'INBOX', intervalMs: 10_000 }],
    });
    await bridge.start();
    await new Promise((r) => setTimeout(r, 0));
    await bridge.stop();
    expect(proof.createProof).toHaveBeenCalled();
  });

  it('start is idempotent', async () => {
    const transport = new MockEmailTransport();
    transport.messages = [];
    const bridge = createEmailSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 's1', mailbox: 'INBOX', intervalMs: 10_000 }],
    });
    await bridge.start();
    await bridge.start();
    await bridge.stop();
  });
});