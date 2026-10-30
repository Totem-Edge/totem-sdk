import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const options = JSON.parse(process.argv[2]);
const fail = (error) => {
  process.send?.({ type: 'fatal', error: error.stack ?? String(error) }, () => process.exit(1));
};

async function main() {
  const cjs = options.moduleMode === 'cjs';
  const { createSqliteMqttReplayStore } = cjs
    ? require('@totemsdk/edge-mqtt/sqlite-replay-store')
    : await import('@totemsdk/edge-mqtt/sqlite-replay-store');
  const store = await createSqliteMqttReplayStore({ path: options.path });
  let api;
  if (options.mode !== 'claim') {
    api = cjs ? require('@totemsdk/edge-mqtt') : await import('@totemsdk/edge-mqtt');
    if (!cjs) {
      const core = await import('@totemsdk/core');
      const coreRequire = createRequire(require.resolve('@totemsdk/core'));
      const glue = coreRequire.resolve('@totemsdk/core-wasm/web');
      await core.init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', pathToFileURL(glue))) });
    }
  }
  process.once('message', () => { void run().catch(fail); });
  process.send({ type: 'ready' });

  async function run() {
    let result;
    if (options.mode === 'claim') {
      result = await store.claim(options.key, options.expiresAt, options.now);
    } else {
      const payload = { action: 'pulse' };
      // Authentication is a controlled fixture port. These tests exercise real
      // WASM/hash/persistence paths, not broker ACL/TLS or issuer-key verification.
      const envelope = {
        commandId: options.commandId, command: 'pulse', issuedAt: options.createdAt,
        expiresAt: options.createdAt + 120_000, nonce: options.commandId,
        issuerIdentity: 'fixture-issuer', signature: 'fixture-signature',
        payloadHash: createHash('sha3-256').update(api.canonicalJson(payload)).digest('hex'),
      };
      const handler = api.createMqttCommandHandler({
        runtime: { deviceId: 'process-test-device', ports: {
          policy: { async check() { return { ok: true, data: { allowed: true } }; } },
        } },
        client: { async publish() {} }, replayStore: store, maxCommandAgeMs: 120_000,
        async verifyCommandSignature(command) {
          return command.issuerIdentity === 'fixture-issuer' && command.signature === 'fixture-signature';
        },
        executor: {
          async execute() {
            if (options.mode === 'crash-before-effect') {
              process.send({ type: 'executor-entered' });
              return new Promise(() => {});
            }
            const fd = openSync(options.effectLog, 'a');
            try { writeSync(fd, `${options.commandId}\n`); fsyncSync(fd); }
            finally { closeSync(fd); }
            if (options.mode === 'crash-after-effect') {
              process.send({ type: 'effect-committed' });
              return new Promise(() => {});
            }
            return { ok: true };
          },
        },
      });
      result = await handler.handleCommand({
        topic: 'totem/process-test-device/commands',
        payload: JSON.stringify({ envelope, payload }), receivedAt: Date.now(),
      });
    }
    await store.close();
    process.send({ type: 'result', result }, () => process.disconnect());
  }
}

void main().catch(fail);
