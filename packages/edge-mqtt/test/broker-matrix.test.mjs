import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import mqtt from 'mqtt';

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function makeCertificates(directory) {
  const caKey = join(directory, 'ca.key');
  const ca = join(directory, 'ca.crt');
  const serverKey = join(directory, 'server.key');
  const csr = join(directory, 'server.csr');
  const server = join(directory, 'server.crt');
  const ext = join(directory, 'server.ext');
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', caKey, '-out', ca, '-days', '1', '-subj', '/CN=Totem Broker Test CA']);
  run('openssl', ['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', serverKey, '-out', csr, '-subj', '/CN=localhost']);
  writeFileSync(ext, 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n');
  run('openssl', ['x509', '-req', '-in', csr, '-CA', ca, '-CAkey', caKey, '-CAcreateserial', '-out', server, '-days', '1', '-extfile', ext]);
  // A second CA is deliberately untrusted by the client.
  const wrongKey = join(directory, 'wrong-ca.key');
  const wrong = join(directory, 'wrong-ca.crt');
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', wrongKey, '-out', wrong, '-days', '1', '-subj', '/CN=Wrong CA']);
  for (const file of [ca, caKey, server, serverKey, wrong]) chmodSync(file, 0o644);
  chmodSync(directory, 0o755);
  return { ca, caCert: readFileSync(ca), server, serverKey, wrong, wrongCert: readFileSync(wrong) };
}

function startContainer(name, image, args) {
  const id = run('docker', ['run', '--rm', '-d', '--name', name, ...args, image]).trim();
  return {
    id,
    port(containerPort) {
      const mapping = run('docker', ['port', id, `${containerPort}/tcp`]).trim();
      const match = /:(\d+)$/.exec(mapping);
      if (!match) throw new Error(`No host port for ${name}: ${mapping}`);
      return Number(match[1]);
    },
    stop() {
      try { run('docker', ['rm', '-f', id]); } catch { /* already removed */ }
    },
  };
}

async function waitForTls(port, caCert, credentials = {}, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const client = mqtt.connect(`mqtts://127.0.0.1:${port}`, {
        ca: caCert, servername: 'localhost', rejectUnauthorized: true,
        ...credentials,
        clientId: `ready-${Date.now()}`, reconnectPeriod: 0, connectTimeout: 2000,
      });
      await Promise.race([
        once(client, 'connect'),
        once(client, 'error').then(([error]) => { throw error; }),
      ]);
      await new Promise((resolve) => client.end(true, {}, resolve));
      return;
    } catch (error) {
      last = error;
      await delay(500);
    }
  }
  throw new Error(`TLS broker did not become ready: ${last?.message ?? last}`);
}

async function withClient(port, caCert, credentials = {}, clientId = `matrix-${Date.now()}`) {
  const client = mqtt.connect(`mqtts://127.0.0.1:${port}`, {
    ca: caCert, servername: 'localhost', rejectUnauthorized: true,
    ...credentials,
    clientId, reconnectPeriod: 0, connectTimeout: 5000,
  });
  await Promise.race([
    once(client, 'connect'),
    once(client, 'error').then(([error]) => { throw error; }),
  ]);
  return client;
}

async function subscribe(client, topic, qos = 1) {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos }, (error, granted) => {
      if (error) reject(error); else resolve(granted?.[0]?.qos ?? 128);
    });
  });
}

async function publish(client, topic, payload, qos = 1) {
  await new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos }, (error) => error ? reject(error) : resolve());
  });
}

function setupDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mqtt-broker-matrix-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function mosquitto(t, certs, directory) {
  const config = join(directory, 'mosquitto.conf');
  const acl = join(directory, 'acl');
  const passwd = join(directory, 'passwd');
  run('docker', ['run', '--rm', '-v', `${directory}:/work`, 'eclipse-mosquitto:2',
    'mosquitto_passwd', '-b', '-c', '/work/passwd', 'operator', 'secret']);
  writeFileSync(config, [
    'listener 8883',
    'allow_anonymous false',
    'password_file /mosquitto/config/passwd',
    'acl_file /mosquitto/config/acl',
    'cafile /mosquitto/certs/ca.crt',
    'certfile /mosquitto/certs/server.crt',
    'keyfile /mosquitto/certs/server.key',
  ].join('\n') + '\n');
  writeFileSync(acl, 'user operator\ntopic readwrite allowed/#\n');
  chmodSync(config, 0o644); chmodSync(acl, 0o644); chmodSync(passwd, 0o644);
  const container = startContainer(`mqtt-mosquitto-${process.pid}`, 'eclipse-mosquitto:2', [
    '-p', '127.0.0.1::8883',
    '-v', `${config}:/mosquitto/config/mosquitto.conf:ro`,
    '-v', `${acl}:/mosquitto/config/acl:ro`,
    '-v', `${passwd}:/mosquitto/config/passwd:ro`,
    '-v', `${certs.ca}:/mosquitto/certs/ca.crt:ro`,
    '-v', `${certs.server}:/mosquitto/certs/server.crt:ro`,
    '-v', `${certs.serverKey}:/mosquitto/certs/server.key:ro`,
  ]);
  t.after(() => container.stop());
  return container;
}

function emqx(t, certs, directory) {
  const acl = join(directory, 'emqx-acl.conf');
  writeFileSync(acl, '{allow, all, subscribe, ["allowed/#"]}.\n{allow, all, publish, ["allowed/#"]}.\n{deny, all}.\n');
  chmodSync(acl, 0o644);
  const container = startContainer(`mqtt-emqx-${process.pid}`, 'emqx/emqx:5.8.0', [
    '-p', '127.0.0.1::8883',
    '-v', `${certs.ca}:/certs/ca.crt:ro`,
    '-v', `${certs.server}:/certs/server.crt:ro`,
    '-v', `${certs.serverKey}:/certs/server.key:ro`,
    '-v', `${acl}:/opt/emqx/etc/acl.conf:ro`,
    '-e', 'EMQX_LISTENERS__SSL__DEFAULT__BIND=0.0.0.0:8883',
    '-e', 'EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__CACERTFILE=/certs/ca.crt',
    '-e', 'EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__CERTFILE=/certs/server.crt',
    '-e', 'EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__KEYFILE=/certs/server.key',
    '-e', 'EMQX_LISTENERS__SSL__DEFAULT__SSL_OPTIONS__VERIFY=verify_none',
    '-e', 'EMQX_AUTHORIZATION__NO_MATCH=deny',
    '-e', 'EMQX_AUTHORIZATION__DENY_ACTION=ignore',
    '-e', 'EMQX_AUTHORIZATION__SOURCES__1__TYPE=file',
    '-e', 'EMQX_AUTHORIZATION__SOURCES__1__ENABLE=true',
    '-e', 'EMQX_AUTHORIZATION__SOURCES__1__PATH=/opt/emqx/etc/acl.conf',
  ]);
  t.after(() => container.stop());
  return container;
}

async function matrix(t, brokerName, startBroker) {
  const directory = setupDirectory(t);
  const certs = makeCertificates(directory);
  const container = startBroker(t, certs, directory);
  const port = container.port(8883);
  const credentials = brokerName === 'mosquitto' ? { username: 'operator', password: 'secret' } : {};
  await waitForTls(port, certs.caCert, credentials);
  const client = await withClient(port, certs.caCert, credentials, `matrix-${brokerName}-${Date.now()}`);
  t.after(async () => { await new Promise((resolve) => client.end(true, {}, resolve)); });

  const granted = await subscribe(client, 'allowed/#');
  assert.notEqual(granted, 128, `${brokerName} denied an allowed subscription`);
  const received = once(client, 'message');
  await publish(client, 'allowed/device', JSON.stringify({ commandId: 'matrix', command: 'ping', createdAt: Date.now() }), 1);
  const [topic, payload] = await Promise.race([
    received,
    delay(5000).then(() => { throw new Error(`${brokerName} did not deliver an allowed message`); }),
  ]);
  assert.equal(topic, 'allowed/device');
  assert.match(payload.toString(), /"commandId":"matrix"/);

  // Mosquitto enforces the ACL at SUBACK; EMQX may accept then drop, so only
  // Mosquitto is used for the explicit deny assertion.
  if (brokerName === 'mosquitto') {
    let deniedReceived = false;
    client.on('message', (topic) => { if (topic.startsWith('denied/')) deniedReceived = true; });
    await subscribe(client, 'denied/#');
    await publish(client, 'denied/topic', 'must-not-pass');
    await delay(750);
    assert.equal(deniedReceived, false, 'Mosquitto ACL allowed a denied publish/subscription');
  }

  const untrusted = mqtt.connect(`mqtts://127.0.0.1:${port}`, {
    ca: certs.wrongCert, servername: 'localhost', rejectUnauthorized: true,
    ...(brokerName === 'mosquitto' ? { username: 'operator', password: 'secret' } : {}),
    clientId: `untrusted-${Date.now()}`, reconnectPeriod: 0, connectTimeout: 3000,
  });
  await assert.rejects(async () => {
    await Promise.race([
      once(untrusted, 'connect').then(() => { throw new Error('untrusted CA was accepted'); }),
      once(untrusted, 'error').then(([error]) => { throw error; }),
    ]);
  });
  untrusted.end(true);
}

test('Mosquitto TLS + ACL matrix', { timeout: 120_000 }, (t) => matrix(t, 'mosquitto', mosquitto));
test('EMQX TLS matrix', { timeout: 180_000 }, (t) => matrix(t, 'emqx', emqx));
