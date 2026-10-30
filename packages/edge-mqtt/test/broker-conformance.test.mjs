import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Aedes } from 'aedes';
import mqtt from 'mqtt';
import { createMqttCommandHandler } from '../dist/index.js';
import { createSqliteMqttReplayStore } from '../dist/sqlite-replay-store.js';
import { init } from '@totemsdk/core';

const require = createRequire(import.meta.url);
const coreRequire = createRequire(require.resolve('@totemsdk/core'));
const coreGlue = coreRequire.resolve('@totemsdk/core-wasm/web');
await init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', pathToFileURL(coreGlue))) });

const TOPIC = 'totem/broker-device/commands';

function waitFor(predicate, label, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${label}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

async function startBroker(options = {}) {
  const broker = await Aedes.createBroker(options);
  const server = createServer(broker.handle);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    broker,
    url: `mqtt://127.0.0.1:${server.address().port}`,
    async close() {
      await broker.close();
      server.close();
      await once(server, 'close');
    },
  };
}

function portFor(client) {
  let handler;
  const pending = [];
  client.on('message', (topic, payload, packet) => {
    const message = {
      topic,
      payload,
      qos: packet.qos,
      retain: Boolean(packet.retain),
      receivedAt: Date.now(),
    };
    if (handler) void handler(message);
    else pending.push(message);
  });
  return {
    async connect() {
      if (!client.connected) await once(client, 'connect');
    },
    async disconnect() {
      await new Promise((resolve) => client.end(false, {}, resolve));
    },
    async subscribe(topic, options = {}) {
      await new Promise((resolve, reject) => {
        client.subscribe(topic, { qos: options.qos ?? 1 }, (error, granted) => {
          if (error) reject(error);
          else if (!granted?.[0] || granted[0].qos === 128) reject(new Error(`Subscription rejected: ${topic}`));
          else resolve();
        });
      });
      return {
        topic,
        async unsubscribe() {
          await new Promise((resolve, reject) => client.unsubscribe(topic, (error) => error ? reject(error) : resolve()));
        },
      };
    },
    async publish(topic, payload, options = {}) {
      await new Promise((resolve, reject) => {
        client.publish(topic, payload, { qos: options.qos ?? 1, retain: options.retain ?? false }, (error) => {
          if (error) reject(error); else resolve();
        });
      });
    },
    onMessage(next) {
      handler = next;
      for (const message of pending.splice(0)) void handler(message);
      return () => { handler = undefined; };
    },
  };
}

async function connect(url, clientId, { clean = true, username, password } = {}) {
  const client = mqtt.connect(url, {
    clientId, clean, reconnectPeriod: 0, connectTimeout: 5000, protocolVersion: 4,
    ...(username !== undefined ? { username, password } : {}),
  });
  const port = portFor(client);
  await once(client, 'connect');
  return { client, port };
}

function command(commandId, extra = {}) {
  return JSON.stringify({
    commandId,
    command: 'pulse',
    createdAt: Date.now(),
    payload: { channel: 1 },
    ...extra,
  });
}

function setupHandler(port, replayStore) {
  const effects = [];
  const results = [];
  const handler = createMqttCommandHandler({
    runtime: {
      deviceId: 'broker-device',
      ports: { policy: { async check() { return { ok: true, data: { allowed: true } }; } } },
    },
    client: port,
    replayStore,
    requireSignedCommands: false,
    executor: {
      async execute(next) {
        effects.push(next.commandId);
        return { ok: true, data: { executed: next.commandId } };
      },
    },
  });
  port.onMessage(async (message) => {
    results.push(await handler.handleCommand(message));
  });
  return { effects, results };
}

test('QoS 1 broker delivery executes once and rejects a duplicate command ID', { timeout: 30_000 }, async (t) => {
  const broker = await startBroker();
  t.after(() => broker.close());
  const directory = mkdtempSync(join(tmpdir(), 'mqtt-broker-qos1-'));
  const replayStore = await createSqliteMqttReplayStore({ path: join(directory, 'replay.sqlite') });
  t.after(async () => { await replayStore.close(); rmSync(directory, { recursive: true, force: true }); });
  const subscriber = await connect(broker.url, 'subscriber-qos1');
  const publisher = await connect(broker.url, 'publisher-qos1');
  t.after(async () => { await subscriber.port.disconnect(); await publisher.port.disconnect(); });
  const { effects, results } = setupHandler(subscriber.port, replayStore);
  await subscriber.port.subscribe(TOPIC, { qos: 1 });

  const body = command('qos1-command');
  await publisher.port.publish(TOPIC, body, { qos: 1 });
  await waitFor(() => results.length === 1, 'first QoS1 result');
  assert.equal(results[0].ok, true);
  assert.deepEqual(effects, ['qos1-command']);

  await publisher.port.publish(TOPIC, body, { qos: 1 });
  await waitFor(() => results.length === 2, 'duplicate QoS1 result');
  assert.equal(results[1].ok, false);
  assert.match(results[1].error, /duplicate commandId/);
  assert.deepEqual(effects, ['qos1-command']);
});

test('QoS 2 broker delivery executes the command', { timeout: 30_000 }, async (t) => {
  const broker = await startBroker();
  t.after(() => broker.close());
  const directory = mkdtempSync(join(tmpdir(), 'mqtt-broker-qos2-'));
  const replayStore = await createSqliteMqttReplayStore({ path: join(directory, 'replay.sqlite') });
  t.after(async () => { await replayStore.close(); rmSync(directory, { recursive: true, force: true }); });
  const subscriber = await connect(broker.url, 'subscriber-qos2');
  const publisher = await connect(broker.url, 'publisher-qos2');
  t.after(async () => { await subscriber.port.disconnect(); await publisher.port.disconnect(); });
  const { effects, results } = setupHandler(subscriber.port, replayStore);
  await subscriber.port.subscribe(TOPIC, { qos: 2 });

  await publisher.port.publish(TOPIC, command('qos2-command'), { qos: 2 });
  await waitFor(() => results.length === 1, 'QoS2 result');
  assert.equal(results[0].ok, true);
  assert.deepEqual(effects, ['qos2-command']);
});

test('persistent session queues QoS 1 while offline and durable replay blocks redelivery after restart', { timeout: 30_000 }, async (t) => {
  const broker = await startBroker();
  t.after(() => broker.close());
  const directory = mkdtempSync(join(tmpdir(), 'mqtt-broker-session-'));
  const replayPath = join(directory, 'replay.sqlite');
  let replayStore = await createSqliteMqttReplayStore({ path: replayPath });
  t.after(async () => { await replayStore.close(); rmSync(directory, { recursive: true, force: true }); });

  const clientId = 'persistent-session';
  let subscriber = await connect(broker.url, clientId, { clean: false });
  let state = setupHandler(subscriber.port, replayStore);
  await subscriber.port.subscribe(TOPIC, { qos: 1 });
  const publisher = await connect(broker.url, 'persistent-publisher');
  t.after(async () => { await publisher.port.disconnect(); });

  const body = command('persistent-command');
  await publisher.port.publish(TOPIC, body, { qos: 1 });
  await waitFor(() => state.results.length === 1, 'online delivery');
  assert.deepEqual(state.effects, ['persistent-command']);

  // Graceful disconnect retains the non-clean session in the broker. Close the
  // handler store too, so the reconnect exercises both broker and replay restart.
  await subscriber.port.disconnect();
  await replayStore.close();
  replayStore = await createSqliteMqttReplayStore({ path: replayPath });

  await publisher.port.publish(TOPIC, command('offline-command'), { qos: 1 });
  subscriber = await connect(broker.url, clientId, { clean: false });
  state = setupHandler(subscriber.port, replayStore);
  await waitFor(() => state.results.length === 1, 'offline queued delivery');
  assert.equal(state.results[0].ok, true);
  assert.deepEqual(state.effects, ['offline-command']);

  await publisher.port.publish(TOPIC, command('offline-command'), { qos: 1 });
  await waitFor(() => state.results.length === 2, 'offline duplicate');
  assert.equal(state.results[1].ok, false);
  assert.match(state.results[1].error, /duplicate commandId/);
  assert.deepEqual(state.effects, ['offline-command']);
  await subscriber.port.disconnect();
});

test('broker authentication rejection is surfaced to the transport client', { timeout: 30_000 }, async (t) => {
  const broker = await startBroker({
    authenticate(_client, username, password, done) {
      const supplied = Buffer.isBuffer(password) ? password.toString('utf8') : password;
      done(null, username === 'operator' && supplied === 'secret');
    },
  });
  t.after(() => broker.close());
  const unauthorized = mqtt.connect(broker.url, {
    clientId: 'unauthorized', reconnectPeriod: 0, connectTimeout: 5000, username: 'operator', password: 'wrong',
    manualConnect: true,
  });
  t.after(() => unauthorized.end(true));
  unauthorized.on('error', () => {});
  const errorEvent = once(unauthorized, 'error');
  unauthorized.connect();
  const [error] = await errorEvent;
  assert.match(String(error), /not authorized|bad user name|bad username|connection refused/i);

  const authorized = await connect(broker.url, 'authorized', { username: 'operator', password: 'secret' });
  assert.equal(authorized.client.connected, true);
  await authorized.port.disconnect();
});
