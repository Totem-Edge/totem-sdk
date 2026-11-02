import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmailGateway } from '../../../packages/edge-email/dist/gateway.js';
import { createEmailSensorBridge } from '../../../packages/edge-email/dist/sensor-bridge.js';

function message(id, overrides = {}) {
  return {
    id,
    messageId: `<${id}@example.test>`,
    from: { name: 'Sensor', email: 'sensor@example.test' },
    to: [{ name: 'Edge', email: 'edge@example.test' }],
    subject: 'reading',
    bodyText: 'temperature=21.5',
    receivedAt: new Date('2026-11-01T10:00:00Z'),
    flags: [],
    attachments: [],
    ...overrides,
  };
}

class SimulatedEmail {
  connected = false;
  messages = [message('1'), message('2', { flags: ['\\Seen'] })];
  mailboxes = [{ name: 'INBOX', path: 'INBOX', delimiter: '/' }, { name: 'Archive', path: 'Archive', delimiter: '/' }];
  newMessageHandlers = [];
  errorHandlers = [];

  async connect() { this.connected = true; }
  async close() { this.connected = false; }
  async sendMail(options) {
    if (options.to[0]?.email === 'fail@example.test') throw new Error('SMTP rejected');
    const sent = message(String(this.messages.length + 1), { from: options.from, to: options.to, subject: options.subject, bodyText: options.bodyText, flags: ['\\Seen'] });
    this.messages.push(sent);
    return { messageId: sent.messageId };
  }
  async listMailboxes() { return this.mailboxes; }
  async searchMessages(options) {
    const mailbox = options.mailbox ?? 'INBOX';
    if (mailbox === 'missing') throw new Error('mailbox not found');
    let matches = this.messages.filter((entry) => !entry.flags.includes('\\Deleted'));
    if (options.unreadOnly) matches = matches.filter((entry) => !entry.flags.includes('\\Seen'));
    if (options.from) matches = matches.filter((entry) => entry.from.email === options.from);
    if (options.subject) matches = matches.filter((entry) => entry.subject.includes(options.subject));
    if (options.query) matches = matches.filter((entry) => entry.bodyText.includes(options.query));
    return { messages: matches, total: matches.length };
  }
  async readMessage(mailbox, id) {
    const found = this.messages.find((entry) => entry.id === id);
    if (!found) throw new Error('message not found');
    return found;
  }
  async moveMessage(mailbox, id, destination) {
    if (destination === 'missing') throw new Error('destination not found');
    const found = this.messages.find((entry) => entry.id === id);
    if (!found) throw new Error('message not found');
    found.mailbox = destination;
  }
  async deleteMessage(mailbox, id) {
    const found = this.messages.find((entry) => entry.id === id);
    if (!found) throw new Error('message not found');
    found.flags.push('\\Deleted');
  }
  async markAsRead(mailbox, id) {
    const found = this.messages.find((entry) => entry.id === id);
    if (!found) throw new Error('message not found');
    if (!found.flags.includes('\\Seen')) found.flags.push('\\Seen');
  }
  onNewMessage(handler) { this.newMessageHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emitNew(mailbox, entry) { for (const handler of this.newMessageHandlers) handler(mailbox, entry); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'email-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('email gateway and bridge exercise mailboxes, search, flags, failures and teardown', async () => {
  const transport = new SimulatedEmail();
  const proofs = [];
  const gateway = createEmailGateway({ runtime: runtime(proofs), transport, defaultMailbox: 'INBOX' });
  await gateway.start();
  assert.equal(transport.connected, true);
  assert.equal(gateway.status, 'running');

  const incoming = message('3');
  transport.messages.push(incoming);
  transport.emitNew('INBOX', incoming);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'email:INBOX:<3@example.test>'));

  const sent = await gateway.sendMail({ from: { name: 'Edge', email: 'edge@example.test' }, to: [{ name: 'Ops', email: 'ops@example.test' }], subject: 'alert', bodyText: 'pump offline' });
  assert.equal(sent.ok, true);
  assert.ok(sent.data.messageId);
  const failedSend = await gateway.sendMail({ from: { name: 'Edge', email: 'edge@example.test' }, to: [{ name: 'Fail', email: 'fail@example.test' }], subject: 'x', bodyText: 'y' });
  assert.equal(failedSend.ok, false);
  assert.equal(failedSend.errorCode, 'SEND_FAILED');

  const search = await gateway.searchMessages({ unreadOnly: true });
  assert.equal(search.ok, true);
  assert.ok(search.data.messages.every((entry) => !entry.flags.includes('\\Seen')));

  const read = await gateway.readMessage('INBOX', '1');
  assert.equal(read.ok, true);
  assert.equal(read.data.message.id, '1');
  const missing = await gateway.readMessage('INBOX', '404');
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/);

  assert.equal((await gateway.markAsRead('INBOX', '1')).ok, true);
  assert.equal((await gateway.moveMessage('INBOX', '1', 'Archive')).ok, true);
  assert.equal((await gateway.moveMessage('INBOX', '1', 'missing')).ok, false);
  assert.equal((await gateway.deleteMessage('INBOX', '2')).ok, true);
  assert.equal((await gateway.listMailboxes()).ok, true);

  const bridge = createEmailSensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'alerts', mailbox: 'INBOX', subject: 'reading', intervalMs: 60_000 }],
  });
  await bridge.pollOnce();
  assert.ok(proofs.some((proof) => proof.subject === 'email:sensor:alerts'));
  await bridge.start();
  await bridge.stop();

  await gateway.stop();
  assert.equal(transport.connected, false);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
