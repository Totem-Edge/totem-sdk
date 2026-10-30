import { createEmailGateway } from '../gateway.js';
import type { EmailTransportPort, EmailMessage, SendOptions } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

function makeMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    id: '1',
    messageId: '<abc@host>',
    from: { name: 'Alice', email: 'alice@example.com' },
    to: [{ name: 'Device', email: 'device@example.com' }],
    subject: 'Test subject',
    bodyText: 'hello device',
    receivedAt: new Date('2026-01-01T00:00:00Z'),
    flags: ['Seen'],
    attachments: [],
    ...overrides,
  };
}

class MockEmailTransport implements EmailTransportPort {
  connected = false;
  readonly sent: SendOptions[] = [];
  readonly moves: Array<{ mailbox: string; id: string; dest: string }> = [];
  readonly deletes: Array<{ mailbox: string; id: string }> = [];
  readonly reads: Array<{ mailbox: string; id: string }> = [];
  readonly marksRead: Array<{ mailbox: string; id: string }> = [];
  searches: Array<{ mailbox?: string; unreadOnly?: boolean }> = [];
  readonly mailboxes = [
    { name: 'INBOX', path: 'INBOX', delimiter: '.' },
    { name: 'Archive', path: 'INBOX.Archive', delimiter: '.' },
  ];
  messages: EmailMessage[] = [makeMessage()];
  failConnect = false;
  failSend = false;
  failSearch = false;
  failRead = false;
  failMove = false;
  failDelete = false;
  failList = false;
  private newMsgHandlers: Array<(mailbox: string, message: EmailMessage) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];

  connect() {
    this.connected = true;
    if (this.failConnect) return Promise.reject(new Error('connect failed'));
    return Promise.resolve();
  }
  close() { this.connected = false; return Promise.resolve(); }
  sendMail(options: SendOptions) {
    this.sent.push(options);
    if (this.failSend) return Promise.reject(new Error('send failed'));
    return Promise.resolve({ messageId: '<out@host>' });
  }
  listMailboxes() {
    if (this.failList) return Promise.reject(new Error('list failed'));
    return Promise.resolve(this.mailboxes);
  }
  searchMessages(options: { mailbox?: string; unreadOnly?: boolean }) {
    this.searches.push(options);
    if (this.failSearch) return Promise.reject(new Error('search failed'));
    return Promise.resolve({ messages: this.messages, total: this.messages.length });
  }
  readMessage(mailbox: string, id: string) {
    this.reads.push({ mailbox, id });
    if (this.failRead) return Promise.reject(new Error('read failed'));
    const m = this.messages.find((x) => x.id === id);
    return m ? Promise.resolve(m) : Promise.reject(new Error('not found'));
  }
  moveMessage(mailbox: string, id: string, destinationMailbox: string) {
    this.moves.push({ mailbox, id, dest: destinationMailbox });
    if (this.failMove) return Promise.reject(new Error('move failed'));
    return Promise.resolve();
  }
  deleteMessage(mailbox: string, id: string) {
    this.deletes.push({ mailbox, id });
    if (this.failDelete) return Promise.reject(new Error('delete failed'));
    return Promise.resolve();
  }
  markAsRead(mailbox: string, id: string) {
    this.marksRead.push({ mailbox, id });
    return Promise.resolve();
  }
  onNewMessage(handler: (mailbox: string, message: EmailMessage) => void) {
    this.newMsgHandlers.push(handler);
    return () => { this.newMsgHandlers = this.newMsgHandlers.filter((h) => h !== handler); };
  }
  onError(handler: (err: Error) => void) {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); };
  }
  emitNewMessage(mailbox: string, message: EmailMessage) {
    this.newMsgHandlers.forEach((h) => h(mailbox, message));
  }
  emitError(err: Error) {
    this.errorHandlers.forEach((h) => h(err));
  }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  const createProof = jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } }));
  return { createProof };
}

const SEND_OPTIONS: SendOptions = {
  from: { name: 'Device', email: 'device@example.com' },
  to: [{ name: 'Alice', email: 'alice@example.com' }],
  subject: 'report',
  bodyText: 'status all good',
};

describe('edge-email gateway', () => {
  it('starts, connects transport, and reports running status', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.connected).toBe(true);
    expect(gw.status).toBe('running');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.start();
    expect(transport.connected).toBe(true);
  });

  it('start marks status error and throws when connect fails', async () => {
    const transport = new MockEmailTransport();
    transport.failConnect = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    await expect(gw.start()).rejects.toThrow('connect failed');
    expect(gw.status).toBe('error');
  });

  it('stop clears subscriptions and closes transport', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.stop();
    expect(transport.connected).toBe(false);
    expect(gw.status).toBe('stopped');
  });

  it('creates a proof when a new message arrives', async () => {
    const transport = new MockEmailTransport();
    const proof = makeProof();
    const gw = createEmailGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();
    const msg = makeMessage({ messageId: '<new@host>', id: '2' });
    transport.emitNewMessage('INBOX', msg);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'email:INBOX:<new@host>',
      claims: expect.arrayContaining([
        { key: 'from', value: 'alice@example.com' },
        { key: 'subject', value: 'Test subject' },
      ]),
    }));
    await gw.stop();
  });

  it('sendMail returns messageId on success', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.sendMail(SEND_OPTIONS);
    expect(res.ok).toBe(true);
    expect((res as { data: { messageId: string } }).data.messageId).toBe('<out@host>');
    expect(transport.sent).toHaveLength(1);
  });

  it('sendMail maps failures to SEND_FAILED', async () => {
    const transport = new MockEmailTransport();
    transport.failSend = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.sendMail(SEND_OPTIONS);
    expect(res).toEqual({ ok: false, error: 'Error: send failed', errorCode: 'SEND_FAILED' });
  });

  it('searchMessages defaults mailbox to config.defaultMailbox', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport, defaultMailbox: 'INBOX' });
    const res = await gw.searchMessages({ unreadOnly: true });
    expect(res.ok).toBe(true);
    expect(transport.searches[0].mailbox).toBe('INBOX');
    expect(transport.searches[0].unreadOnly).toBe(true);
    expect((res as { data: { total: number } }).data.total).toBe(1);
  });

  it('searchMessages maps failures to SEARCH_FAILED', async () => {
    const transport = new MockEmailTransport();
    transport.failSearch = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.searchMessages({});
    expect(res).toEqual({ ok: false, error: 'Error: search failed', errorCode: 'SEARCH_FAILED' });
  });

  it('readMessage returns the message', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readMessage('INBOX', '1');
    expect(res.ok).toBe(true);
    expect((res as { data: { message: EmailMessage } }).data.message.subject).toBe('Test subject');
    expect(transport.reads).toEqual([{ mailbox: 'INBOX', id: '1' }]);
  });

  it('readMessage maps failures to READ_FAILED', async () => {
    const transport = new MockEmailTransport();
    transport.failRead = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readMessage('INBOX', '1');
    expect(res).toEqual({ ok: false, error: 'Error: read failed', errorCode: 'READ_FAILED' });
  });

  it('moveMessage forwards destination and returns ok', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.moveMessage('INBOX', '1', 'INBOX.Archive');
    expect(res.ok).toBe(true);
    expect(transport.moves).toEqual([{ mailbox: 'INBOX', id: '1', dest: 'INBOX.Archive' }]);
  });

  it('moveMessage maps failures to MOVE_FAILED', async () => {
    const transport = new MockEmailTransport();
    transport.failMove = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.moveMessage('INBOX', '1', 'INBOX.Archive');
    expect(res).toEqual({ ok: false, error: 'Error: move failed', errorCode: 'MOVE_FAILED' });
  });

  it('deleteMessage maps failures to DELETE_FAILED', async () => {
    const transport = new MockEmailTransport();
    transport.failDelete = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.deleteMessage('INBOX', '1');
    expect(res).toEqual({ ok: false, error: 'Error: delete failed', errorCode: 'DELETE_FAILED' });
  });

  it('markAsRead returns ok', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.markAsRead('INBOX', '1');
    expect(res.ok).toBe(true);
    expect(transport.marksRead).toEqual([{ mailbox: 'INBOX', id: '1' }]);
  });

  it('listMailboxes returns flattened mailbox list', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.listMailboxes();
    expect(res.ok).toBe(true);
    expect((res as { data: { mailboxes: { name: string; path: string }[] } }).data.mailboxes).toEqual([
      { name: 'INBOX', path: 'INBOX' },
      { name: 'Archive', path: 'INBOX.Archive' },
    ]);
  });

  it('listMailboxes maps failures to LIST_FAILED', async () => {
    const transport = new MockEmailTransport();
    transport.failList = true;
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    const res = await gw.listMailboxes();
    expect(res).toEqual({ ok: false, error: 'Error: list failed', errorCode: 'LIST_FAILED' });
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockEmailTransport();
    const gw = createEmailGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitError(new Error('boom'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });
});