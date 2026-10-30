import { createNfcGateway } from '../gateway.js';
import { encodeNdefMessage, decodeNdefMessage } from '../ndef.js';
import type { NfcTransportPort, NfcTag, NfcTagEvent, NdefRecord, HceApduHandler } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockNfcTransport implements NfcTransportPort {
  pollOpts: Array<{ techs?: string[] } | undefined> = [];
  stopPollCalled = false;
  failPoll = false;
  failReadNdef = false;
  failWriteNdef = false;
  failEraseNdef = false;
  failTransceive = false;
  failP2p = false;
  failHceReg = false;
  failHceUnreg = false;
  readonly reads: string[] = [];
  readonly writes: Array<{ tagId: string; records: NdefRecord[] }> = [];
  readonly erases: string[] = [];
  readonly transceives: Array<{ tagId: string; apdu: Uint8Array }> = [];
  readonly p2pSends: NdefRecord[][] = [];
  readonly hceRegs: HceApduHandler[] = [];
  tagHandlers: Array<(e: NfcTagEvent) => void> = [];
  tagLostHandlers: Array<(e: { uid: string; timestamp: number }) => void> = [];
  messageHandlers: Array<(records: NdefRecord[]) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  startPolling(options?: { techs?: string[] }) { this.pollOpts.push(options); if (this.failPoll) return Promise.reject(new Error('poll failed')); return Promise.resolve(); }
  stopPolling() { this.stopPollCalled = true; return Promise.resolve(); }
  waitForTag(_timeoutMs?: number) { return Promise.resolve(null); }
  readNdef(tagId: string) {
    this.reads.push(tagId);
    if (this.failReadNdef) return Promise.reject(new Error('read ndef failed'));
    return Promise.resolve([{ tnf: 0x01, type: 'U', payload: new Uint8Array([0x02, 0x74, 0x6f, 0x74, 0x65, 0x6d, 0x2e, 0x69, 0x6e, 0x67]), id: undefined }]);
  }
  writeNdef(tagId: string, records: NdefRecord[]) { this.writes.push({ tagId, records }); if (this.failWriteNdef) return Promise.reject(new Error('write ndef failed')); return Promise.resolve(); }
  eraseNdef(tagId: string) { this.erases.push(tagId); if (this.failEraseNdef) return Promise.reject(new Error('erase ndef failed')); return Promise.resolve(); }
  transceive(tagId: string, apdu: Uint8Array) {
    this.transceives.push({ tagId, apdu });
    if (this.failTransceive) return Promise.reject(new Error('transceive failed'));
    return Promise.resolve(new Uint8Array([0x90, 0x00]));
  }
  putMessage(records: NdefRecord[]) { this.p2pSends.push(records); if (this.failP2p) return Promise.reject(new Error('p2p failed')); return Promise.resolve(); }
  onTag(handler: (e: NfcTagEvent) => void) { this.tagHandlers.push(handler); return () => { this.tagHandlers = this.tagHandlers.filter((h) => h !== handler); }; }
  onTagLost(handler: (e: { uid: string; timestamp: number }) => void) { this.tagLostHandlers.push(handler); return () => { this.tagLostHandlers = this.tagLostHandlers.filter((h) => h !== handler); }; }
  onMessage(handler: (records: NdefRecord[]) => void) { this.messageHandlers.push(handler); return () => { this.messageHandlers = this.messageHandlers.filter((h) => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); }; }
  registerHceApduHandler(handler: HceApduHandler) { this.hceRegs.push(handler); if (this.failHceReg) return Promise.reject(new Error('hce reg failed')); return Promise.resolve(); }
  unregisterHceApduHandler() { if (this.failHceUnreg) return Promise.reject(new Error('hce unreg failed')); return Promise.resolve(); }

  emitTag(e: NfcTagEvent) { this.tagHandlers.forEach((h) => h(e)); }
  emitTagLost(e: { uid: string; timestamp: number }) { this.tagLostHandlers.forEach((h) => h(e)); }
  emitMessage(records: NdefRecord[]) { this.messageHandlers.forEach((h) => h(records)); }
  emitError(err: Error) { this.errorHandlers.forEach((h) => h(err)); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  const createProof = jest.fn(async (_params: { subject: string; claims: unknown[] }) =>
    ({ ok: true, data: { proofId: 'p1', proof: {} } }),
  );
  return { createProof };
}

const TAG: NfcTag = { id: 't1', uid: 'AABBCCDD', tech: 'iso14443a', detectedAt: Date.now() };
const TAG_EVENT: NfcTagEvent = { uid: 'AABBCCDD', id: 't1', timestamp: Date.now(), proximity: 0.9 };

describe('edge-nfc gateway', () => {
  it('start polls with configured techs and reports running status', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport, techs: ['iso14443a'] });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.pollOpts).toEqual([{ techs: ['iso14443a'] }]);
    expect(gw.status).toBe('running');
  });

  it('start passes undefined when no techs configured', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    expect(transport.pollOpts[0]).toBeUndefined();
  });

  it('start propagates poll errors', async () => {
    const transport = new MockNfcTransport();
    transport.failPoll = true;
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await expect(gw.start()).rejects.toThrow('poll failed');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.start();
    expect(transport.pollOpts).toHaveLength(1);
  });

  it('stop stops polling and reports stopped status', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.stop();
    expect(transport.stopPollCalled).toBe(true);
    expect(gw.status).toBe('stopped');
    expect(gw.tags).toEqual([]);
  });

  it('dedupes detected tags', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitTag(TAG_EVENT);
    transport.emitTag(TAG_EVENT);
    expect(gw.tags).toHaveLength(1);
    expect(gw.tags[0].uid).toBe('AABBCCDD');
    await gw.stop();
  });

  it('removes tag on tagLost', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitTag(TAG_EVENT);
    expect(gw.tags).toHaveLength(1);
    transport.emitTagLost({ uid: 'AABBCCDD', timestamp: Date.now() });
    expect(gw.tags).toEqual([]);
    await gw.stop();
  });

  it('emits a proof on tag detection', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();
    transport.emitTag(TAG_EVENT);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'nfc:t1',
      claims: [expect.objectContaining({ kind: 'nfc.tap', uid: 'AABBCCDD' })],
    }));
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitError(new Error('reader disconnected'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('getTag returns tag by id or uid', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitTag(TAG_EVENT);
    expect(gw.getTag('t1')?.uid).toBe('AABBCCDD');
    expect(gw.getTag('AABBCCDD')?.id).toBe('t1');
    expect(gw.getTag('zzz')).toBeNull();
    await gw.stop();
  });

  it('readNdef delegates to transport, emits proof, and fails for absent tag', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();

    // Tag not present → error
    expect((await gw.readNdef('zzz')).ok).toBe(false);

    // Tag present → success
    transport.emitTag(TAG_EVENT);
    const res = await gw.readNdef('t1');
    expect(res.ok).toBe(true);
    expect(transport.reads).toContain('t1');
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.ndef.read' })],
    }));

    // Transport failure
    transport.failReadNdef = true;
    expect((await gw.readNdef('t1')).ok).toBe(false);
    await gw.stop();
  });

  it('writeNdef delegates, emits proof, and fails for absent tag', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();
    const records: NdefRecord[] = [{ tnf: 0x01, type: 'T', payload: new Uint8Array([0x02, 0x65, 0x6e, 0x48, 0x65, 0x6c, 0x6c, 0x6f]) }];

    expect((await gw.writeNdef('zzz', records)).ok).toBe(false);

    transport.emitTag(TAG_EVENT);
    const res = await gw.writeNdef('t1', records);
    expect(res.ok).toBe(true);
    expect(transport.writes).toHaveLength(1);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.ndef.write' })],
    }));

    transport.failWriteNdef = true;
    expect((await gw.writeNdef('t1', records)).ok).toBe(false);
    await gw.stop();
  });

  it('eraseNdef delegates, emits proof, and fails for absent tag', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();

    expect((await gw.eraseNdef('zzz')).ok).toBe(false);

    transport.emitTag(TAG_EVENT);
    const res = await gw.eraseNdef('t1');
    expect(res.ok).toBe(true);
    expect(transport.erases).toContain('t1');
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.ndef.erase' })],
    }));

    transport.failEraseNdef = true;
    expect((await gw.eraseNdef('t1')).ok).toBe(false);
    await gw.stop();
  });

  it('transceive delegates APDU, emits proof, and fails for absent tag', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();
    const apdu = new Uint8Array([0x00, 0xb0, 0x00, 0x00, 0x10]);

    expect((await gw.transceive('zzz', apdu)).ok).toBe(false);

    transport.emitTag(TAG_EVENT);
    const res = await gw.transceive('t1', apdu);
    expect(res.ok).toBe(true);
    expect(Array.from((res as { data: { response: Uint8Array } }).data.response)).toEqual([0x90, 0x00]);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.apdu.exchange', apduBytes: 5, respBytes: 2 })],
    }));

    transport.failTransceive = true;
    expect((await gw.transceive('t1', apdu)).ok).toBe(false);
    await gw.stop();
  });

  it('putMessage delegates to transport and emits proof', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();
    const records: NdefRecord[] = [{ tnf: 0x01, type: 'U', payload: new Uint8Array([0x02, 0x74, 0x65, 0x73, 0x74]) }];

    const res = await gw.putMessage(records);
    expect(res.ok).toBe(true);
    expect(transport.p2pSends).toHaveLength(1);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.p2p.send' })],
    }));

    transport.failP2p = true;
    expect((await gw.putMessage(records)).ok).toBe(false);
    await gw.stop();
  });

  it('onMessage handlers receive inbound P2P messages', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    const handler = jest.fn();
    gw.onMessage(handler);
    transport.emitMessage([{ tnf: 0x01, type: 'U', payload: new Uint8Array() }]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([expect.objectContaining({ type: 'U' })]);
    await gw.stop();
  });

  it('registerHceApduHandler delegates and emits proof', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    const handler: HceApduHandler = async (apdu) => new Uint8Array([0x90, 0x00]);
    await gw.registerHceApduHandler(handler);
    expect(transport.hceRegs).toContain(handler);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.hce.registered' })],
    }));

    transport.failHceReg = true;
    await expect(gw.registerHceApduHandler(handler)).rejects.toThrow('hce reg failed');
  });

  it('unregisterHceApduHandler delegates and emits proof', async () => {
    const transport = new MockNfcTransport();
    const proof = makeProof();
    const gw = createNfcGateway({ runtime: makeRuntime(proof), transport });
    await gw.unregisterHceApduHandler();
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ kind: 'nfc.hce.unregistered' })],
    }));

    transport.failHceUnreg = true;
    await expect(gw.unregisterHceApduHandler()).rejects.toThrow('hce unreg failed');
  });

  it('no proof is emitted when proof port is absent', async () => {
    const transport = new MockNfcTransport();
    const gw = createNfcGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitTag(TAG_EVENT);
    // no error — proof is silently skipped
    expect(gw.tags).toHaveLength(1);
    await gw.stop();
  });
});

describe('ndef encode / decode roundtrip', () => {
  it('roundtrips a single record', () => {
    const record: NdefRecord = { tnf: 0x01, type: 'U', payload: new Uint8Array([0x02, 0x74, 0x65, 0x73, 0x74]), id: undefined };
    const bytes = encodeNdefMessage([record]);
    const decoded = decodeNdefMessage(bytes);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].tnf).toBe(0x01);
    expect(decoded[0].type).toBe('U');
    expect(decoded[0].payload.length).toBe(record.payload.length);
  });

  it('roundtrips multiple records', () => {
    const r1: NdefRecord = { tnf: 0x01, type: 'U', payload: new Uint8Array([0x02, 0x61]) };
    const r2: NdefRecord = { tnf: 0x02, type: 'text/plain', payload: new Uint8Array([0x68, 0x69]) };
    const bytes = encodeNdefMessage([r1, r2]);
    const decoded = decodeNdefMessage(bytes);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].type).toBe('U');
    expect(decoded[1].type).toBe('text/plain');
  });

  it('handles empty input gracefully', () => {
    expect(decodeNdefMessage(new Uint8Array(0))).toEqual([]);
  });
});
