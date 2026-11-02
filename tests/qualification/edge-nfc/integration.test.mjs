import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNfcGateway } from '../../../packages/edge-nfc/dist/gateway.js';

class SimulatedNfc {
  polling = false;
  tagHandlers = [];
  lostHandlers = [];
  messageHandlers = [];
  errorHandlers = [];
  apduHandler;
  p2p = [];
  written = [];
  erased = [];

  async startPolling(options) { this.polling = true; this.options = options; }
  async stopPolling() { this.polling = false; }
  async waitForTag() { return null; }
  async readNdef(tagId) { return [{ tnf: 0x01, type: 'T', payload: new TextEncoder().encode('edge') }]; }
  async writeNdef(tagId, records) { this.written.push({ tagId, records }); }
  async eraseNdef(tagId) { this.erased.push(tagId); }
  async transceive(tagId, apdu) {
    if (apdu[0] === 0xff) throw new Error('APDU rejected');
    return Uint8Array.of(0x90, 0x00);
  }
  onTag(handler) { this.tagHandlers.push(handler); return () => {}; }
  onTagLost(handler) { this.lostHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  async putMessage(records) { this.p2p.push(records); }
  onMessage(handler) { this.messageHandlers.push(handler); return () => {}; }
  async registerHceApduHandler(handler) { this.apduHandler = handler; }
  async unregisterHceApduHandler() { this.apduHandler = undefined; }

  emitTag(event) { for (const handler of this.tagHandlers) handler(event); }
  emitLost(event) { for (const handler of this.lostHandlers) handler(event); }
  emitMessage(records) { for (const handler of this.messageHandlers) handler(records); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'nfc-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

const TAG = { uid: '04aabbcc', id: 'tag-1', timestamp: 1000, proximity: 0.9 };

test('NFC gateway exercises reader, NDEF, APDU, P2P, HCE and teardown', async () => {
  const transport = new SimulatedNfc();
  const proofs = [];
  const gateway = createNfcGateway({ runtime: runtime(proofs), transport, techs: ['iso14443a'] });

  await gateway.start();
  assert.equal(transport.polling, true);
  assert.deepEqual(transport.options, { techs: ['iso14443a'] });
  assert.equal(gateway.status, 'running');

  transport.emitTag(TAG);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(gateway.tags.length, 1);
  assert.equal(gateway.getTag('04aabbcc')?.id, 'tag-1');
  assert.ok(proofs.some((proof) => proof.claims[0].kind === 'nfc.tap'));

  const read = await gateway.readNdef('tag-1');
  assert.equal(read.ok, true);
  assert.equal(read.data.records[0].type, 'T');
  assert.ok(proofs.some((proof) => proof.claims[0].kind === 'nfc.ndef.read'));

  const write = await gateway.writeNdef('tag-1', [{ tnf: 0x01, type: 'T', payload: new TextEncoder().encode('hello') }]);
  assert.equal(write.ok, true);
  assert.equal(transport.written.length, 1);
  assert.ok(proofs.some((proof) => proof.claims[0].kind === 'nfc.ndef.write'));

  assert.equal((await gateway.eraseNdef('tag-1')).ok, true);
  assert.deepEqual(transport.erased, ['tag-1']);

  const apdu = await gateway.transceive('tag-1', Uint8Array.of(0x00, 0xa4));
  assert.equal(apdu.ok, true);
  assert.deepEqual([...apdu.data.response], [0x90, 0x00]);
  const rejected = await gateway.transceive('tag-1', Uint8Array.of(0xff));
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /APDU rejected/);

  const absent = await gateway.readNdef('missing');
  assert.equal(absent.ok, false);
  assert.match(absent.error, /tag not present/);

  assert.equal((await gateway.putMessage([{ tnf: 0x01, type: 'T', payload: Uint8Array.of(1) }])).ok, true);
  assert.equal(transport.p2p.length, 1);

  const inbound = [];
  const unsubscribe = gateway.onMessage((records) => inbound.push(records));
  transport.emitMessage([{ tnf: 0x01, type: 'T', payload: Uint8Array.of(2) }]);
  assert.equal(inbound.length, 1);
  unsubscribe();

  await gateway.registerHceApduHandler(async (request) => request);
  assert.equal(typeof transport.apduHandler, 'function');
  await gateway.unregisterHceApduHandler();
  assert.equal(transport.apduHandler, undefined);

  transport.emitLost({ uid: TAG.uid, timestamp: 2000 });
  assert.equal(gateway.tags.length, 0);

  transport.emitError(new Error('reader removed'));
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.polling, false);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
