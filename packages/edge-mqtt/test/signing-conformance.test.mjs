import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { init } from '@totemsdk/core';
import { verifyProofSignature } from '@totemsdk/proof';
import { SqliteStore } from '@totemsdk/storage/sqlite';
import { LocalLeaseProvider } from '@totemsdk/wots-lease';
import { createMqttProofPublisher } from '../dist/index.js';

const require = createRequire(import.meta.url);
const coreRequire = createRequire(require.resolve('@totemsdk/core'));
const coreGlue = coreRequire.resolve('@totemsdk/core-wasm/web');
await init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', pathToFileURL(coreGlue))) });

const SEED = new Uint8Array(32).fill(9);
const MESSAGE = { topic: 'sensors/device/temp', payload: '{"temp":22.5}', receivedAt: Date.now() };

function publisher(leaseProvider) {
  return createMqttProofPublisher({
    runtime: { deviceId: 'signing-device', ports: {} },
    client: { async publish() {} },
    defaultProofTopic: 'proofs/out',
    proofMode: 'proof-package',
    seed: SEED,
    leaseProvider,
    leaseTreeId: 'mqtt-signing',
  });
}

test('durable LocalLeaseProvider prevents MQTT WOTS key reuse across concurrency and restart', { timeout: 60_000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'mqtt-wots-signing-'));
  const database = join(directory, 'wots.sqlite');
  let store = new SqliteStore(database);
  let provider = new LocalLeaseProvider(store, undefined, 'signing-device');
  await provider.initialize();
  t.after(async () => { await store.close(); rmSync(directory, { recursive: true, force: true }); });

  const first = await Promise.all([
    publisher(provider).createProofFromMessage(MESSAGE),
    publisher(provider).createProofFromMessage({ ...MESSAGE, payload: '{"temp":23}' }),
    publisher(provider).createProofFromMessage({ ...MESSAGE, payload: '{"temp":24}' }),
  ]);
  const proofs = first.map((envelope) => envelope.proof);
  assert.equal(proofs.every(verifyProofSignature), true);
  const firstKeys = new Set(proofs.map((proof) => proof.signature.publicKey));
  assert.equal(firstKeys.size, 3, 'concurrent proofs must use distinct WOTS keys');

  // Restart the provider over the same durable SQLite database.
  await store.close();
  store = new SqliteStore(database);
  provider = new LocalLeaseProvider(store, undefined, 'signing-device');
  await provider.initialize();
  const afterRestart = await publisher(provider).createProofFromMessage({ ...MESSAGE, payload: '{"temp":25}' });
  assert.equal(verifyProofSignature(afterRestart.proof), true);
  assert.equal(firstKeys.has(afterRestart.proof.signature.publicKey), false, 'restart reused a WOTS key');
});
